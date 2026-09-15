<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\ProductSerial;
use App\Models\StockBalance;
use App\Models\StockLot;
use App\Models\Warehouse;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * 🆕 สร้างล็อตต้นทุน FIFO "ยกมา" (opening_balance) ให้สต็อกที่มีอยู่เดิมก่อนระบบ FIFO — ไม่มีข้อมูลย้อนหลังว่า
 * ของที่เหลืออยู่ตอนนี้มาจากการรับเข้าครั้งไหนบ้าง จึงสร้างล็อตเดียวต่อ (product, warehouse) แทน โดยคำนวณ
 * ต้นทุนด้วยสูตรถัวเฉลี่ยเดิมเป๊ะ (ดู ReportController::averageCostByProduct()) เพื่อให้มูลค่าสต็อกรวมหลัง
 * backfill เท่าเดิมทุกบาท ณ ตอน cutover — แล้วค่อยแยกกันตามการเคลื่อนไหวจริงหลังจากนี้
 *
 * received_at ตั้งเป็นเวลาที่รันคำสั่งนี้ (ไม่ backdate) เพราะไม่ใช่การรับสินค้าจริง — และเนื่องจากเป็นล็อต
 * แรกสุดของทุกสินค้าอยู่แล้ว ลำดับ FIFO ถัดไปยังถูกต้อง (ของที่รับเข้าหลัง cutover จะมี received_at ใหม่กว่าเสมอ)
 *
 * ปลอดภัยที่จะรันซ้ำ — ข้าม (product, warehouse) ที่มีล็อต opening_balance อยู่แล้ว
 *
 * รัน: php artisan stock:backfill-lots --dry-run   (ดูก่อน)
 *      php artisan stock:backfill-lots              (รันจริง)
 *      php artisan stock:backfill-lots --company=3   (จำกัดเฉพาะบริษัทเดียว)
 */
class BackfillStockLotsCommand extends Command
{
    protected $signature = 'stock:backfill-lots
        {--company= : จำกัดเฉพาะ company_id นี้ (ไม่ระบุ = ทุกบริษัท)}
        {--as-of= : วันที่จะใช้เป็น received_at ของล็อตยกมา (default = ตอนรันคำสั่ง)}
        {--dry-run : แสดงผลลัพธ์โดยไม่เขียน DB}';

    protected $description = 'สร้างล็อตยกมา (opening_balance) ให้สต๊อกที่มีอยู่เดิม + ผูก stock_lot_id ให้ S/N ที่ยัง available/rented';

