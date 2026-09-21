<?php

namespace App\Exports;

use App\Models\Contact;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

class ContactsExport extends DefaultValueBinder implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize, WithStyles, WithEvents, WithCustomValueBinder
{
    protected $isTemplate;
    protected $contacts;

    public function __construct($isTemplate = false, $contacts = null)
    {
        $this->isTemplate = $isTemplate;
        $this->contacts = $contacts;
    }

    public function collection()
    {
        if ($this->isTemplate) {
            return collect([]);
        }

        // 🚀 แก้ไขตรงนี้ครับ: นำ $this->contacts ที่รับมาจาก Controller (ซึ่งกรองมาแล้ว) ไปสร้างไฟล์ Excel
        return $this->contacts ?: Contact::orderBy('created_at', 'desc')->get();
    }

    // 🚀 ล็อกข้อมูลตอน Export ที่มี Data อยู่แล้วให้เป็น Text
    public function bindValue(Cell $cell, $value)
    {
        if (in_array($cell->getColumn(), ['A', 'G', 'I', 'K'])) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);
            return true;
        }
        return parent::bindValue($cell, $value);
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
                'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN, 'color' => ['argb' => 'FFCBD5E1']]],
            ],
        ];
    }

    public function headings(): array
    {
        return [
            'รหัสผู้ติดต่อ',
            'ชื่อธุรกิจบุคคล',
            'ประเภทผู้ติดต่อ (นิติบุคคล,บุคคลธรรมดา)',
            'เป็นลูกค้า (เลือกลูกค้า หรือ ปล่อยว่าง)',
            'เป็นผู้จำหน่าย (เลือกผู้จำหน่าย หรือ ปล่อยว่าง)',
            'เครดิตวัน',
            'เลขผู้เสียภาษี',
            'สำนักงานใหญ่/สาขา',
            'รหัสสาขา',
            'อีเมล',
            'เบอร์โทรศัพท์',
            'ที่อยู่'
        ];
    }

    public function map($contact): array
    {
        return [
            $contact->contact_code,
            $contact->business_name,
            $contact->contact_type === 'individual' ? 'บุคคลธรรมดา' : 'นิติบุคคล',
            $contact->is_customer ? 'ลูกค้า' : '',
            $contact->is_vendor ? 'ผู้จำหน่าย' : '',
            $contact->credit_days,
            $contact->tax_id,
            $contact->branch_type === 'branch' ? 'สาขา' : 'สำนักงานใหญ่',
            $contact->branch_code,
            $contact->email,
            $contact->office_phone ?: $contact->mobile,
            $contact->address,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $rowCount = 1000;

                // 🚀 1. บังคับ Format คอลัมน์ที่ต้องการให้เป็น "ข้อความ (Text)" ล่วงหน้า (แก้ปัญหา Template)
                $sheet->getStyle("A2:A{$rowCount}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
                $sheet->getStyle("G2:G{$rowCount}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
                $sheet->getStyle("I2:I{$rowCount}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
                $sheet->getStyle("K2:K{$rowCount}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);

                // 🚀 2. จัดการ Dropdown เหมือนเดิม
                $createDropdown = function ($columnLetter, $options) use ($sheet, $rowCount) {
                    $validation = $sheet->getCell($columnLetter . '2')->getDataValidation();
                    $validation->setType(DataValidation::TYPE_LIST);
                    $validation->setErrorStyle(DataValidation::STYLE_INFORMATION);
                    $validation->setAllowBlank(true);
                    $validation->setShowInputMessage(true);
                    $validation->setShowErrorMessage(true);
                    $validation->setShowDropDown(true);
                    $validation->setFormula1('"' . $options . '"');

                    $sheet->setDataValidation("{$columnLetter}2:{$columnLetter}{$rowCount}", $validation);
                };

                $createDropdown('C', 'นิติบุคคล,บุคคลธรรมดา');
                $createDropdown('D', 'ลูกค้า');
                $createDropdown('E', 'ผู้จำหน่าย');
                $createDropdown('H', 'สำนักงานใหญ่,สาขา');
            },
        ];
    }
}
