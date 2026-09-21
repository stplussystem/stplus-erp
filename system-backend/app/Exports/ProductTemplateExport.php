<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ProductTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        return [
            // ชีท 1: ข้อมูลสินค้าใหม่
            new \App\Exports\Sheets\TemplateDataSheet(),
            // ชีท 2: ข้อมูล S/N สำหรับสินค้าใหม่
            new \App\Exports\Sheets\TemplateSerialSheet(),
        ];
    }
}
