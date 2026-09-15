<?php

namespace App\Services;

use App\Models\ProductSerial;
use App\Models\StockLot;
use App\Models\StockLotConsumption;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

// 🆕 ตัดจ่ายสต๊อกแบบ FIFO (First-In-First-Out) จริง — ใช้ตอนอนุมัติเอกสารขาย/เบิกจ่าย (SaleDocumentController::
// approve()) และเบิกสินค้าด้วยมือ (StockMovementController) แทนการอ่านค่าถัวเฉลี่ยทั้งประวัติแบบเดิม
//
// ผู้เรียกต้องห่อ DB::transaction()/DB::beginTransaction() เองก่อนเรียกทุกเมธอดในนี้เสมอ (มิเรอร์แพทเทิร์น
// เดียวกับ StockLotService/DirectGoodsReceiptService) — ไม่เปิด transaction ซ้ำในนี้
//
// 🛡️ นโยบายเมื่อล็อตไม่พอ (data drift — ของขายไปมากกว่าที่ล็อตมีบันทึกไว้): ไม่ throw exception เด็ดขาด
// StockBalance.qty ยังเป็นแหล่งความจริงเรื่อง "มีของพอไหม" (เช็คอยู่แล้วในโค้ดเดิมก่อนเรียกเมธอดพวกนี้เสมอ)
// ส่วนชั้นล็อตเป็นเรื่องต้นทุนล้วนๆ ที่ยอมให้ degrade เป็นต้นทุนสำรอง (fallback) ได้ โดยบันทึก shortfall ไว้ให้
// stock:check-lot-integrity จับได้ภายหลัง — การอนุมัติเอกสารต้องไม่ถูกบล็อกเพราะชั้นต้นทุน
class StockLotFifoService
{
    /**
     * ตัดสต๊อกแบบ FIFO สำหรับสินค้าไม่คุม S/N (หรือคุม S/N แต่ไม่ได้ระบุ S/N มา)
     *
     * @param array{reference_type:string, reference_id?:int|null, sale_document_id?:int|null,
     *              stock_movement_id?:int|null} $context
     * @return array{lines: array<int, array{stock_lot_id:?int, qty:float, unit_cost:float, subtotal:float}>,
     *               qty_consumed: float, total_cost: float, unit_cost: float,
     *               qty_short: float, used_fallback: bool}
     */
    public static function consume(int $productId, int $warehouseId, int $companyId, float $qty, array $context): array
    {
        $remaining = $qty;
        $lines = [];
        $totalCost = 0.0;

        $lots = StockLot::where('company_id', $companyId)
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->where('qty_remaining', '>', 0)
            ->orderBy('received_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($lots as $lot) {
            if ($remaining <= 0) break;

            $take = min($remaining, (float) $lot->qty_remaining);
            $lot->qty_remaining = (float) $lot->qty_remaining - $take;
            $lot->save();

            $subtotal = round($take * (float) $lot->unit_cost, 2);
            $lines[] = ['stock_lot_id' => $lot->id, 'qty' => $take, 'unit_cost' => (float) $lot->unit_cost, 'subtotal' => $subtotal];
            $totalCost += $subtotal;

            self::recordConsumption($companyId, $lot->id, $productId, $warehouseId, $take, (float) $lot->unit_cost, false, $context);

            $remaining -= $take;
        }

        $usedFallback = false;
        if ($remaining > 0) {
            [$fallbackCost] = StockLotService::fallbackUnitCost($productId, $companyId, $warehouseId);
            $subtotal = round($remaining * $fallbackCost, 2);
            $lines[] = ['stock_lot_id' => null, 'qty' => $remaining, 'unit_cost' => $fallbackCost, 'subtotal' => $subtotal];
            $totalCost += $subtotal;
            $usedFallback = true;

            self::recordConsumption($companyId, null, $productId, $warehouseId, $remaining, $fallbackCost, true, $context);

            Log::warning('FIFO shortfall: ล็อตไม่พอสำหรับการตัดจ่ายนี้ ใช้ต้นทุนสำรองแทน', [
                'product_id' => $productId, 'warehouse_id' => $warehouseId, 'company_id' => $companyId,
                'qty_short' => $remaining, 'context' => $context,
            ]);
        }

        return [
            'lines' => $lines,
            'qty_consumed' => $qty,
            'total_cost' => round($totalCost, 2),
            'unit_cost' => $qty > 0 ? round($totalCost / $qty, 2) : 0.0,
            'qty_short' => $usedFallback ? $remaining : 0.0,
            'used_fallback' => $usedFallback,
        ];
    }

