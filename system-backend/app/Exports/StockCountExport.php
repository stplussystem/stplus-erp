<?php

namespace App\Exports;

use App\Models\ProductSerial;
use App\Models\StockLot;
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

// 🆕 แทนที่ InventoryExport (2 ชีท: รายการสินค้า รวมยอด + Serial Numbers แยกชีท) ด้วยชีทเดียว 1 แถวต่อ 1 หน่วยจริง
// พร้อมต้นทุน FIFO ต่อหน่วย — ใช้เฉพาะปุ่ม "ปรับปรุงสต๊อก" คู่กับ StockCountImport.php เท่านั้น (ไม่เกี่ยวกับ
// "นำเข้าสินค้าใหม่" ที่ยังใช้ ProductsImport/ProductTemplateExport เดิม) — ไม่แตะ/ลบ InventoryExport เดิม
// เพราะยังมีโค้ดจุดอื่น (ไม่ถูกเรียกใช้งานจริงผ่าน route ใดๆ) อ้างอิงอยู่
class StockCountExport extends DefaultValueBinder implements FromCollection, WithTitle, WithHeadings, WithMapping, WithEvents, WithCustomValueBinder
{
    protected Collection $rows;

    public function __construct($products)
    {
        $this->rows = $this->buildRows(collect($products));
    }

    public function title(): string
    {
        return 'ตรวจนับสต๊อก';
    }

    public function bindValue(Cell $cell, $value)
    {
        // 🔒 ล็อกคอลัมน์รหัส/เลขยาวๆ ให้เป็น String เสมอ — กัน Excel ตัดเลข 0 นำหน้า หรือปัดเป็นเลขวิทยาศาสตร์
        if (in_array($cell->getColumn(), ['A', 'C', 'D', 'K', 'L'])) {
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
            'Product ID (ห้ามแก้)', 'ประเภทสินค้า', 'SKU', 'บาร์โค้ด', 'ชื่อสินค้า', 'หมวดหมู่', 'ยี่ห้อ',
            'รุ่นสินค้า', 'หน่วยนับ', 'ระบบ S/N', 'Serial Number', 'รหัสล็อต (ห้ามแก้)', 'คลัง',
            'วันที่รับเข้า', 'ต้นทุนต่อหน่วย', 'สถานะ',
        ];
    }

    public function map($row): array
    {
        return [
            $row->product_id,
            $row->type_label,
            $row->sku,
            $row->barcode,
            $row->name,
            $row->category_name,
            $row->brand_name,
            $row->model_name,
            $row->unit_name,
            $row->has_serial_number ? 'มีระบบ S/N' : 'ไม่มี',
            $row->serial_number,
            $row->lot_id,
            $row->warehouse_name,
            $row->received_at,
            $row->unit_cost,
            $row->status,
        ];
    }

