<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Illuminate\Support\Collection;

class PoBackorderExport implements FromCollection, WithHeadings, WithMapping
{
    protected $rows;

    public function __construct($rows)
    {
        // แตกแถว PO ที่มีหลายสินค้าค้างรับ ให้เป็น 1 แถว Excel ต่อ 1 สินค้า
        $this->rows = collect($rows)->flatMap(function ($po) {
            return collect($po['items'])->map(fn($item) => (object) [
                'po_number' => $po['po_number'],
                'contact' => $po['contact'],
                'status' => $po['status'],
                'product' => $item['product'],
                'ordered_qty' => $item['ordered_qty'],
                'received_qty' => $item['received_qty'],
                'backorder_qty' => $item['backorder_qty'],
            ]);
        });
    }

    public function collection()
    {
        return $this->rows;
    }

    public function headings(): array
    {
        return ['เลขที่ PO', 'ซัพพลายเออร์', 'สถานะ', 'สินค้า', 'สั่งซื้อ', 'รับแล้ว', 'ค้างรับ'];
    }

    public function map($row): array
    {
        return [
            $row->po_number,
            $row->contact->business_name ?? $row->contact->contact_person_name ?? '-',
            $row->status,
            $row->product->name ?? '-',
            (float) $row->ordered_qty,
            (float) $row->received_qty,
            (float) $row->backorder_qty,
        ];
    }
}
