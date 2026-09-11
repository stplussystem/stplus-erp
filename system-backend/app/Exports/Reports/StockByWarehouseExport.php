<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class StockByWarehouseExport implements FromCollection, WithHeadings, WithMapping
{
    protected $rows;

    public function __construct($rows)
    {
        // แตกแถวคลังที่มีหลายสินค้า ให้เป็น 1 แถว Excel ต่อ 1 สินค้า
        $this->rows = collect($rows)->flatMap(function ($warehouse) {
            return collect($warehouse['items'])->map(fn($item) => (object) [
                'warehouse' => $warehouse['warehouse'],
                'product' => $item['product'],
                'qty' => $item['qty'],
                'reserved_qty' => $item['reserved_qty'],
                'available_qty' => $item['available_qty'],
            ]);
        });
    }

    public function collection()
    {
        return $this->rows;
    }

    public function headings(): array
    {
        return ['คลังสินค้า', 'สินค้า', 'รหัสสินค้า', 'คงเหลือ', 'จองแล้ว', 'พร้อมใช้จริง'];
    }

    public function map($row): array
    {
        return [
            $row->warehouse->name ?? '-',
            $row->product->name ?? '-',
            $row->product->sku ?? '-',
            (float) $row->qty,
            (float) $row->reserved_qty,
            (float) $row->available_qty,
        ];
    }
}
