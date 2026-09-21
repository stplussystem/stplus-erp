<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class StockMovementsExport implements FromCollection, WithHeadings, WithMapping
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
        return ['วันที่', 'สินค้า', 'SKU', 'ประเภท', 'จำนวน', 'เลขที่อ้างอิง', 'หมายเหตุ', 'ผู้ทำรายการ'];
    }

    private const TYPE_LABEL = ['in' => 'รับเข้า', 'out' => 'เบิกออก', 'adjust' => 'ปรับยอด'];

    public function map($movement): array
    {
        return [
            $movement->created_at?->format('Y-m-d H:i'),
            $movement->product->name ?? '-',
            $movement->product->sku ?? '-',
            self::TYPE_LABEL[$movement->type] ?? $movement->type,
            (int) $movement->quantity,
            $movement->reference_number,
            $movement->note,
            $movement->user->name ?? '-',
        ];
    }
}
