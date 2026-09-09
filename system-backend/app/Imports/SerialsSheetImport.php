<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Concerns\WithChunkReading; // 🛡️ เสริมเกราะกันล่ม
use App\Models\Product;
use App\Models\ProductSerial;
use App\Models\StockBalance;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SerialsSheetImport implements ToCollection, WithStartRow, WithChunkReading
{
    private int $companyId;
    private int $warehouseId;
    private ?int $importBatchId;

    public function __construct(int $companyId, int $warehouseId, ?int $importBatchId = null)
    {
        $this->companyId = $companyId;
        $this->warehouseId = $warehouseId;
        $this->importBatchId = $importBatchId;
    }

    public function startRow(): int
    {
        return 2;
    }
    public function chunkSize(): int
    {
        return 300;
    } // 🛡️ ทำงานทีละ 300 บรรทัด (กัน Ram เต็ม)

    public function collection(Collection $rows)
    {
        // 🛡️ ห่อทั้งชุด (chunk) ด้วย transaction เหมือน ProductsSheetImport — กันไฟล์ error กลางทาง
        // เหลือ chunk ก่อนหน้าที่ปรับสต็อก/สร้าง S/N ไปแล้วค้างอยู่ครึ่งๆ กลางๆ
        DB::transaction(function () use ($rows) {
        foreach ($rows as $row) {
            $productId = trim((string)($row[0] ?? ''));
            $sku = trim((string)($row[1] ?? ''));
            $sn = trim((string)($row[3] ?? ''));
            $status = trim((string)($row[4] ?? 'พร้อมขาย')); // อ่านค่า Dropdown

            if ($sn === '') continue;

            $product = null;
            if ($productId !== '') {
                $product = Product::find($productId);
            } elseif ($sku !== '') {
                $product = Product::where('sku', $sku)->first();
            }

            if (!$product || !$product->has_serial_number) continue;

            $serialRecord = ProductSerial::where('product_id', $product->id)
                ->where('serial_number', $sn)
                ->first();

            // 🟢 กรณีเพิ่ม S/N ใหม่ที่ไม่มีในระบบ
            if (!$serialRecord) {
                if ($status === 'พร้อมขาย') {
                    $balance = StockBalance::lockedFor($product->id, $this->companyId, $this->warehouseId);
                    $previousQty = $balance->qty;

                    $movement = StockMovement::create([
                        'product_id' => $product->id,
                        'user_id' => auth()->id() ?? 1,
                        'type' => 'adjust',
                        'quantity' => 1,
                        'reference_number' => 'ADJ-SN-ADD-' . date('Ymd-His') . '-' . $sn,
                        'note' => "เพิ่ม S/N ใหม่จากการอัปโหลด ($sn)",
                        'company_id' => $this->companyId,
                        'warehouse_id' => $this->warehouseId,
                        'import_batch_id' => $this->importBatchId,
                    ]);
                    $serialRecord = ProductSerial::create([
                        'company_id' => $this->companyId,
                        'warehouse_id' => $this->warehouseId,
                        'product_id' => $product->id,
                        'serial_number' => $sn,
                        'status' => 'available',
                        'stock_movement_id' => $movement->id,
                    ]);
                    $balance->qty += 1;
                    $balance->save();

                    // 🛡️ S/N นี้ไม่เคยมีมาก่อน — undo จะลบทิ้งไปเลย ไม่ใช่แค่คืนสถานะ
                    $movement->update(['undo_meta' => [
                        'serial_created' => true,
                        'product_serial_id' => $serialRecord->id,
                        'previous_qty' => $previousQty,
                        'new_qty' => $previousQty + 1,
                    ]]);
                }
            } else {
                // 🔴 กรณีมี S/N เดิม แต่แจ้งว่า ชำรุด/สูญหาย ใน Dropdown
                if (in_array($status, ['ชำรุด', 'สูญหาย']) && $serialRecord->status === 'available') {
                    $balance = StockBalance::lockedFor($product->id, $this->companyId, $this->warehouseId);
                    $previousQty = $balance->qty;
                    $previousStatus = $serialRecord->status;

                    $movement = StockMovement::create([
                        'product_id' => $product->id,
                        'user_id' => auth()->id() ?? 1,
                        'type' => 'adjust',
                        'quantity' => 1,
                        'reference_number' => 'ADJ-SN-DEL-' . date('Ymd-His') . '-' . $sn,
                        'note' => "ตัด S/N ($sn) สถานะถูกปรับเป็น: $status",
                        'company_id' => $this->companyId,
                        'warehouse_id' => $this->warehouseId,
                        'import_batch_id' => $this->importBatchId,
                    ]);

                    // แปลงไทยกลับเป็นอังกฤษ เพื่อบันทึกลง DB
                    $dbStatus = $status === 'ชำรุด' ? 'defective' : 'lost';

                    $serialRecord->update([
                        'status' => $dbStatus,
                        'stock_movement_id' => $movement->id
                    ]);

                    $newQty = $previousQty;
                    if ($balance->qty > 0) {
                        $balance->qty -= 1; // หักสต็อก 1 ตัว
                        $balance->save();
                        $newQty = $balance->qty;
                    }

                    // 🛡️ เก็บสถานะ/จำนวนก่อนหน้าไว้ ให้ undo คืนสถานะ S/N + สต็อกกลับได้แม่นยำ
                    $movement->update(['undo_meta' => [
                        'product_serial_id' => $serialRecord->id,
                        'previous_status' => $previousStatus,
                        'new_status' => $dbStatus,
                        'previous_qty' => $previousQty,
                        'new_qty' => $newQty,
                    ]]);
                }
            }
        }
        });
    }
}