    // 🆕 1 แถวต่อ 1 หน่วยจริง — สินค้าคุม S/N: 1 แถวต่อ ProductSerial ที่ status=available
    // สินค้าไม่คุม S/N: แตกล็อตที่เหลือ (qty_remaining) เป็นแถวซ้ำๆ ตามจำนวนจริง (เช่น ล็อตเหลือ 3 = 3 แถว)
    // ให้ "การมี/ไม่มีแถว" คือยอดนับจริงโดยตรง (ดู StockCountImport.php ฝั่งอ่านกลับ)
    private function buildRows(Collection $products): Collection
    {
        if ($products->isEmpty()) return collect();

        $companyId = auth()->user()->company_id;
        $serialProductIds = $products->where('has_serial_number', true)->pluck('id');
        $lotProductIds = $products->where('has_serial_number', false)->pluck('id');

        $serialsByProduct = collect();
        if ($serialProductIds->isNotEmpty()) {
            $serialsByProduct = ProductSerial::whereIn('product_id', $serialProductIds)
                ->where('company_id', $companyId)
                ->where('status', 'available')
                ->with(['stockLot:id,unit_cost,received_at', 'warehouse:id,name'])
                ->get()
                ->sortBy(fn ($s) => optional($s->stockLot)->received_at ?? $s->created_at)
                ->groupBy('product_id');
        }

        $lotsByProduct = collect();
        if ($lotProductIds->isNotEmpty()) {
            $lotsByProduct = StockLot::whereIn('product_id', $lotProductIds)
                ->where('company_id', $companyId)
                ->where('qty_remaining', '>', 0)
                ->with('warehouse:id,name')
                ->orderBy('received_at')->orderBy('id')
                ->get()
                ->groupBy('product_id');
        }

        $rows = collect();
        foreach ($products as $product) {
            $typeLabel = 'สินค้าสำหรับขาย';
            if ($product->product_type === 'service') $typeLabel = 'บริการ';
            elseif ($product->can_rent) $typeLabel = 'สินค้าสำหรับเช่า';
            elseif ($product->is_install_job) $typeLabel = 'สินค้าสำหรับงานติดตั้ง';

            $common = [
                'product_id' => $product->id,
                'type_label' => $typeLabel,
                'sku' => $product->sku,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'category_name' => $product->category->name ?? '-',
                'brand_name' => $product->brand->name ?? '-',
                'model_name' => $product->model_name ?? '-',
                'unit_name' => $product->unit->name ?? '-',
                'has_serial_number' => (bool) $product->has_serial_number,
            ];

            if ($product->has_serial_number) {
                foreach ($serialsByProduct->get($product->id, collect()) as $serial) {
                    $rows->push((object) array_merge($common, [
                        'serial_number' => $serial->serial_number,
                        'lot_id' => null,
                        'warehouse_name' => $serial->warehouse->name ?? '-',
                        'received_at' => optional($serial->stockLot?->received_at)->format('d/m/Y'),
                        'unit_cost' => (float) ($serial->stockLot->unit_cost ?? 0),
                        'status' => 'พร้อมขาย',
                    ]));
                }
            } else {
                foreach ($lotsByProduct->get($product->id, collect()) as $lot) {
                    $unitsInLot = (int) round((float) $lot->qty_remaining);
                    for ($i = 0; $i < $unitsInLot; $i++) {
                        $rows->push((object) array_merge($common, [
                            'serial_number' => null,
                            'lot_id' => $lot->id,
                            'warehouse_name' => $lot->warehouse->name ?? '-',
                            'received_at' => optional($lot->received_at)->format('d/m/Y'),
                            'unit_cost' => (float) $lot->unit_cost,
                            'status' => null,
                        ]));
                    }
                }
            }
        }

        return $rows;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $sheet->getStyle('A1:P1')->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle('A1:P1')->getFill()->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)->getStartColor()->setARGB('FF7C3AED');
                $sheet->freezePane('A2');

                $sheet->getColumnDimension('A')->setVisible(false); // Product ID
                $sheet->getColumnDimension('L')->setVisible(false); // รหัสล็อต
                foreach (range('A', 'P') as $col) {
                    $sheet->getColumnDimension($col)->setAutoSize(true);
                }
                $sheet->getColumnDimension('E')->setWidth(30); // ชื่อสินค้า
                $sheet->getColumnDimension('K')->setWidth(22); // Serial Number

                // สถานะ (S/N เท่านั้น) — dropdown เดียวกับเดิม
                $statuses = ['พร้อมขาย', 'ชำรุด', 'สูญหาย'];
                foreach ($statuses as $index => $status) {
                    $sheet->setCellValue('ZA' . ($index + 1), $status);
                }
                $sheet->getColumnDimension('ZA')->setVisible(false);
                $lastRow = max(2, $sheet->getHighestRow());
                $sheet->getDataValidation('P2:P' . ($lastRow + 500))->setType(DataValidation::TYPE_LIST)
                    ->setShowDropDown(true)->setShowErrorMessage(true)->setFormula1('=$ZA$1:$ZA$3');
            }
        ];
    }
}
