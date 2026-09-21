<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class SalesMarginExport implements FromCollection, WithHeadings, WithMapping
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
        return ['สินค้า', 'รหัสสินค้า', 'จำนวนที่ขาย', 'ยอดขาย', 'ต้นทุน', 'กำไรขั้นต้น', 'กำไรขั้นต้น (%)'];
    }

    public function map($row): array
    {
        return [
            $row['product']->name ?? '-',
            $row['product']->sku ?? '-',
            (float) $row['qty'],
            (float) $row['sale_amount'],
            $row['cost_amount'] !== null ? (float) $row['cost_amount'] : '-',
            $row['margin_amount'] !== null ? (float) $row['margin_amount'] : '-',
            $row['margin_pct'] !== null ? (float) $row['margin_pct'] : '-',
        ];
    }
}
