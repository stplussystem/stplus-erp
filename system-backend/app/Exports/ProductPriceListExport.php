<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;

// 🆕 Template ของโมดูล Price List — 1 แถวต่อ 1 สินค้าในระบบ (ไม่ใช่ต่อผู้จำหน่าย — ผู้จำหน่ายถูกเลือกไว้ก่อน
// แล้วทั้งไฟล์เป็นราคาของผู้จำหน่ายรายนั้นรายเดียว) ถ้าผู้จำหน่ายรายนี้เคยมีราคาของสินค้าตัวนั้นอยู่แล้ว
// จะดึงมาแสดงไว้ล่วงหน้าให้แก้ไข (ไม่ใช่ export เปล่าเสมอ) ตามแพทเทิร์นเดียวกับ StockCountExport.php
class ProductPriceListExport extends DefaultValueBinder implements FromCollection, WithTitle, WithHeadings, WithMapping, WithEvents, WithCustomValueBinder
{
    protected Collection $rows;

    public function __construct(Collection $products, Collection $existingByProduct)
    {
        $this->rows = $products->map(function ($product) use ($existingByProduct) {
            $existing = $existingByProduct->get($product->id);
            return (object) [
                'product_id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'status' => $existing ? $this->trendLabel($existing->price_trend) : null,
                'price' => $existing?->price,
                'discount_percent' => $existing?->discount_percent,
                'updated_at' => $existing ? $existing->updated_at->format('d/m/Y') : null,
                'expiry_date' => $existing?->expiry_date?->format('d/m/Y'),
            ];
        });
    }

    private function trendLabel(string $trend): string
    {
        return match ($trend) {
            'up' => 'ราคาขึ้น',
            'down' => 'ราคาลง',
            default => 'ราคาคงที่',
        };
    }

    public function title(): string
    {
        return 'Price List';
    }

    public function bindValue(Cell $cell, $value)
    {
        if (in_array($cell->getColumn(), ['A', 'B'])) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);
            return true;
        }
        return parent::bindValue($cell, $value);
    }

    public function collection()
    {
        return $this->rows;
    }

    public function headings(): array
    {
        return [
            'Product ID (ห้ามแก้)', 'SKU', 'ชื่อสินค้า', 'สถานะ', 'ราคาที่ผู้จำหน่ายตั้ง', 'ส่วนลด (%)',
            'วันอัพเดทล่าสุด (อ้างอิง ห้ามแก้)', 'วันสิ้นสุดราคา',
        ];
    }

    public function map($row): array
    {
        return [
            $row->product_id,
            $row->sku,
            $row->name,
            $row->status,
            $row->price,
            $row->discount_percent,
            $row->updated_at,
            $row->expiry_date,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $sheet->getStyle('A1:H1')->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle('A1:H1')->getFill()->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)->getStartColor()->setARGB('FF7C3AED');
                $sheet->freezePane('A2');

                $sheet->getColumnDimension('A')->setVisible(false); // Product ID
                foreach (range('A', 'H') as $col) {
                    $sheet->getColumnDimension($col)->setAutoSize(true);
                }
                $sheet->getColumnDimension('C')->setWidth(30); // ชื่อสินค้า

                // สถานะ — dropdown
                $statuses = ['ราคาขึ้น', 'ราคาลง', 'ราคาคงที่'];
                foreach ($statuses as $index => $status) {
                    $sheet->setCellValue('ZA' . ($index + 1), $status);
                }
                $sheet->getColumnDimension('ZA')->setVisible(false);
                $lastRow = max(2, $sheet->getHighestRow());
                $sheet->getDataValidation('D2:D' . ($lastRow + 500))->setType(DataValidation::TYPE_LIST)
                    ->setShowDropDown(true)->setShowErrorMessage(true)->setFormula1('=$ZA$1:$ZA$3');
            }
        ];
    }
}