    /**
     * ตัดล็อต "เจาะจง" ตัวเดียวโดยตรง — ไม่เดินไล่ FIFO ทั้งลิสต์เหมือน consume() — ใช้ตอนรู้แน่ชัดแล้วว่าของที่
     * หายไปมาจากล็อตไหน (เช่น ตรวจนับสต๊อกแบบ 1 แถวต่อ 1 หน่วยจริง ผู้ตรวจนับลบแถวของล็อตที่นับไม่เจอออกเอง —
     * ดู StockCountImport.php) ให้ความแม่นยำสูงกว่า FIFO เดาเอง เพราะบางครั้งของที่หายไปจริงอาจเป็นล็อตใหม่กว่า
     * ล็อตที่เก่าที่สุดก็ได้ (เช่น ของหายจากล็อตที่เพิ่งรับมาล่าสุด ไม่ใช่ล็อตเก่าสุดที่ควรขายก่อนตามทฤษฎี)
     *
     * shortfall-safe เหมือน consume() — ล็อตไม่พอไม่ throw แค่บันทึก shortfall ที่ต้นทุนสำรองแทน
     */
    public static function decrementLot(int $lotId, float $qty, array $context): array
    {
        $lot = StockLot::where('id', $lotId)->lockForUpdate()->first();

        if (!$lot) {
            Log::warning('decrementLot: ไม่พบล็อตที่ระบุ (อาจถูกลบไปแล้ว)', ['stock_lot_id' => $lotId, 'context' => $context]);
            return ['lines' => [], 'qty_consumed' => 0.0, 'total_cost' => 0.0, 'unit_cost' => 0.0, 'qty_short' => $qty, 'used_fallback' => false];
        }

        $take = min($qty, (float) $lot->qty_remaining);
        $lot->qty_remaining = (float) $lot->qty_remaining - $take;
        $lot->save();

        $lines = [];
        $totalCost = 0.0;
        if ($take > 0) {
            $subtotal = round($take * (float) $lot->unit_cost, 2);
            $lines[] = ['stock_lot_id' => $lot->id, 'qty' => $take, 'unit_cost' => (float) $lot->unit_cost, 'subtotal' => $subtotal];
            $totalCost += $subtotal;
            self::recordConsumption($lot->company_id, $lot->id, $lot->product_id, $lot->warehouse_id, $take, (float) $lot->unit_cost, false, $context);
        }

        $remaining = $qty - $take;
        $usedFallback = false;
        if ($remaining > 0) {
            [$fallbackCost] = StockLotService::fallbackUnitCost($lot->product_id, $lot->company_id, $lot->warehouse_id);
            $subtotal = round($remaining * $fallbackCost, 2);
            $lines[] = ['stock_lot_id' => null, 'qty' => $remaining, 'unit_cost' => $fallbackCost, 'subtotal' => $subtotal];
            $totalCost += $subtotal;
            $usedFallback = true;
            self::recordConsumption($lot->company_id, null, $lot->product_id, $lot->warehouse_id, $remaining, $fallbackCost, true, $context);

            Log::warning('decrementLot: ขอตัดมากกว่าที่ล็อตนี้มีจริง ส่วนเกินใช้ต้นทุนสำรองแทน', [
                'stock_lot_id' => $lotId, 'qty_requested' => $qty, 'qty_available' => (float) $lot->qty_remaining + $take, 'context' => $context,
            ]);
        }

        return [
            'lines' => $lines,
            'qty_consumed' => $qty,
            'total_cost' => round($totalCost, 2),
            'unit_cost' => $qty > 0 ? round($totalCost / $qty, 2) : 0.0,
            'qty_short' => $usedFallback ? $remaining : 0.0,
            'used_fallback' => $usedFallback,
        ];
    }

