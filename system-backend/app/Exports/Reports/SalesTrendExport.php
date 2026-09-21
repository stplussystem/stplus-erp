<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class SalesTrendExport implements FromCollection, WithHeadings, WithMapping
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
        return ['เดือน', 'จำนวนเอกสาร', 'ยอดขายรวม'];
    }

    public function map($row): array
    {
        return [
            $row['month'],
            (int) $row['document_count'],
            (float) $row['total_amount'],
        ];
    }
}
