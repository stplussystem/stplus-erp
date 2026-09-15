<?php

namespace App\Services;

use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\ProductSerial;
use App\Models\StockLot;
use Illuminate\Support\Collection;

// 🆕 สร้าง/ผูกล็อตต้นทุน (FIFO) ฝั่ง "รับเข้า" — เรียกคู่กับทุกจุดที่ StockBalance.qty ถูกบวกเพิ่ม เพื่อไม่ให้
// SUM(stock_lots.qty_remaining) เพี้ยนไปจาก StockBalance.qty จริง (ดู stock:check-lot-integrity)
//
// ผู้เรียกต้องห่อ DB::transaction()/DB::beginTransaction() เองก่อนเรียกทุกเมธอดในนี้เสมอ (มิเรอร์แพทเทิร์น
// เดียวกับ DirectGoodsReceiptService) — ไม่เปิด transaction ซ้ำในนี้
class StockLotService
{
    /**
     * สร้างล็อตใหม่ 1 ล็อตตอนของเข้าคลัง
     *
     * @param array{company_id:int, product_id:int, warehouse_id:int, qty:float,
     *              unit_cost?:float|null, goods_receipt_item_id?:int|null, stock_movement_id?:int|null,
     *              import_batch_id?:int|null, source_type?:string, reference_number?:string|null,
     *              received_at?:\DateTimeInterface|string|null, cost_is_estimated?:bool, note?:string|null} $data
     */
    public static function recordReceipt(array $data): StockLot
    {
        $unitCost = $data['unit_cost'] ?? null;
        $costIsEstimated = $data['cost_is_estimated'] ?? false;

        if ($unitCost === null) {
            [$unitCost, $costIsEstimated] = self::fallbackUnitCost(
                $data['product_id'],
                $data['company_id'],
                $data['warehouse_id'] ?? null,
            );
        }

        return StockLot::create([
            'company_id' => $data['company_id'],
            'product_id' => $data['product_id'],
            'warehouse_id' => $data['warehouse_id'],
            'goods_receipt_item_id' => $data['goods_receipt_item_id'] ?? null,
            'stock_movement_id' => $data['stock_movement_id'] ?? null,
            'import_batch_id' => $data['import_batch_id'] ?? null,
            'unit_cost' => round((float) $unitCost, 2),
            'qty_received' => $data['qty'],
            'qty_remaining' => $data['qty'],
            'source_type' => $data['source_type'] ?? 'goods_receipt',
            'reference_number' => $data['reference_number'] ?? null,
            'received_at' => $data['received_at'] ?? now(),
            'cost_is_estimated' => $costIsEstimated,
            'note' => $data['note'] ?? null,
        ]);
    }

    /**
     * ต้นทุนสำรองเมื่อไม่มีต้นทุนจริงให้ใช้ (นำเข้า Excel ไม่กรอกต้นทุน, รับเข้าด้วยมือไม่กรอกต้นทุน, ยอดยกมา)
     * ลำดับ: ล็อตล่าสุดของ product+warehouse → ล็อตล่าสุดของ product ทั้งบริษัท
     *        → ค่าถัวเฉลี่ยจากใบรับสินค้าแบบเดิม (legacy) → products.price → 0
     *
     * @return array{0: float, 1: bool} [cost, isEstimated]
     */
    public static function fallbackUnitCost(int $productId, int $companyId, ?int $warehouseId = null): array
    {
        if ($warehouseId) {
            $latest = StockLot::where('company_id', $companyId)
                ->where('product_id', $productId)
                ->where('warehouse_id', $warehouseId)
                ->latest('received_at')
                ->latest('id')
                ->first();
            if ($latest) return [(float) $latest->unit_cost, true];
        }

        $latestAnyWarehouse = StockLot::where('company_id', $companyId)
            ->where('product_id', $productId)
            ->latest('received_at')
            ->latest('id')
            ->first();
        if ($latestAnyWarehouse) return [(float) $latestAnyWarehouse->unit_cost, true];

        $legacyAvg = GoodsReceiptItem::whereHas('goodsReceipt', fn ($q) => $q
            ->where('company_id', $companyId)
            ->where('status', '!=', 'Cancelled'))
            ->where('product_id', $productId)
            ->whereNotNull('unit_price')
            ->selectRaw('SUM(quantity * unit_price) as total_cost, SUM(quantity) as total_qty')
            ->first();
        if ($legacyAvg && (float) $legacyAvg->total_qty > 0) {
            return [round((float) $legacyAvg->total_cost / (float) $legacyAvg->total_qty, 2), true];
        }

        $product = Product::find($productId);
        if ($product && (float) $product->price > 0) {
            return [(float) $product->price, true];
        }

        return [0.0, true];
    }

    /** ผูก serial ที่เพิ่งสร้างเข้ากับล็อต (เรียกหลัง ProductSerial::create() ทุกจุด) */
    public static function attachSerialsToLot(array|Collection $serialIds, StockLot $lot): void
    {
        $ids = $serialIds instanceof Collection ? $serialIds->all() : $serialIds;
        if (empty($ids)) return;

        ProductSerial::whereIn('id', $ids)->update(['stock_lot_id' => $lot->id]);
    }
}
