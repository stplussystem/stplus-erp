<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Illuminate\Support\Facades\Log;
use App\Services\PendingImportReceipt;

class InventoryImport implements WithMultipleSheets, SkipsUnknownSheets
{
    private int $companyId;
    private int $warehouseId;
    private ?int $importBatchId;
    private ?PendingImportReceipt $pendingReceipt;

    // 🛡️ เก็บ instance ไว้ (ไม่ new ทิ้งขว้างใน sheets() เฉยๆ) เพื่อให้ ProductExcelController::importAdjust()
    // ดึงตัวนับผลลัพธ์ (processedCount ฯลฯ) ออกมาสร้างข้อความ response ที่ตรงกับความจริงได้หลัง import เสร็จ
    public ProductsSheetImport $productsSheet;

    public function __construct(int $companyId, int $warehouseId, ?int $importBatchId = null, ?PendingImportReceipt $pendingReceipt = null)
    {
        $this->companyId = $companyId;
        $this->warehouseId = $warehouseId;
        $this->importBatchId = $importBatchId;
        $this->pendingReceipt = $pendingReceipt;
        $this->productsSheet = new ProductsSheetImport($this->companyId, $this->warehouseId, $this->importBatchId, $this->pendingReceipt);
    }

    public function sheets(): array
    {
        return [
            // 🚀 อ่านชีทหน้าแรกซ้ายสุดเสมอ
            0 => $this->productsSheet,

            // 🚀 อ่านชีท S/N (ถ้าหาไม่เจอ ก็แค่ข้ามไป ไม่ Error)
            'Serial Numbers' => new SerialsSheetImport($this->companyId, $this->warehouseId, $this->importBatchId, $this->pendingReceipt),
        ];
    }

    public function onUnknownSheet($sheetName)
    {
        Log::info("ปรับปรุงสต็อก: ไม่มีชีทชื่อ " . $sheetName . " (ข้ามการทำงานอย่างปลอดภัย)");
    }
}
