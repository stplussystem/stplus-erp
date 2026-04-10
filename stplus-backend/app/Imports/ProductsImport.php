<?php

namespace App\Imports;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Brand;
use App\Models\Unit;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithStartRow;

class ProductsImport implements ToModel, WithStartRow
{
    // บอกให้ระบบเริ่มอ่านข้อมูลจากแถวที่ 2 (เพราะแถว 1 คือหัวคอลัมน์)
    public function startRow(): int
    {
        return 2;
    }

    public function model(array $row)
    {
        // ถ้าช่อง SKU (ช่อง 0) หรือ ชื่อสินค้า (ช่อง 2) เป็นค่าว่าง ให้ข้ามแถวนี้ไป
        if (!isset($row[0]) || !isset($row[2])) {
            return null;
        }

        $companyId = 1; // อ้างอิงบริษัทหลัก

        // 1. ตรวจสอบ/สร้าง หมวดหมู่ (ช่อง 8)
        $categoryId = null;
        if (!empty($row[8])) {
            $cat = ProductCategory::firstOrCreate(['name' => trim($row[8]), 'company_id' => $companyId]);
            $categoryId = $cat->id;
        }

        // 2. ตรวจสอบ/สร้าง ยี่ห้อ (ช่อง 9)
        $brandId = null;
        if (!empty($row[9])) {
            $brand = Brand::firstOrCreate(['name' => trim($row[9]), 'company_id' => $companyId]);
            $brandId = $brand->id;
        }

        // 3. ตรวจสอบ/สร้าง หน่วยนับ (ช่อง 10)
        $unitId = null;
        if (!empty($row[10])) {
            $unit = Unit::firstOrCreate(['name' => trim($row[10])]);
            $unitId = $unit->id;
        }

        // ใช้ updateOrCreate: ถ้ารหัส SKU ซ้ำให้อัปเดตข้อมูลใหม่ ถ้าไม่ซ้ำให้สร้างใหม่
        return Product::updateOrCreate(
            ['sku' => trim($row[0])], // เงื่อนไขหลัก
            [
                'barcode' => isset($row[1]) ? trim($row[1]) : null,
                'name' => trim($row[2]),
                'product_type' => in_array($row[3], ['inventory', 'service', 'non-inventory']) ? $row[3] : 'inventory',
                'model_name' => isset($row[4]) ? trim($row[4]) : null,
                'price' => isset($row[5]) ? (float)$row[5] : 0,
                'vat_type' => in_array($row[6], ['7', '0', 'exempt']) ? $row[6] : '7',
                'has_serial_number' => (isset($row[7]) && $row[7] == 1) ? true : false,
                'category_id' => $categoryId,
                'brand_id' => $brandId,
                'unit_id' => $unitId,
            ]
        );
    }
}
