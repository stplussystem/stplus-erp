<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class RepairTurnaroundExport implements FromCollection, WithHeadings, WithMapping
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
        return ['เลขที่ใบซ่อม', 'ลูกค้า', 'รับเครื่อง', 'คืนเครื่อง', 'จำนวนวัน', 'ค่าซ่อม'];
    }

    public function map($row): array
    {
        $ticket = $row['ticket'];
        return [
            $ticket->ticket_number,
            $ticket->contact->business_name ?? $ticket->contact->contact_person_name ?? '-',
            $ticket->received_at?->format('d/m/Y'),
            $ticket->returned_at?->format('d/m/Y'),
            (int) $row['turnaround_days'],
            (float) $ticket->repair_cost,
        ];
    }
}
