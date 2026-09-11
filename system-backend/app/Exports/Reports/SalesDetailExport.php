<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class SalesDetailExport implements FromCollection, WithHeadings, WithMapping
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
        return ['เลขที่เอกสาร', 'ประเภท', 'วันที่ออกเอกสาร', 'ลูกค้า', 'สถานะ', 'ยอดรวม'];
    }

    public function map($doc): array
    {
        return [
            $doc->document_number,
            $doc->document_type,
            $doc->issue_date,
            $doc->contact->business_name ?? $doc->contact->contact_person_name ?? '-',
            $doc->status,
            (float) $doc->grand_total,
        ];
    }
}
