<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class WarrantyExpiryExport implements FromCollection, WithHeadings, WithMapping
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
        return ['เลขที่งานติดตั้ง', 'ลูกค้า', 'สินค้า', 'สถานที่ติดตั้ง', 'วันหมดประกัน', 'สถานะ'];
    }

    public function map($row): array
    {
        $record = $row['record'];
        return [
            $record->installation_number,
            $record->contact->business_name ?? $record->contact->contact_person_name ?? '-',
            $record->product->name ?? '-',
            $record->site_name ?? '-',
            $record->warranty_expires_at?->format('d/m/Y'),
            $row['is_expired'] ? 'หมดประกันแล้ว' : 'ใกล้หมดประกัน',
        ];
    }
}
