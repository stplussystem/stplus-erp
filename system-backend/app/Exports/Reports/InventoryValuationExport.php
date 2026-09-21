<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class InventoryValuationExport implements FromCollection, WithHeadings, WithMapping
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
        return ['สินค้า', 'SKU', 'หมวดหมู่', 'คงเหลือ', 'จองแล้ว', 'พร้อมใช้จริง', 'ต้นทุน/หน่วย', 'มูลค่าต้นทุนรวม', 'ราคาขาย/หน่วย', 'มูลค่าขายรวม'];
    }

    public function map($row): array
    {
        return [
            $row->product->name,
            $row->product->sku,
            $row->product->category->name ?? '-',
            $row->qty,
            $row->reserved_qty,
            $row->available_qty,
            $row->avg_cost ?? '-',
            $row->cost_value ?? '-',
            (float) $row->product->price,
            $row->sale_value,
        ];
    }
}
