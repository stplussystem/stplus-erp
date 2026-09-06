<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class InstallationsSummaryExport implements FromCollection, WithHeadings, WithMapping
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
        return ['เลขที่งานติดตั้ง', 'ลูกค้า', 'สถานะ', 'วันที่นัดหมาย', 'วันที่ติดตั้งเสร็จ'];
    }

    public function map($record): array
    {
        return [
            $record->installation_number,
            $record->contact->business_name ?? $record->contact->contact_person_name ?? '-',
            $record->status,
            $record->scheduled_at,
            $record->installed_at,
        ];
    }
}
