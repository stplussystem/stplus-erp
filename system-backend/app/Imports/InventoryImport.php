<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Illuminate\Support\Facades\Log;

class InventoryImport implements WithMultipleSheets, SkipsUnknownSheets
{
    private int $companyId;
    private int $warehouseId;

    public function __construct(int $companyId, int $warehouseId)
    {
        $this->companyId = $companyId;
        $this->warehouseId = $warehouseId;
    }

    public function sheets(): array
    {
        return [
            // 🚀 อ่านชีทหน้าแรกซ้ายสุดเสมอ
            0 => new ProductsSheetImport($this->companyId, $this->warehouseId),

            // 🚀 อ่านชีท S/N (ถ้าหาไม่เจอ ก็แค่ข้ามไป ไม่ Error)
            'Serial Numbers' => new SerialsSheetImport($this->companyId, $this->warehouseId),
        ];
    }

    public function onUnknownSheet($sheetName)
    {
        Log::info("ปรับปรุงสต็อก: ไม่มีชีทชื่อ " . $sheetName . " (ข้ามการทำงานอย่างปลอดภัย)");
    }
}