    /**
     * ตัดสต๊อกตาม S/N ที่ระบุ — แต่ละ serial ผูกกับล็อตเดียวอยู่แล้วผ่าน stock_lot_id จึงเป็นแค่ "ลด
     * qty_remaining ของล็อตนั้น 1" ต่อ 1 serial ไม่ต้องมี logic แบ่งล็อต
     * serial ที่ stock_lot_id เป็น null (ข้อมูลเก่าที่ backfill ไม่ครอบคลุม) จะถูกคิดเป็น shortfall
     * ที่ต้นทุน fallback แทนการโยน exception
     *
     * @param Collection<ProductSerial>|array<int> $serials คอลเลกชันของ ProductSerial หรือ array ของ id
     */
    public static function consumeSerials($serials, int $warehouseId, int $companyId, array $context): array
    {
        $serialIds = $serials instanceof Collection
            ? $serials->pluck('id')->all()
            : (is_array($serials) ? $serials : [$serials]);

        if (empty($serialIds)) {
            return ['lines' => [], 'qty_consumed' => 0.0, 'total_cost' => 0.0, 'unit_cost' => 0.0, 'qty_short' => 0.0, 'used_fallback' => false];
        }

        $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

        $lines = [];
        $totalCost = 0.0;
        $qtyShort = 0.0;
        $usedFallback = false;
        $productId = $lockedSerials->first()?->product_id;

        // 🛡️ ล็อกล็อตทั้งหมดที่เกี่ยวข้องทีเดียว (ไม่ใช่ทีละ serial) กันแย่งล็อกซ้ำถ้า S/N หลายตัวชี้ล็อตเดียวกัน
        $lotIds = $lockedSerials->pluck('stock_lot_id')->filter()->unique()->all();
        $lotsById = empty($lotIds) ? collect() : StockLot::whereIn('id', $lotIds)->lockForUpdate()->get()->keyBy('id');

        foreach ($lockedSerials as $serial) {
            $lot = $serial->stock_lot_id ? $lotsById->get($serial->stock_lot_id) : null;

            if ($lot) {
                $lot->qty_remaining = max(0, (float) $lot->qty_remaining - 1);
                $lot->save();

                $subtotal = round((float) $lot->unit_cost, 2);
                $lines[] = ['stock_lot_id' => $lot->id, 'qty' => 1, 'unit_cost' => (float) $lot->unit_cost, 'subtotal' => $subtotal, 'product_serial_id' => $serial->id];
                $totalCost += $subtotal;

                self::recordConsumption($companyId, $lot->id, $serial->product_id, $warehouseId, 1, (float) $lot->unit_cost, false, $context, $serial->id);
            } else {
                [$fallbackCost] = StockLotService::fallbackUnitCost($serial->product_id, $companyId, $warehouseId);
                $lines[] = ['stock_lot_id' => null, 'qty' => 1, 'unit_cost' => $fallbackCost, 'subtotal' => round($fallbackCost, 2), 'product_serial_id' => $serial->id];
                $totalCost += round($fallbackCost, 2);
                $qtyShort += 1;
                $usedFallback = true;

                self::recordConsumption($companyId, null, $serial->product_id, $warehouseId, 1, $fallbackCost, true, $context, $serial->id);

                Log::warning('FIFO shortfall: S/N นี้ไม่มีล็อตต้นทุนผูกอยู่ (ข้อมูลเก่า) ใช้ต้นทุนสำรองแทน', [
                    'product_serial_id' => $serial->id, 'serial_number' => $serial->serial_number, 'context' => $context,
                ]);
            }
        }

        $qty = count($lockedSerials);

        return [
            'lines' => $lines,
            'qty_consumed' => (float) $qty,
            'total_cost' => round($totalCost, 2),
            'unit_cost' => $qty > 0 ? round($totalCost / $qty, 2) : 0.0,
            'qty_short' => $qtyShort,
            'used_fallback' => $usedFallback,
        ];
    }

