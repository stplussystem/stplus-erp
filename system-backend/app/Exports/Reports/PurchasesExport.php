<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class PurchasesExport implements FromCollection, WithHeadings, WithMapping
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
        return ['เลขที่ PO', 'วันที่', 'ผู้ขาย', 'สถานะ', 'ยอดรวม'];
    }

    public function map($po): array
    {
        return [
            $po->po_number,
            $po->created_at?->format('Y-m-d'),
            $po->contact->business_name ?? $po->contact->contact_person_name ?? '-',
            $po->status,
            (float) $po->grand_total,
        ];
    }
}
