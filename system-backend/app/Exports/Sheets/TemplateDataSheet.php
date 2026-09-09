<?php

namespace App\Exports\Sheets;

use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;

class TemplateDataSheet extends DefaultValueBinder implements WithTitle, WithHeadings, WithEvents, WithCustomValueBinder
{
    public function title(): string
    {
        return 'Template เพิ่มสินค้าใหม่';
    }

    public function bindValue(Cell $cell, $value)
    {
        if (in_array($cell->getColumn(), ['A', 'C', 'D'])) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);
            return true;
        }
        return parent::bindValue($cell, $value);
    }

    public function headings(): array
    {
        // 🚀 [เพิ่มใหม่] "ต้นทุนต่อหน่วย" ต่อท้ายสุด (คอลัมน์ O) — เว้นว่างได้ ถ้ากรอกมาระบบจะสร้างใบรับสินค้า
        // อัตโนมัติให้ (ดู MasterProductSheetImport.php) เพื่อให้ต้นทุนถัวเฉลี่ยของสินค้าคำนวณได้ถูกต้อง —
        // เพิ่มต่อท้ายเท่านั้น ห้ามแทรกกลาง กัน index คอลัมน์เดิม (0-13) ที่ importer พึ่งพาอยู่เลื่อน
        return ['ID (เว้นว่าง)', 'ประเภทสินค้า', 'SKU *', 'บาร์โค้ด', 'ชื่อสินค้า *', 'หมวดหมู่', 'ยี่ห้อ', 'รุ่นสินค้า', 'ราคามาตรฐาน *', 'ภาษีมูลค่าเพิ่ม', 'หน่วยนับ', 'แจ้งเตือนสต็อกต่ำ', 'ระบบ S/N', 'จำนวนเริ่มต้น', 'ต้นทุนต่อหน่วย (ถ้ามี)'];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $sheet->getStyle('A1:O1')->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle('A1:O1')->getFill()->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)->getStartColor()->setARGB('FF2563EB');
                foreach (range('A', 'O') as $col) {
                    $sheet->getColumnDimension($col)->setAutoSize(true);
                }
                $sheet->getColumnDimension('A')->setVisible(false); // ซ่อน ID

                try {
                    // ดึงข้อมูลตัวเลือกแอบไว้ที่คอลัมน์ด้านหลัง
                    $categories = class_exists(\App\Models\ProductCategory::class) ? \App\Models\ProductCategory::pluck('name')->toArray() : [];
                    $brands = class_exists(\App\Models\Brand::class) ? \App\Models\Brand::pluck('name')->toArray() : [];
                    $units = class_exists(\App\Models\Unit::class) ? \App\Models\Unit::pluck('name')->toArray() : [];

                    $types = ['สินค้าสำหรับขาย', 'สินค้าสำหรับเช่า', 'สินค้าสำหรับงานติดตั้ง', 'บริการ'];
                    $vats = ['ราคายังไม่รวม VAT (7%)', 'ราคารวม VAT (7%)', 'สินค้าได้รับการยกเว้น VAT'];
                    $sns = ['มี', 'ไม่มี'];

                    if (count($categories) > 0) {
                        foreach ($categories as $idx => $val) {
                            $sheet->setCellValue('ZA' . ($idx + 1), $val);
                        }
                    }
                    if (count($brands) > 0) {
                        foreach ($brands as $idx => $val) {
                            $sheet->setCellValue('ZB' . ($idx + 1), $val);
                        }
                    }
                    if (count($units) > 0) {
                        foreach ($units as $idx => $val) {
                            $sheet->setCellValue('ZC' . ($idx + 1), $val);
                        }
                    }
                    foreach ($types as $idx => $val) {
                        $sheet->setCellValue('ZD' . ($idx + 1), $val);
                    }
                    foreach ($vats as $idx => $val) {
                        $sheet->setCellValue('ZE' . ($idx + 1), $val);
                    }
                    foreach ($sns as $idx => $val) {
                        $sheet->setCellValue('ZF' . ($idx + 1), $val);
                    }

                    foreach (['ZA', 'ZB', 'ZC', 'ZD', 'ZE', 'ZF'] as $col) {
                        $sheet->getColumnDimension($col)->setVisible(false);
                    }

                    // 🚀 เปลี่ยนมาใช้ระบุเป็นช่วงเบอร์ (Range) แทนการลูปทีละช่อง ไฟล์จะเบาและเร็วขึ้น 1,000 เท่า!
                    if (count($categories) > 0) {
                        $sheet->getDataValidation('F2:F1000')->setType(DataValidation::TYPE_LIST)->setShowDropDown(true)->setShowErrorMessage(false)->setFormula1('=$ZA$1:$ZA$' . count($categories));
                    }
                    if (count($brands) > 0) {
                        $sheet->getDataValidation('G2:G1000')->setType(DataValidation::TYPE_LIST)->setShowDropDown(true)->setShowErrorMessage(false)->setFormula1('=$ZB$1:$ZB$' . count($brands));
                    }
                    if (count($units) > 0) {
                        $sheet->getDataValidation('K2:K1000')->setType(DataValidation::TYPE_LIST)->setShowDropDown(true)->setShowErrorMessage(false)->setFormula1('=$ZC$1:$ZC$' . count($units));
                    }

                    $sheet->getDataValidation('B2:B1000')->setType(DataValidation::TYPE_LIST)->setShowDropDown(true)->setShowErrorMessage(false)->setFormula1('=$ZD$1:$ZD$4');
                    $sheet->getDataValidation('J2:J1000')->setType(DataValidation::TYPE_LIST)->setShowDropDown(true)->setShowErrorMessage(false)->setFormula1('=$ZE$1:$ZE$3');
                    $sheet->getDataValidation('M2:M1000')->setType(DataValidation::TYPE_LIST)->setShowDropDown(true)->setShowErrorMessage(true)->setFormula1('=$ZF$1:$ZF$2');
                } catch (\Exception $e) {
                }
            }
        ];
    }
}
