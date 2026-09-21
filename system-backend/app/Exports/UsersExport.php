<?php

namespace App\Exports;

use App\Models\User;
use App\Models\Department;
use Spatie\Permission\Models\Role;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;

class UsersExport implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize, WithStyles, WithEvents
{
    protected $isTemplate;
    protected $users;

    public function __construct($isTemplate = false, $users = null)
    {
        $this->isTemplate = $isTemplate;
        $this->users = $users;
    }

    public function collection()
    {
        if ($this->isTemplate) {
            return collect([]);
        }
        return $this->users ?: User::with(['department', 'roles'])->latest()->get();
    }

    public function headings(): array
    {
        return [
            'ชื่อ-นามสกุล *',
            'อีเมล (Email) *',
            'รหัสผ่าน (เฉพาะตอนสร้างใหม่)',
            'ชื่อแผนก',
            'บทบาท (Role)'
        ];
    }

    public function map($user): array
    {
        return [
            $user->name,
            $user->email,
            '', // ไม่ส่งออกรหัสผ่านเพื่อความปลอดภัย
            $user->department?->name,
            $user->roles->pluck('name')->implode(', '),
        ];
    }

    public function styles(Worksheet $sheet)
    {
        $sheet->getRowDimension(1)->setRowHeight(25);
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 11],
                'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF2563EB']],
                'alignment' => [
                    'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                    'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
                ],
            ],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $rowCount = 1000;

                // 1. ความกว้างคอลัมน์
                $sheet->getColumnDimension('A')->setWidth(30);
                $sheet->getColumnDimension('B')->setWidth(30);
                $sheet->getColumnDimension('C')->setWidth(20);

                // 2. ดึงข้อมูลจาก DB มาทำ Dropdown ล่าสุด (จำกัด 255 ตัวอักษรป้องกัน Error)
                $departments = substr(Department::pluck('name')->implode(','), 0, 250);
                $roles = substr(Role::pluck('name')->implode(','), 0, 250);

                $createDropdown = function ($columnLetter, $options) use ($sheet, $rowCount) {
                    if (!$options) return;
                    $validation = $sheet->getCell($columnLetter . '2')->getDataValidation();
                    $validation->setType(DataValidation::TYPE_LIST);
                    $validation->setErrorStyle(DataValidation::STYLE_INFORMATION);
                    $validation->setAllowBlank(true);
                    $validation->setShowDropDown(true);
                    $validation->setFormula1('"' . $options . '"');
                    $sheet->setDataValidation("{$columnLetter}2:{$columnLetter}{$rowCount}", $validation);
                };

                $createDropdown('D', $departments);
                $createDropdown('E', $roles);
            },
        ];
    }
}
