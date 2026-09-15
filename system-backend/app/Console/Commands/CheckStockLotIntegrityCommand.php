<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\ProductSerial;
use App\Models\StockBalance;
use App\Models\StockLot;
use App\Models\StockLotConsumption;
use Illuminate\Console\Command;

/**
 * 🆕 เครื่องมือตรวจสุขภาพชั้นข้อมูลล็อตต้นทุน FIFO — ใช้ตอน cutover (หลัง stock:backfill-lots) และเป็น
 * เครื่องมือ debug ถาวรหลังจากนั้น ไม่แก้ไขข้อมูลใดๆ แค่รายงาน
 *
 * รัน: php artisan stock:check-lot-integrity [--company=]
 */
class CheckStockLotIntegrityCommand extends Command
{
    protected $signature = 'stock:check-lot-integrity {--company= : จำกัดเฉพาะ company_id นี้ (ไม่ระบุ = ทุกบริษัท)}';

    protected $description = 'ตรวจว่า StockBalance.qty ตรงกับ SUM(stock_lots.qty_remaining) หรือไม่ + จุดผิดปกติอื่นๆ ของชั้นล็อต';

    public function handle(): int
    {
        $companyIds = $this->option('company')
            ? [(int) $this->option('company')]
            : Company::pluck('id')->all();

        $hasIssue = false;

        foreach ($companyIds as $companyId) {
            $this->info("บริษัท #{$companyId}");

            // 1) StockBalance.qty ต้องเท่ากับ SUM(qty_remaining) ของล็อตที่ (product, warehouse) เดียวกัน
            $balances = StockBalance::withoutGlobalScopes()->where('company_id', $companyId)->get();
            $lotSums = StockLot::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->selectRaw('product_id, warehouse_id, SUM(qty_remaining) as total_remaining')
                ->groupBy('product_id', 'warehouse_id')
                ->get()
                ->keyBy(fn ($r) => "{$r->product_id}:{$r->warehouse_id}");

            $driftCount = 0;
            foreach ($balances as $balance) {
                $key = "{$balance->product_id}:{$balance->warehouse_id}";
                $lotQty = (float) ($lotSums[$key]->total_remaining ?? 0);
                if (abs($lotQty - (float) $balance->qty) > 0.001) {
                    $driftCount++;
                    $this->warn("  drift: product_id={$balance->product_id} warehouse_id={$balance->warehouse_id} StockBalance.qty={$balance->qty} SUM(qty_remaining)={$lotQty}");
                }
            }
            if ($driftCount === 0) {
                $this->info('  StockBalance.qty ตรงกับ SUM(qty_remaining) ทุกแถว');
            } else {
                $hasIssue = true;
            }

            // 2) available/rented serial ที่ยังไม่มี stock_lot_id
            $unlinkedSerials = ProductSerial::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereIn('status', ['available', 'rented'])
                ->whereNull('stock_lot_id')
                ->count();
            if ($unlinkedSerials > 0) {
                $this->warn("  พบ S/N สถานะ available/rented ที่ยังไม่มี stock_lot_id: {$unlinkedSerials} รายการ");
                $hasIssue = true;
            }

            // 3) ล็อตที่ qty_remaining ผิดช่วง (ติดลบ หรือมากกว่า qty_received)
            $badLots = StockLot::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where(fn ($q) => $q->where('qty_remaining', '<', 0)->orWhereColumn('qty_remaining', '>', 'qty_received'))
                ->count();
            if ($badLots > 0) {
                $this->warn("  พบล็อตที่ qty_remaining ผิดช่วง (ติดลบ หรือมากกว่า qty_received): {$badLots} ล็อต");
                $hasIssue = true;
            }

            // 4) shortfall ที่ยังไม่ถูก reverse (เคยขายเกินที่ล็อตมี)
            $openShortfalls = StockLotConsumption::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('is_shortfall', true)
                ->whereNull('reversed_at')
                ->count();
            if ($openShortfalls > 0) {
                $this->warn("  พบรายการตัดล็อตแบบ shortfall (ล็อตไม่พอ ใช้ต้นทุนสำรอง) ที่ยังไม่ถูกคืน: {$openShortfalls} รายการ");
                $hasIssue = true;
            }
        }

        $this->newLine();
        if ($hasIssue) {
            $this->warn('พบความผิดปกติข้างต้น — ตรวจสอบก่อนเปิดใช้งานการตัดจ่ายแบบ FIFO จริง');
        } else {
            $this->info('ไม่พบความผิดปกติ — ชั้นข้อมูลล็อตต้นทุนสอดคล้องกับ StockBalance ทุกจุด');
        }

        return self::SUCCESS;
    }
}
