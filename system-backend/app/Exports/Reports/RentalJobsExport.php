<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class RentalJobsExport implements FromCollection, WithHeadings, WithMapping
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
        return ['ชื่องานเช่า', 'ลูกค้า', 'สถานะ', 'วันเริ่ม', 'วันสิ้นสุด', 'รายได้'];
    }

    public function map($row): array
    {
        $job = $row['job'];
        return [
            $job->name,
            $job->contact->business_name ?? $job->contact->contact_person_name ?? '-',
            $job->status,
            $job->start_date?->format('d/m/Y'),
            $job->end_date?->format('d/m/Y'),
            (float) $row['revenue'],
        ];
    }
}
