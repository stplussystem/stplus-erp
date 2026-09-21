<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class SupplierPriceComparisonExport implements FromCollection, WithHeadings, WithMapping
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
        return ['ซัพพลายเออร์', 'จำนวนครั้งที่รับ', 'จำนวนรวม', 'ราคาเฉลี่ยต่อหน่วย'];
    }

    public function map($row): array
    {
        return [
            $row['contact']->business_name ?? $row['contact']->contact_person_name ?? '-',
            (int) $row['receipt_count'],
            (float) $row['total_qty'],
            $row['avg_unit_price'] !== null ? (float) $row['avg_unit_price'] : '-',
        ];
    }
}