    public function handle(): int
    {
        $isDryRun = (bool) $this->option('dry-run');
        $asOf = $this->option('as-of') ? now()->parse($this->option('as-of')) : now();

        $companyIds = $this->option('company')
            ? [(int) $this->option('company')]
            : Company::pluck('id')->all();

        $totalLots = 0;
        $totalValue = 0.0;
        $totalEstimated = 0;
        $totalSerialsLinked = 0;
        $totalSerialsUnlinked = 0;
        $drift = [];

        foreach ($companyIds as $companyId) {
            $this->info("บริษัท #{$companyId}");

            DB::transaction(function () use (
                $companyId, $asOf, $isDryRun,
                &$totalLots, &$totalValue, &$totalEstimated, &$totalSerialsLinked, &$totalSerialsUnlinked, &$drift
            ) {
                $balances = StockBalance::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('qty', '>', 0)
                    ->get();

                $lotsByProductWarehouse = []; // "product_id:warehouse_id" => StockLot

                foreach ($balances as $balance) {
                    $alreadyBackfilled = StockLot::withoutGlobalScopes()
                        ->where('company_id', $companyId)
                        ->where('product_id', $balance->product_id)
                        ->where('warehouse_id', $balance->warehouse_id)
                        ->where('source_type', 'opening_balance')
                        ->exists();
                    if ($alreadyBackfilled) continue;

                    [$unitCost, $isEstimated] = $this->legacyAverageCost($balance->product_id, $companyId);

                    $this->line(sprintf(
                        '  ล็อตยกมา: product_id=%d warehouse_id=%d qty=%s unit_cost=%s%s',
                        $balance->product_id, $balance->warehouse_id, $balance->qty, $unitCost,
                        $isEstimated ? ' (ประมาณการ)' : '',
                    ));

                    $totalLots++;
                    $totalValue += $unitCost * $balance->qty;
                    if ($isEstimated) $totalEstimated++;

                    if (!$isDryRun) {
                        $lot = StockLot::create([
                            'company_id' => $companyId,
                            'product_id' => $balance->product_id,
                            'warehouse_id' => $balance->warehouse_id,
                            'goods_receipt_item_id' => null,
                            'unit_cost' => round($unitCost, 2),
                            'qty_received' => $balance->qty,
                            'qty_remaining' => $balance->qty,
                            'source_type' => 'opening_balance',
                            'reference_number' => 'OPENING-BALANCE',
                            'received_at' => $asOf,
                            'cost_is_estimated' => $isEstimated,
                            'note' => 'ล็อตยกมาจากการเริ่มใช้ระบบ FIFO (สร้างโดย stock:backfill-lots เมื่อ ' . now()->toDateTimeString() . ')',
                        ]);
                        $lotsByProductWarehouse["{$balance->product_id}:{$balance->warehouse_id}"] = $lot;
                    }
                }

                // ผูก S/N ที่ยังไม่มี stock_lot_id เข้ากับล็อตยกมาของ (product, warehouse) เดียวกัน
                $serials = ProductSerial::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->whereIn('status', ['available', 'rented'])
                    ->whereNull('stock_lot_id')
                    ->get();

                foreach ($serials as $serial) {
                    $warehouseId = $serial->warehouse_id ?? Warehouse::resolveFor($companyId);
                    $key = "{$serial->product_id}:{$warehouseId}";
                    $lot = $lotsByProductWarehouse[$key] ?? null;

                    if (!$lot && !$isDryRun) {
                        // 🛡️ มี serial ค้างแต่ไม่มี StockBalance คู่กัน (ข้อมูล drift เดิม) — สร้างล็อตเฉพาะกิจ
                        [$unitCost, $isEstimated] = $this->legacyAverageCost($serial->product_id, $companyId);
                        $lot = StockLot::create([
                            'company_id' => $companyId,
                            'product_id' => $serial->product_id,
                            'warehouse_id' => $warehouseId,
                            'unit_cost' => round($unitCost, 2),
                            'qty_received' => 1,
                            'qty_remaining' => 1,
                            'source_type' => 'opening_balance',
                            'reference_number' => 'OPENING-BALANCE-DRIFT',
                            'received_at' => $asOf,
                            'cost_is_estimated' => $isEstimated,
                            'note' => 'ล็อตเฉพาะกิจ: พบ S/N ที่ไม่มี StockBalance.qty คู่กัน (drift ข้อมูลเดิม)',
                        ]);
                        $lotsByProductWarehouse[$key] = $lot;
                        $drift[] = "S/N {$serial->serial_number} (product_id={$serial->product_id}) ไม่มี StockBalance คู่กัน — สร้างล็อตเฉพาะกิจให้แล้ว";
                    }

                    if ($lot) {
                        $totalSerialsLinked++;
                        if (!$isDryRun) $serial->update(['stock_lot_id' => $lot->id]);
                    } else {
                        $totalSerialsUnlinked++;
                    }
                }

                if ($isDryRun) {
                    // 🛡️ dry-run ต้องไม่เขียนอะไรลง DB จริง — ย้อนทุกอย่างกลับเสมอ
                    DB::rollBack();
                }
            });
        }

        $this->newLine();
        $this->info(($isDryRun ? '[DRY RUN] ' : '') . "สร้างล็อตทั้งหมด {$totalLots} ล็อต มูลค่ารวม " . number_format($totalValue, 2) . " บาท");
        $this->info("ผูก S/N สำเร็จ {$totalSerialsLinked} ชิ้น, ผูกไม่ได้ {$totalSerialsUnlinked} ชิ้น");
        $this->info("ล็อตที่ใช้ต้นทุนประมาณการ (ไม่มีประวัติรับสินค้าจริง): {$totalEstimated} ล็อต");

        if (!empty($drift)) {
            $this->warn('พบข้อมูล drift ' . count($drift) . ' รายการ:');
            foreach ($drift as $line) $this->line("  - {$line}");
        }

        return self::SUCCESS;
    }

    /** สูตรเดิมเป๊ะจาก ReportController::averageCostByProduct() แต่จำกัดแค่สินค้าเดียว + fallback เป็น products.price */
    private function legacyAverageCost(int $productId, int $companyId): array
    {
        $row = GoodsReceiptItem::withoutGlobalScopes()
            ->whereHas('goodsReceipt', fn ($q) => $q->where('company_id', $companyId)->where('status', '!=', 'Cancelled'))
            ->where('product_id', $productId)
            ->whereNotNull('unit_price')
            ->selectRaw('SUM(quantity * unit_price) as total_cost, SUM(quantity) as total_qty')
            ->first();

        if ($row && (float) $row->total_qty > 0) {
            return [round((float) $row->total_cost / (float) $row->total_qty, 2), false];
        }

        $product = Product::withoutGlobalScopes()->find($productId);
        if ($product && (float) $product->price > 0) {
            return [(float) $product->price, true];
        }

        return [0.0, true];
    }
}
