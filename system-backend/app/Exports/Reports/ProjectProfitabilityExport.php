<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ProjectProfitabilityExport implements FromCollection, WithHeadings, WithMapping
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
        return ['โครงการ', 'สถานะ', 'รายได้', 'ต้นทุน', 'กำไร/ขาดทุน', 'กำไร (%)'];
    }

    public function map($row): array
    {
        return [
            $row['project']->name ?? '-',
            $row['project']->status ?? '-',
            (float) $row['revenue'],
            (float) $row['cost'],
            (float) $row['profit'],
            $row['margin_pct'] !== null ? (float) $row['margin_pct'] : '-',
        ];
    }
}
