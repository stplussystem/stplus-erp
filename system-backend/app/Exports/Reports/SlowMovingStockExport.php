<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class SlowMovingStockExport implements FromCollection, WithHeadings, WithMapping
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
        return ['สินค้า', 'รหัสสินค้า', 'คงเหลือ', 'เบิกออกล่าสุด', 'จำนวนวันที่ค้าง'];
    }

    public function map($row): array
    {
        return [
            $row['product']->name ?? '-',
            $row['product']->sku ?? '-',
            (float) $row['qty'],
            $row['last_out_at'] ? \Carbon\Carbon::parse($row['last_out_at'])->format('d/m/Y') : 'ไม่เคยเบิกออก',
            $row['days_since_out'] !== null ? (int) $row['days_since_out'] : '-',
        ];
    }
}
