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

class TemplateSerialSheet extends DefaultValueBinder implements WithTitle, WithHeadings, WithEvents, WithCustomValueBinder
{
    public function title(): string
    {
        return 'Serial Numbers';
    }

    public function bindValue(Cell $cell, $value)
    {
        if (in_array($cell->getColumn(), ['A', 'B', 'C'])) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);
            return true;
        }
        return parent::bindValue($cell, $value);
    }

    public function headings(): array
    {
        return ['Product ID (เว้นว่าง)', 'SKU อ้างอิง *', 'Serial Number *', 'สถานะ'];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $sheet->getStyle('A1:D1')->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle('A1:D1')->getFill()->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)->getStartColor()->setARGB('FF16A34A');
                $sheet->getColumnDimension('A')->setVisible(false);
                $sheet->getColumnDimension('B')->setWidth(25);
                $sheet->getColumnDimension('C')->setWidth(40);
                $sheet->getColumnDimension('D')->setWidth(20);

                $statuses = ['พร้อมขาย', 'ชำรุด', 'สูญหาย'];
                foreach ($statuses as $index => $status) {
                    $sheet->setCellValue('ZA' . ($index + 1), $status);
                }
                $sheet->getColumnDimension('ZA')->setVisible(false);

                // 🚀 ล็อกเป็น Range แทนการเขียนลูปรวดเดียวถึงแถว 1,000 จบงานฉลุยครับ
                $sheet->getDataValidation('D2:D1000')->setType(DataValidation::TYPE_LIST)
                    ->setShowDropDown(true)->setShowErrorMessage(true)->setFormula1('=$ZA$1:$ZA$3');
            }
        ];
    }
}