    /**
     * "แอบดู" ต้นทุนที่จะโดนคิดถ้าตัดตอนนี้ — ไม่แตะ qty_remaining เลย ใช้สำหรับ prefill ช่องต้นทุนในฟอร์ม
     * และเอกสารประเภท "จอง" ที่ไม่ตัดสต๊อกจริง (คืนต้นทุนของล็อตเก่าสุดที่ยังมีของ ซึ่งเป็นตัวเลขที่จะโดนคิดจริง
     * ถ้าขายตอนนี้ — ไม่ใช่ค่าเฉลี่ยของทุกล็อตที่เหลือ)
     */
    public static function peek(int $productId, int $companyId, ?int $warehouseId, float $qty = 1): ?float
    {
        $query = StockLot::where('company_id', $companyId)
            ->where('product_id', $productId)
            ->where('qty_remaining', '>', 0);
        if ($warehouseId) $query->where('warehouse_id', $warehouseId);

        $lot = $query->orderBy('received_at')->orderBy('id')->first();
        if ($lot) return (float) $lot->unit_cost;

        [$fallbackCost] = StockLotService::fallbackUnitCost($productId, $companyId, $warehouseId);
        return $fallbackCost;
    }

    /**
     * ย้อนกลับการตัดล็อต — คืน qty_remaining เข้าล็อตเดิมทุกแถวที่ตรงเงื่อนไข แล้ว mark reversed_at
     * ใช้ตอน cancel() เอกสาร / ยกเลิก stock movement
     *
     * @param array{sale_document_id?:int, reference_type?:string, reference_id?:int,
     *              stock_movement_id?:int} $filter
     * @return array{reversed_count:int, reversed_qty:float}
     */
    public static function reverse(array $filter): array
    {
        $query = StockLotConsumption::whereNull('reversed_at');
        foreach ($filter as $key => $value) {
            $query->where($key, $value);
        }

        $consumptions = $query->lockForUpdate()->get();
        $reversedCount = 0;
        $reversedQty = 0.0;

        foreach ($consumptions as $consumption) {
            if ($consumption->stock_lot_id) {
                $lot = StockLot::where('id', $consumption->stock_lot_id)->lockForUpdate()->first();
                if ($lot) {
                    $lot->qty_remaining = min((float) $lot->qty_received, (float) $lot->qty_remaining + (float) $consumption->qty);
                    $lot->save();
                }
            }
            // 🛡️ แถว shortfall (stock_lot_id เป็น null ตั้งแต่แรก) ไม่มีล็อตจริงให้คืน — แค่ mark reversed
            // เฉยๆ ก็พอ (ไม่สร้างล็อตใหม่ลอยๆ ที่ไม่มีที่มาจริง)

            $consumption->update(['qty_reversed' => $consumption->qty, 'reversed_at' => now()]);
            $reversedCount++;
            $reversedQty += (float) $consumption->qty;
        }

        return ['reversed_count' => $reversedCount, 'reversed_qty' => $reversedQty];
    }

