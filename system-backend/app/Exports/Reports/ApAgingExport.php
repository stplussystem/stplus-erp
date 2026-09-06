<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ApAgingExport implements FromCollection, WithHeadings, WithMapping
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
        return ['ซัพพลายเออร์', '0-30 วัน', '31-60 วัน', '61-90 วัน', 'มากกว่า 90 วัน', 'รวม'];
    }

    public function map($row): array
    {
        return [
            $row['contact']->business_name ?? $row['contact']->contact_person_name ?? '-',
            (float) $row['buckets']['b0_30'],
            (float) $row['buckets']['b31_60'],
            (float) $row['buckets']['b61_90'],
            (float) $row['buckets']['b90_plus'],
            (float) $row['total'],
        ];
    }
}
