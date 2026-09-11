<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class StockMovementLedgerExport implements FromCollection, WithHeadings, WithMapping
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
        return ['วันที่', 'สินค้า', 'คลัง', 'ประเภท', 'จำนวน', 'เลขที่อ้างอิง', 'ผู้ทำรายการ'];
    }

    public function map($row): array
    {
        return [
            $row->created_at?->format('d/m/Y H:i'),
            $row->product->name ?? '-',
            $row->warehouse->name ?? '-',
            $row->type,
            (int) $row->quantity,
            $row->reference_number ?? '-',
            $row->user->name ?? '-',
        ];
    }
}
