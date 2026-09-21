<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class FrequentlyRepairedProductsExport implements FromCollection, WithHeadings, WithMapping
{
    protected $rows;

    public function __construct($rows)
    {
        $this->rows = $rows;
    }

    public function collection()
    {
        return $this->rows;
    }

    public function headings(): array
    {
        return ['สินค้า', 'SKU', 'จำนวนครั้งที่ซ่อม', 'ค่าซ่อมรวม'];
    }

    public function map($row): array
    {
        return [
            $row->product->name ?? '-',
            $row->product->sku ?? '-',
            (int) $row->repair_count,
            (float) $row->total_cost,
        ];
    }
}
