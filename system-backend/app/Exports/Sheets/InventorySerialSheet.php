<?php

namespace App\Exports\Sheets;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;

class InventorySerialSheet extends DefaultValueBinder implements FromCollection, WithTitle, WithHeadings, WithMapping, WithEvents, WithCustomValueBinder
{
    protected $products;
    public function __construct($products)
    {
        $this->products = $products;
    }
    public function title(): string
    {
        return 'Serial Numbers';
    }

    public function bindValue(Cell $cell, $value)
    {
        if (in_array($cell->getColumn(), ['A', 'B', 'D'])) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);
            return true;
        }
        return parent::bindValue($cell, $value);
    }

    public function collection()
    {
        $serials = collect();
        foreach ($this->products as $product) {
            if ($product->has_serial_number) {
                $productSerials = \App\Models\ProductSerial::where('product_id', $product->id)
                    ->where('status', 'available')
                    ->get();
                foreach ($productSerials as $serial) {
                    $serials->push((object)[
                        'product_id' => $product->id,
                        'sku' => $product->sku,
                        'name' => $product->name,
                        'serial_number' => $serial->serial_number,
                        'status' => 'พร้อมขาย'
                    ]);
                }
            }
        }
        return $serials;
    }

    public function headings(): array
    {
        // 💰 [เพิ่มใหม่] "ต้นทุนต่อหน่วย" ต่อท้ายสุด (คอลัมน์ F) — เว้นว่างได้ มีความหมายเฉพาะแถวที่เพิ่ม S/N
        // ใหม่ที่ไม่มีในระบบเท่านั้น (ดู SerialsSheetImport.php) — เพิ่มต่อท้ายเท่านั้น ไม่แทรกกลาง กัน index
        // คอลัมน์เดิม (0-4) ที่ importer พึ่งพาอยู่เลื่อน
        return ['Product ID (ซ่อน)', 'SKU อ้างอิง *', 'ชื่อสินค้า', 'Serial Number *', 'สถานะ', 'ต้นทุนต่อหน่วย (ถ้ามี)'];
    }
    public function map($row): array
    {
        return [$row->product_id, $row->sku, $row->name, $row->serial_number, $row->status, ''];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $sheet->getStyle('A1:F1')->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle('A1:F1')->getFill()->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)->getStartColor()->setARGB('FF16A34A');
                $sheet->getColumnDimension('A')->setVisible(false);
                $sheet->getColumnDimension('B')->setWidth(20);
                $sheet->getColumnDimension('C')->setWidth(35);
                $sheet->getColumnDimension('D')->setWidth(30);
                $sheet->getColumnDimension('E')->setWidth(20);
                $sheet->getColumnDimension('F')->setWidth(20);

                $statuses = ['พร้อมขาย', 'ชำรุด', 'สูญหาย'];
                foreach ($statuses as $index => $status) {
                    $sheet->setCellValue('ZA' . ($index + 1), $status);
                }
                $sheet->getColumnDimension('ZA')->setVisible(false);

                // 🚀 ล็อกเป็น Range ความยาวกระชับพอดีกับเอกสาร ไม่บวมแน่นอนครับ
                $sheet->getDataValidation('E2:E2000')->setType(DataValidation::TYPE_LIST)
                    ->setShowDropDown(true)->setShowErrorMessage(true)->setFormula1('=$ZA$1:$ZA$3');
            }
        ];
    }
}
