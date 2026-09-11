<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class CashPositionExport implements FromCollection, WithHeadings, WithMapping
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
        return ['เดือน', 'ยอดรับ (ประมาณ)', 'ยอดจ่าย (ประมาณ)', 'สุทธิ'];
    }

    public function map($row): array
    {
        return [
            $row['month'],
            (float) $row['cash_in'],
            (float) $row['cash_out'],
            (float) $row['net'],
        ];
    }
}
