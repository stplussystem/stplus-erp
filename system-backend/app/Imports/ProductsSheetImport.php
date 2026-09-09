<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Concerns\WithChunkReading; // 🛡️
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProductsSheetImport implements ToCollection, WithStartRow, WithChunkReading
{
    private int $companyId;
    private int $warehouseId;
    private ?int $importBatchId;

    // 🛡️ นับผลจริงของการนำเข้า ให้ ProductExcelController::importAdjust() เอาไปสร้างข้อความแจ้งเตือนที่
    // สะท้อนความจริง — เดิมไม่มีการนับเลย ทำให้ตอบ "สำเร็จ" แบบ static เสมอแม้ไม่มีแถวไหนถูกประมวลผลจริง
    // เช่นตอนไฟล์อ้างอิง ID สินค้าที่ไม่มีอยู่ในระบบเลย (เจอจริงตอนทดสอบกับ DB ที่ยังไม่มีสินค้า)
    public int $processedCount = 0;
    public int $skippedNotFoundCount = 0;
    public int $skippedHasSerialCount = 0;

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
    } // 🛡️

    public function collection(Collection $rows)
    {
        // 🛡️ ห่อทั้งชุด (chunk) ด้วย transaction — เดิมถ้าแถวใดกลางไฟล์ error จะเหลือ chunk ก่อนหน้าที่ commit
        // ไปแล้วค้างอยู่ครึ่งๆ กลางๆ (บาง product ถูกปรับยอดแล้ว บางตัวไม่ถูก) โดยผู้ใช้ไม่รู้ตัว
        DB::transaction(function () use ($rows) {
            foreach ($rows as $index => $row) {
                $id = trim((string)($row[0] ?? ''));
                $actualQty = trim((string)($row[13] ?? ''));

                if ($id === '' || $actualQty === '') continue;

                $product = Product::find($id);
                if (!$product) {
                    $this->skippedNotFoundCount++;
                    continue;
                }
                if ($product->has_serial_number) {
                    $this->skippedHasSerialCount++;
                    continue;
                }

                $actualQty = (int)$actualQty;
                $balance = StockBalance::lockedFor($product->id, $this->companyId, $this->warehouseId);

                $diff = $actualQty - $balance->qty;

                if ($diff !== 0) {
                    // 🛡️ เก็บค่าก่อน/หลังไว้ใน undo_meta ให้ "ยกเลิกการนำเข้าล่าสุด" คืนยอดสต็อกกลับได้แม่นยำ
                    // (type 'adjust' เก็บแค่ quantity เป็นค่าสัมบูรณ์ ไม่รู้ทิศทาง จึงต้องพึ่ง undo_meta แทน)
                    StockMovement::create([
                        'product_id' => $product->id,
                        'user_id' => auth()->id() ?? 1,
                        'type' => 'adjust',
                        'quantity' => abs($diff),
                        'reference_number' => 'ADJ-' . date('Ymd-His') . '-' . $product->id,
                        'note' => "ปรับยอด Excel (" . ($diff > 0 ? "+$diff" : $diff) . ")",
                        'company_id' => $this->companyId,
                        'warehouse_id' => $this->warehouseId,
                        'import_batch_id' => $this->importBatchId,
                        'undo_meta' => [
                            'previous_qty' => $balance->qty,
                            'new_qty' => $actualQty,
                        ],
                    ]);
                    $balance->qty = $actualQty;
                    $balance->save();
                }
                $this->processedCount++;
            }
        });
    }
}
