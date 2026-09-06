<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ProductsExport implements WithMultipleSheets
{
    protected $isTemplate;
    protected $products;

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
