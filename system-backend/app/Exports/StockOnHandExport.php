<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

// 🆕 ส่งออก 1 แถวต่อ "หน่วยย่อย" (S/N หรือ ล็อต) แทน 1 แถวต่อสินค้า — ให้เห็นรายละเอียดต้นทุนแต่ละหน่วยจริง
class StockOnHandExport implements FromCollection, WithHeadings, WithMapping
{
    protected $rows;

    public function __construct($rows)
    {
        // แบนแถวสินค้า (ที่มี units ซ้อนอยู่ข้างใน) ให้เป็น 1 แถวต่อ 1 หน่วยย่อย
        $this->rows = collect($rows)->flatMap(function ($row) {
            return collect($row->units)->map(fn ($unit) => (object) array_merge((array) $unit, [
                'product' => $row->product,
            ]));
        });
    }

    public function collection()
    {
        return $this->rows;
    }

    public function headings(): array
    {
        return ['สินค้า', 'SKU', 'ประเภท', 'S/N หรือ เลขล็อต', 'คลัง', 'วันที่รับเข้า', 'จำนวนคงเหลือ', 'ต้นทุน/หน่วย', 'มูลค่าต้นทุน', 'อ้างอิง', 'ต้นทุนประมาณการ'];
    }

    public function map($unit): array
    {
        $unit = (object) (array) $unit;

        return [
            $unit->product->name,
            $unit->product->sku,
            $unit->kind === 'serial' ? 'S/N' : 'ล็อต',
            $unit->kind === 'serial' ? $unit->serial_number : $unit->lot_label,
            $unit->warehouse->name ?? '-',
            optional($unit->received_at)->format('d/m/Y') ?? '-',
            $unit->qty,
            $unit->unit_cost,
            $unit->cost_value,
            $unit->reference_number ?? '-',
            $unit->cost_is_estimated ? 'ใช่' : '-',
        ];
    }
}
