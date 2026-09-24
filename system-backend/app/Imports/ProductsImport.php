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

    // 🆕 [2026-09-24] เก็บ instance ของทั้ง 2 sheet ไว้ที่นี่ (เดิมสร้างสดใน sheets()) เพื่อให้ (1) sheet Serial Numbers รู้ว่า SKU ไหนเป็น
    // "สินค้าใหม่ที่เพิ่งสร้างในรอบนี้" (SKU เดิมที่มีอยู่แล้วต้องข้ามทั้งแถวและทั้ง S/N) และ (2) controller ดึงตัวเลขสรุป (สร้างกี่รายการ
    // ข้าม SKU ไหนบ้าง) ไปแจ้งผู้ใช้ได้
    private MasterProductSheetImport $productSheet;
    private MasterSerialSheetImport $serialSheet;

    // 🚀 รับ import batch id (ถ้ามี) มาผูกกับทุกแถวสินค้า/สต็อกที่สร้างในรอบนี้ ให้ "ยกเลิกการนำเข้าล่าสุด"
    // ย้อนกลับได้ — ดู ProductExcelController::importMaster()
    public function __construct(?int $importBatchId = null, ?PendingImportReceipt $pendingReceipt = null)
    {
        $this->importBatchId = $importBatchId;
        $this->pendingReceipt = $pendingReceipt;
        $this->productSheet = new MasterProductSheetImport($importBatchId, $pendingReceipt);
        $this->serialSheet = new MasterSerialSheetImport($importBatchId, $pendingReceipt, $this->productSheet);
    }

    public function sheets(): array
    {
        return [
            // 🚀 อ่านชีทหน้าแรกซ้ายสุดเสมอ (รับประกันว่ามีแน่นอน 100%)
            0 => $this->productSheet,

            // 🚀 อ่านชีท S/N (ถ้าพี่แม็คอัปโหลดไฟล์หน้าเดียว มันจะข้ามบรรทัดนี้ไปอย่างปลอดภัย ไม่พัง!)
            'Serial Numbers' => $this->serialSheet,
        ];
    }

    // จำนวนสินค้าที่ "สร้างใหม่" ในรอบนี้
    public function createdCount(): int
    {
        return $this->productSheet->createdCount;
    }

    // SKU ที่มีอยู่แล้วในระบบ จึงถูกข้ามทั้งแถว (ไม่แตะข้อมูล/สต๊อก/S/N เดิมเลย)
    public function skippedExistingSkus(): array
    {
        return $this->productSheet->skippedExistingSkus;
    }

    public function onUnknownSheet($sheetName)
    {
        Log::info("นำเข้าสินค้าใหม่: ไม่มีชีทชื่อ " . $sheetName . " (ข้ามการทำงานอย่างปลอดภัย)");
    }
}