    /**
     * โอนย้ายคลัง (StockMovementController::transfer()) — ตัดจากล็อตต้นทางแบบ FIFO แล้วสร้างล็อตปลายทางใหม่ที่
     * "คัดลอก" ต้นทุน/วันที่รับเข้าจากล็อตต้นทางมาให้ครบทุกล็อตที่ถูกตัด (ไม่ใช้ fallback/ค่าเฉลี่ย) — สำคัญมาก
     * เพราะถ้าใช้ fallback แทน การโอนย้ายจะรีเซ็ตทั้งต้นทุนจริงและอายุ FIFO ของของที่โอนไปทุกครั้ง
     *
     * สินค้าคุม S/N: อัปเดต stock_lot_id ของแต่ละ serial ให้ชี้ไปล็อตปลายทางใหม่ที่สร้างเฉพาะให้มันด้วยเลย
     * (ผู้เรียกไม่ต้องอัปเดต stock_lot_id เองอีก)
     *
     * @param Collection<ProductSerial>|array $serials ว่างได้ถ้าสินค้าไม่คุม S/N (ใช้ $qty แทน)
     */
    public static function transfer(
        int $fromProductId, int $fromWarehouseId, int $toProductId, int $toWarehouseId,
        int $companyId, float $qty, $serials, array $context,
    ): void {
        $serials = $serials instanceof Collection ? $serials : collect($serials);

        if ($serials->isNotEmpty()) {
            foreach ($serials as $serial) {
                $sourceLot = $serial->stock_lot_id ? StockLot::where('id', $serial->stock_lot_id)->lockForUpdate()->first() : null;

                if ($sourceLot) {
                    $sourceLot->qty_remaining = max(0, (float) $sourceLot->qty_remaining - 1);
                    $sourceLot->save();
                    self::recordConsumption($companyId, $sourceLot->id, $fromProductId, $fromWarehouseId, 1, (float) $sourceLot->unit_cost, false, $context, $serial->id);

                    $destLot = StockLotService::recordReceipt([
                        'company_id' => $companyId, 'product_id' => $toProductId, 'warehouse_id' => $toWarehouseId,
                        'qty' => 1, 'unit_cost' => (float) $sourceLot->unit_cost, 'received_at' => $sourceLot->received_at,
                        'cost_is_estimated' => (bool) $sourceLot->cost_is_estimated, 'source_type' => 'transfer_in',
                        'reference_number' => $context['reference_number'] ?? null,
                    ]);
                } else {
                    // 🛡️ serial นี้ไม่มีล็อตผูกอยู่เลย (ข้อมูลเก่า) — สร้างล็อตปลายทางด้วยต้นทุนสำรองแทน
                    [$fallbackCost] = StockLotService::fallbackUnitCost($toProductId, $companyId, $toWarehouseId);
                    $destLot = StockLotService::recordReceipt([
                        'company_id' => $companyId, 'product_id' => $toProductId, 'warehouse_id' => $toWarehouseId,
                        'qty' => 1, 'unit_cost' => $fallbackCost, 'cost_is_estimated' => true, 'source_type' => 'transfer_in',
                        'reference_number' => $context['reference_number'] ?? null,
                    ]);
                }

                $serial->update(['stock_lot_id' => $destLot->id]);
            }
            return;
        }

        $result = self::consume($fromProductId, $fromWarehouseId, $companyId, $qty, $context);
        foreach ($result['lines'] as $line) {
            $receivedAt = now();
            $costIsEstimated = $line['stock_lot_id'] === null; // shortfall = ไม่มีล็อตต้นทางจริงให้อ้างอิงวันที่
            if ($line['stock_lot_id']) {
                $sourceLot = StockLot::find($line['stock_lot_id']);
                $receivedAt = $sourceLot?->received_at ?? now();
                $costIsEstimated = (bool) ($sourceLot?->cost_is_estimated ?? false);
            }

            StockLotService::recordReceipt([
                'company_id' => $companyId, 'product_id' => $toProductId, 'warehouse_id' => $toWarehouseId,
                'qty' => $line['qty'], 'unit_cost' => $line['unit_cost'], 'received_at' => $receivedAt,
                'cost_is_estimated' => $costIsEstimated, 'source_type' => 'transfer_in',
                'reference_number' => $context['reference_number'] ?? null,
            ]);
        }
    }

