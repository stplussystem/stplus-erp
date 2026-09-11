<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class InventoryExport implements WithMultipleSheets
{
    protected $isTemplate;
    protected $products;

    // ✅ ปรับ Constructor ให้รับค่าเหมือนเดิมของ ProductsExport
    public function __construct($isTemplate = false, $products = null)
    {
        $this->isTemplate = $isTemplate;
        $this->products = $products;
    }

    public function sheets(): array
    {
        return [
            new \App\Exports\Sheets\InventoryDataSheet($this->products),
            new \App\Exports\Sheets\InventorySerialSheet($this->products),
        ];
    }
}
