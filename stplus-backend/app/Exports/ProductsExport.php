<?php

namespace App\Exports;

use App\Models\Product;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ProductsExport implements FromCollection, WithHeadings, WithMapping
{
    public function collection()
    {
        // ดึงข้อมูลสินค้าทั้งหมด พร้อมกับชื่อหมวดหมู่, ยี่ห้อ, หน่วยนับ
        return Product::with(['category', 'brand', 'unit'])->latest()->get();
    }

    // กำหนดหัวคอลัมน์ (Row 1)
    public function headings(): array
    {
        return [
            'รหัสสินค้า (SKU) *',
            'บาร์โค้ด',
            'ชื่อสินค้า *',
            'ประเภทสินค้า (inventory/service/non-inventory)',
            'รุ่นสินค้า',
            'ราคาขาย *',
            'ภาษี (7/0/exempt)',
            'เก็บ S/N (1=ใช่, 0=ไม่ใช่)',
            'ชื่อหมวดหมู่',
            'ชื่อยี่ห้อ',
            'ชื่อหน่วยนับ'
        ];
    }

    // แมปข้อมูลลงในแต่ละแถว
    public function map($product): array
    {
        return [
            $product->sku,
            $product->barcode,
            $product->name,
            $product->product_type,
            $product->model_name,
            $product->price,
            $product->vat_type,
            $product->has_serial_number ? 1 : 0,
            $product->category ? $product->category->name : '',
            $product->brand ? $product->brand->name : '',
            $product->unit ? $product->unit->name : '',
        ];
    }
}
