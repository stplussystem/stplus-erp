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

class InventoryDataSheet extends DefaultValueBinder implements FromCollection, WithTitle, WithHeadings, WithMapping, WithEvents, WithCustomValueBinder
{
    protected $products;

    public function __construct($products)
    {
        $this->products = $products;
    }
    public function title(): string
    {
        return 'รายการสินค้า';
    }

    public function bindValue(Cell $cell, $value)
    {
        // 🔒 ล็อก A(ID), C(SKU), D(Barcode) เป็น String
        if (in_array($cell->getColumn(), ['A', 'C', 'D'])) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);
            return true;
        }
        // ล็อก M(คงเหลือ) เป็น Numeric ยกเว้นหัวตาราง
        if ($cell->getColumn() === 'M' || $cell->getColumn() === 'N') {
            if (is_numeric($value)) {
                $cell->setValueExplicit((int)$value, DataType::TYPE_NUMERIC);
            } else {
                $cell->setValueExplicit($value, DataType::TYPE_STRING);
            }
            return true;
        }
        return parent::bindValue($cell, $value);
    }

    public function collection()
    {
        return $this->products;
    }

    public function headings(): array
    {
        // 🚀 เพิ่มคอลัมน์ "ประเภทสินค้า" และเรียงใหม่
        // 💰 [เพิ่มใหม่] "ต้นทุนต่อหน่วย" ต่อท้ายสุด (คอลัมน์ P) — เว้นว่างได้ ถ้ากรอกมาและนับได้มากกว่าเดิม
        // (นับจริง > คงเหลือ) ระบบจะสร้างใบรับสินค้าอัตโนมัติให้เฉพาะส่วนต่างที่เพิ่มขึ้น (ดู
        // ProductsSheetImport.php) — เพิ่มต่อท้ายเท่านั้น ห้ามแทรกกลาง กัน index คอลัมน์เดิม (0-13) ที่
        // importer พึ่งพาอยู่เลื่อน
        return ['ID (ห้ามแก้)', 'ประเภทสินค้า', 'SKU *', 'บาร์โค้ด', 'ชื่อสินค้า', 'หมวดหมู่', 'ยี่ห้อ', 'รุ่นสินค้า', 'ราคาขาย', 'ภาษีมูลค่าเพิ่ม', 'หน่วยนับ', 'แจ้งเตือน', 'คงเหลือ', 'นับจริง', 'ระบบ S/N', 'ต้นทุนต่อหน่วย (ถ้ามี — เว้นว่างได้)'];
    }

    public function map($product): array
    {
        $currentStock = $product->stockBalance ? $product->stockBalance->qty : 0;

        // 🚀 แปลงป้ายกำกับกลับมาเป็นคำศัพท์ภาษาไทยให้ Excel
        $typeStr = 'สินค้าสำหรับขาย';
        if ($product->product_type === 'service') {
            $typeStr = 'บริการ';
        } elseif ($product->can_rent) {
            $typeStr = 'สินค้าสำหรับเช่า';
        } elseif ($product->is_install_job) {
            $typeStr = 'สินค้าสำหรับงานติดตั้ง';
        }

        return [
            $product->id, // 🚀 A: ID (เอาไว้ใช้อ้างอิงตอน Import กลับ)
            $typeStr, // 🚀 B: ประเภท
            $product->sku,
            $product->barcode,
            $product->name,
            $product->category->name ?? '-',
            $product->brand->name ?? '-',
            $product->model_name ?? '-',
            $product->price,
            $product->vat_type ?? 'ราคายังไม่รวม VAT (7%)',
            $product->unit->name ?? '-',
            $product->low_stock_threshold ?? 0,
            (int)$currentStock,
            '', // เว้นว่างให้นับจริง
            $product->has_serial_number ? 'มีระบบ S/N' : 'ไม่มี',
            '', // 💰 เว้นว่างให้ต้นทุนต่อหน่วย (ไม่บังคับกรอก)
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $sheet->getStyle('A1:P1')->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle('A1:P1')->getFill()->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)->getStartColor()->setARGB('FF2563EB');

                $sheet->getColumnDimension('A')->setVisible(false); // ซ่อน ID
                foreach (range('A', 'P') as $col) {
                    $sheet->getColumnDimension($col)->setAutoSize(true);
                }
                $sheet->getColumnDimension('E')->setWidth(30); // ชื่อสินค้า
                $sheet->getColumnDimension('N')->setWidth(15); // นับจริง
                $sheet->getColumnDimension('P')->setWidth(22); // ต้นทุนต่อหน่วย
            }
        ];
    }
}
