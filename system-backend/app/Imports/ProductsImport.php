<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Illuminate\Support\Facades\Log;
use App\Services\PendingImportReceipt;

class ProductsImport implements WithMultipleSheets, SkipsUnknownSheets
{
    private ?int $importBatchId;

    // 💰 instance เดียวที่ thread ให้ทั้ง sheet หลักและ sheet Serial Numbers ใช้ร่วมกัน เพื่อให้แถวที่มีต้นทุน
    // จากทั้งสอง sheet ในไฟล์เดียวกันรวมอยู่ในใบรับสินค้าใบเดียวกัน — ดู ProductExcelController::importMaster()
    private ?PendingImportReceipt $pendingReceipt;

    // 🚀 รับ import batch id (ถ้ามี) มาผูกกับทุกแถวสินค้า/สต็อกที่สร้างในรอบนี้ ให้ "ยกเลิกการนำเข้าล่าสุด"
    // ย้อนกลับได้ — ดู ProductExcelController::importMaster()
    public function __construct(?int $importBatchId = null, ?PendingImportReceipt $pendingReceipt = null)
    {
        $this->importBatchId = $importBatchId;
        $this->pendingReceipt = $pendingReceipt;
    }

    public function sheets(): array
    {
        return [
            // 🚀 อ่านชีทหน้าแรกซ้ายสุดเสมอ (รับประกันว่ามีแน่นอน 100%)
            0 => new MasterProductSheetImport($this->importBatchId, $this->pendingReceipt),

            // 🚀 อ่านชีท S/N (ถ้าพี่แม็คอัปโหลดไฟล์หน้าเดียว มันจะข้ามบรรทัดนี้ไปอย่างปลอดภัย ไม่พัง!)
            'Serial Numbers' => new MasterSerialSheetImport($this->importBatchId, $this->pendingReceipt),
        ];
    }

    public function onUnknownSheet($sheetName)
    {
        Log::info("นำเข้าสินค้าใหม่: ไม่มีชีทชื่อ " . $sheetName . " (ข้ามการทำงานอย่างปลอดภัย)");
    }
}