    /**
     * ลูกค้าคืนสินค้าจริง (ใบคืนสินค้าที่อ้างอิงใบลดหนี้) — คืนจำนวนกลับเข้า "ล็อตเดิม" ที่เคยตัดไปตอนขาย แทนที่
     * จะสร้างล็อตใหม่ลอยๆ (จะทำให้ FIFO ผิดลำดับ/ต้นทุนเพี้ยนจากที่ควรเป็น) รองรับคืนบางส่วน (ไม่ครบจำนวนที่ขายไป)
     * ผ่านคอลัมน์ qty_reversed บน stock_lot_consumptions — ถ้าหา consumption เดิมไม่เจอเลย (ขายไปก่อนระบบ FIFO
     * จะมีอยู่) จึงค่อย fallback สร้างล็อตใหม่ source_type='sales_return'
     *
     * @param \Illuminate\Support\Collection<\App\Models\ProductSerial> $serials ว่างได้ถ้าสินค้าไม่คุม S/N
     */
    public static function returnToOriginalLots(
        int $productId, int $warehouseId, int $companyId, float $qty,
        int $sourceSaleDocumentId, Collection $serials, array $context,
    ): void {
        if ($serials->isNotEmpty()) {
            // 🎯 สินค้าคุม S/N — แต่ละชิ้นรู้ล็อตต้นทางของตัวเองอยู่แล้วผ่าน stock_lot_id (ไม่เคยถูกแก้แม้ตอนขาย)
            // คืนตรงเข้าล็อตนั้นได้เลย แม่นยำกว่าและไม่ต้องเดา ไม่ต้องพึ่ง consumption lookup เลย
            foreach ($serials as $serial) {
                if (!$serial->stock_lot_id) continue;

                $lot = StockLot::where('id', $serial->stock_lot_id)->lockForUpdate()->first();
                if ($lot) {
                    $lot->qty_remaining = min((float) $lot->qty_received, (float) $lot->qty_remaining + 1);
                    $lot->save();
                }

                StockLotConsumption::where('product_serial_id', $serial->id)
                    ->where('sale_document_id', $sourceSaleDocumentId)
                    ->whereNull('reversed_at')
                    ->update(['qty_reversed' => 1, 'reversed_at' => now()]);
            }
            return;
        }

        // 🎯 สินค้าไม่คุม S/N — ไม่รู้ว่าของที่คืนมาเป็นชิ้นไหนจริงๆ คืนตาม consumption เดิมของใบขายต้นทางนี้
        // เรียงจากอันที่ตัดก่อน (id น้อยสุด) ก่อน จนกว่าจำนวนที่ต้องคืนจะหมด
        $remaining = $qty;
        $consumptions = StockLotConsumption::where('sale_document_id', $sourceSaleDocumentId)
            ->where('product_id', $productId)
            ->whereColumn('qty_reversed', '<', 'qty')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($consumptions as $consumption) {
            if ($remaining <= 0) break;

            $availableToReverse = (float) $consumption->qty - (float) $consumption->qty_reversed;
            $take = min($remaining, $availableToReverse);

            if ($consumption->stock_lot_id) {
                $lot = StockLot::where('id', $consumption->stock_lot_id)->lockForUpdate()->first();
                if ($lot) {
                    $lot->qty_remaining = min((float) $lot->qty_received, (float) $lot->qty_remaining + $take);
                    $lot->save();
                }
            }

            $newQtyReversed = (float) $consumption->qty_reversed + $take;
            $consumption->update([
                'qty_reversed' => $newQtyReversed,
                'reversed_at' => $newQtyReversed >= (float) $consumption->qty ? now() : null,
            ]);

            $remaining -= $take;
        }

        if ($remaining > 0) {
            // 🛡️ หา consumption เดิมไม่พอ (ขายไปก่อนระบบ FIFO จะมี หรือคืนเกินจำนวนที่เคยขายจริง) — สร้างล็อตใหม่
            // สำหรับส่วนที่เหลือ ใช้ต้นทุนล็อตล่าสุดของสินค้านี้เป็นค่าประมาณ (ดีกว่าไม่มีต้นทุนเลย)
            [$fallbackCost] = StockLotService::fallbackUnitCost($productId, $companyId, $warehouseId);
            StockLotService::recordReceipt([
                'company_id' => $companyId,
                'product_id' => $productId,
                'warehouse_id' => $warehouseId,
                'qty' => $remaining,
                'unit_cost' => $fallbackCost,
                'cost_is_estimated' => true,
                'source_type' => 'sales_return',
                'reference_number' => $context['reference_number'] ?? null,
            ]);
        }
    }

    private static function recordConsumption(
        int $companyId, ?int $stockLotId, int $productId, int $warehouseId,
        float $qty, float $unitCost, bool $isShortfall, array $context, ?int $productSerialId = null,
    ): void {
        StockLotConsumption::create([
            'company_id' => $companyId,
            'stock_lot_id' => $stockLotId,
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'qty' => $qty,
            'unit_cost' => $unitCost,
            'is_shortfall' => $isShortfall,
            'reference_type' => $context['reference_type'] ?? 'manual',
            'reference_id' => $context['reference_id'] ?? null,
            'sale_document_id' => $context['sale_document_id'] ?? null,
            'stock_movement_id' => $context['stock_movement_id'] ?? null,
            'product_serial_id' => $productSerialId,
        ]);
    }
}
