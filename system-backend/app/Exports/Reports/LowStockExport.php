<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class LowStockExport implements FromCollection, WithHeadings, WithMapping
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
        return ['สินค้า', 'รหัสสินค้า', 'คงเหลือ', 'จองแล้ว', 'พร้อมใช้จริง', 'เกณฑ์ขั้นต่ำ', 'ขาดอีก'];
    }

    public function map($row): array
    {
        return [
            $row['product']->name ?? '-',
            $row['product']->sku ?? '-',
            (int) $row['qty'],
            (int) $row['reserved_qty'],
            (int) $row['available_qty'],
            (int) $row['threshold'],
            (int) $row['shortage'],
        ];
    }
}
