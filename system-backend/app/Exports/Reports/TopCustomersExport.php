<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class TopCustomersExport implements FromCollection, WithHeadings, WithMapping
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
        return ['ลูกค้า', 'จำนวนเอกสาร', 'ยอดซื้อรวม'];
    }

    public function map($row): array
    {
        return [
            $row->contact->business_name ?? $row->contact->contact_person_name ?? '-',
            (int) $row->document_count,
            (float) $row->total_amount,
        ];
    }
}
