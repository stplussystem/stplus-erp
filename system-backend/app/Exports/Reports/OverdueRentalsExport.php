<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class OverdueRentalsExport implements FromCollection, WithHeadings, WithMapping
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
        return ['S/N', 'สินค้า', 'ลูกค้า', 'งานเช่า', 'วันครบกำหนดคืน', 'จำนวนวันที่เกินกำหนด'];
    }

    public function map($row): array
    {
        return [
            $row['serial']->serial_number,
            $row['serial']->product->name ?? '-',
            $row['contact']->business_name ?? $row['contact']->contact_person_name ?? '-',
            $row['rental_job']->name ?? '-',
            $row['rental_job']->end_date?->format('d/m/Y'),
            (int) $row['days_overdue'],
        ];
    }
}
