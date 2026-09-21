<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class RepairsSummaryExport implements FromCollection, WithHeadings, WithMapping
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
        return ['เลขที่ใบซ่อม', 'ลูกค้า', 'สถานะ', 'วันที่รับเครื่อง', 'วันที่คืนเครื่อง', 'ค่าซ่อม'];
    }

    public function map($ticket): array
    {
        return [
            $ticket->ticket_number,
            $ticket->contact->business_name ?? $ticket->contact->contact_person_name ?? '-',
            $ticket->status,
            $ticket->received_at,
            $ticket->returned_at,
            (float) $ticket->repair_cost,
        ];
    }
}
