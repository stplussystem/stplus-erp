<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToArray;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use App\Models\Product;
use App\Models\ProductSerial; // 🚀 แก้เส้นแดงตรงนี้ครับ!
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Services\PendingImportReceipt;

class MasterSerialSheetImport implements ToArray, WithStartRow, WithChunkReading
{
    // 🚀 ผูก batch เดียวกับ MasterProductSheetImport — ถ้าชีทนี้เติม S/N ให้สินค้าที่ "มีอยู่ก่อนแล้ว"
    // (ไม่ได้ถูกสร้างใหม่ในรอบนี้) การลบ Product ตอน undo จะไม่ครอบคลุมถึง เลยต้องแท็ก undo_meta ไว้ที่
    // stock_movement เองด้วย เพื่อให้ ProductExcelController::undoImportBatch() ย้อนสต็อก/S/N คืนได้แม่นยำ
    private ?int $importBatchId;

    // 💰 instance เดียวกับที่ MasterProductSheetImport ใช้ (share กันผ่าน ProductsImport.php) — ถ้าคอลัมน์
    // ต้นทุนต่อหน่วยของชีทนี้มีค่า จะรวมอยู่ในใบรับสินค้าใบเดียวกับ sheet หลัก
    private ?PendingImportReceipt $pendingReceipt;

    public function __construct(?int $importBatchId = null, ?PendingImportReceipt $pendingReceipt = null)
    {
        $this->importBatchId = $importBatchId;
        $this->pendingReceipt = $pendingReceipt;
    }

    public function startRow(): int
    {
        return 2;
    }
    public function chunkSize(): int
    {
        return 300;
    }

    public function array(array $rows)
    {
        $companyId = auth()->user()->company_id ?? 1;
        $defaultWarehouse = \App\Models\Warehouse::firstOrCreate(
            ['company_id' => $companyId],
            ['name' => 'คลังสินค้าหลัก (Default)']
        );

        foreach ($rows as $row) {
            $row = is_array($row) ? $row : [];
            $row = array_pad($row, 10, '');

            $sku = trim((string)$row[1]);
            $sn = trim((string)$row[2]);
            $status = trim((string)$row[3]);
            if ($status === '') $status = 'พร้อมขาย';
            // 💰 ต้นทุนต่อหน่วย (คอลัมน์ 4) — เว้นว่างได้
            $rawCost = trim((string)$row[4]);
            $costPrice = ($rawCost !== '' && is_numeric($rawCost)) ? (float)$rawCost : null;

            if ($sn === '' || $sku === '') continue;

            $product = Product::where('sku', $sku)->first();
            if (!$product || !$product->has_serial_number) continue;

            $exists = ProductSerial::where('serial_number', $sn)->exists();

            if (!$exists && $status === 'พร้อมขาย') {
                if ($costPrice !== null && $this->pendingReceipt) {
                    // 💰 มีต้นทุนกรอกมา — สร้าง/ต่อรายการในใบรับสินค้าจริง (1 หน่วย ต่อ 1 S/N) แทนการสร้าง
                    // StockMovement เปล่าๆ ตรงๆ — DirectGoodsReceiptService::addItem() จัดการ StockMovement/
                    // StockBalance ให้ครบในตัวอยู่แล้ว แต่ ProductSerial ต้องสร้างเองที่นี่ เพราะต้องผูกกับ
                    // stock_movement_id ที่เพิ่งสร้าง (service เดิมไม่รู้จัก S/N ของ MasterSerialSheetImport
                    // เพราะออกแบบมาให้รับ serials เป็น string[] ไปสร้างให้เฉยๆ — ที่นี่ใช้ pattern เดียวกับเดิม
                    // คือสร้าง ProductSerial เอง ไม่ผ่านพารามิเตอร์ serials ของ service เพื่อคุม undo_meta ได้)
                    $balance = StockBalance::firstOrCreate(
                        ['product_id' => $product->id, 'company_id' => $companyId, 'warehouse_id' => $defaultWarehouse->id],
                        ['qty' => 0]
                    );
                    $previousQty = $balance->qty;

                    $this->pendingReceipt->addItem([
                        'product_id' => $product->id,
                        'quantity' => 1,
                        'unit_price' => $costPrice,
                        'serials' => [$sn],
                    ]);
                    // undo_meta สำหรับฟีเจอร์ "ยกเลิกการนำเข้าล่าสุด" — หา StockMovement ที่เพิ่งสร้างจาก
                    // reference_number ล่าสุดของสินค้านี้ (addItem() เพิ่งสร้างไปหมาดๆ ในทรานแซกชันเดียวกัน)
                    $movement = StockMovement::where('product_id', $product->id)
                        ->where('type', 'in')
                        ->latest('id')
                        ->first();
                    $serial = ProductSerial::where('serial_number', $sn)->first();
                    if ($movement && $serial) {
                        $movement->update([
                            'import_batch_id' => $this->importBatchId,
                            'undo_meta' => [
                                'serial_created' => true,
                                'product_serial_id' => $serial->id,
                                'previous_qty' => $previousQty,
                                'new_qty' => $previousQty + 1,
                            ],
                        ]);
                    }
                } else {
                    $balance = StockBalance::firstOrCreate(
                        ['product_id' => $product->id, 'company_id' => $companyId, 'warehouse_id' => $defaultWarehouse->id],
                        ['qty' => 0]
                    );
                    $previousQty = $balance->qty;

                    $movement = StockMovement::create([
                        'product_id' => $product->id,
                        'user_id' => auth()->id() ?? 1,
                        'type' => 'in',
                        'quantity' => 1,
                        'reference_number' => 'IMP-SN-' . date('Ymd-His') . '-' . $sn,
                        'note' => "รับเข้า S/N ใหม่ ($sn)",
                        'company_id' => $companyId,
                        'warehouse_id' => $defaultWarehouse->id,
                        'import_batch_id' => $this->importBatchId,
                    ]);

                    $serial = ProductSerial::create([
                        'company_id' => $companyId,
                        'product_id' => $product->id,
                        'serial_number' => $sn,
                        'status' => 'available',
                        'stock_movement_id' => $movement->id,
                    ]);

                    $balance->increment('qty', 1);

                    // 🛡️ เก็บไว้ย้อนกลับ: S/N นี้ไม่เคยมีมาก่อน (serial_created) ตอน undo จะลบทิ้งไปเลย
                    // ไม่ใช่แค่เปลี่ยนสถานะ
                    $movement->update(['undo_meta' => [
                        'serial_created' => true,
                        'product_serial_id' => $serial->id,
                        'previous_qty' => $previousQty,
                        'new_qty' => $previousQty + 1,
                    ]]);
                }
            }
        }
    }
}
