<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class CompanyMarginTrendExport implements FromCollection, WithHeadings, WithMapping
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
        return ['เดือน', 'ยอดขาย', 'ต้นทุน', 'กำไรขั้นต้น'];
    }

    public function map($row): array
    {
        return [
            $row['month'],
            (float) $row['sale_amount'],
            (float) $row['cost_amount'],
            (float) $row['margin_amount'],
        ];
    }
}
