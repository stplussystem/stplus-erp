<?php

namespace App\Exports\Reports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class AssetListExport implements FromCollection, WithHeadings, WithMapping
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
        return ['ชื่อสินทรัพย์', 'หมวดหมู่', 'S/N / ทะเบียน', 'วันที่ซื้อ', 'มูลค่า/ราคา', 'ผู้รับผิดชอบ', 'สถานะ', 'กำหนดบำรุงถัดไป', 'หมายเหตุ'];
    }

    public function map($row): array
    {
        $statusLabel = ['active' => 'ใช้งานปกติ', 'maintenance' => 'กำลังซ่อมบำรุง', 'retired' => 'เลิกใช้งาน'];

        return [
            $row->name,
            $row->category ?? '-',
            $row->serial_number ?? '-',
            $row->purchase_date?->format('d/m/Y') ?? '-',
            $row->price !== null ? (float) $row->price : '-',
            $row->responsibleUser->name ?? '-',
            $statusLabel[$row->status] ?? $row->status,
            $row->next_maintenance_date?->format('d/m/Y') ?? '-',
            $row->note ?? '',
        ];
    }
}
