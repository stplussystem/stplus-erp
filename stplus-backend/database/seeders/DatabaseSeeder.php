<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Company;
use App\Models\ProductCategory;
use App\Models\Product;
use App\Models\Warehouse;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. จำลองข้อมูลบริษัท ST PLUS
        $company = Company::create([
            'name' => 'ST PLUS SYSTEM CO., LTD.',
            'tax_id' => '0125558006632',
            'address' => '123/105 หมู่บ้านนันทนา การ์เด้น หมู่ 3 ซอยท่าอิฐ ถนนรัตนาธิเบศร์ ตำบลบางรักน้อย อำเภอเมืองนนทบุรี นนทบุรี 11000',
        ]);

        // 2. จำลองข้อมูลคลังสินค้า
        $warehouse = Warehouse::create([
            'company_id' => $company->id,
            'name' => 'คลังสินค้าหลัก (สำนักงานใหญ่)',
            'location' => 'โซน A',
        ]);

        // 3. จำลองข้อมูลหมวดหมู่สินค้า
        $catIT = ProductCategory::create([
            'company_id' => $company->id,
            'name' => 'อุปกรณ์ไอที',
        ]);

        $catOffice = ProductCategory::create([
            'company_id' => $company->id,
            'name' => 'เครื่องใช้สำนักงาน',
        ]);

        // 4. จำลองข้อมูลสินค้า 5 รายการ
        $products = [
            [
                'company_id' => $company->id,
                'category_id' => $catIT->id,
                'sku' => 'IT-0001',
                'name' => 'คอมพิวเตอร์พกพา (Laptop)',
                'price' => 35000.00,
                'vat_type' => '7',
                'stock_qty' => 15,
                'has_serial_number' => true,
            ],
            [
                'company_id' => $company->id,
                'category_id' => $catIT->id,
                'sku' => 'IT-0002',
                'name' => 'จอภาพ 27 นิ้ว',
                'price' => 8500.00,
                'vat_type' => '7',
                'stock_qty' => 30,
                'has_serial_number' => true,
            ],
            [
                'company_id' => $company->id,
                'category_id' => $catIT->id,
                'sku' => 'IT-0003',
                'name' => 'เมาส์ไร้สาย',
                'price' => 990.00,
                'vat_type' => '7',
                'stock_qty' => 50,
                'has_serial_number' => false,
            ],
            [
                'company_id' => $company->id,
                'category_id' => $catOffice->id,
                'sku' => 'OF-0001',
                'name' => 'กระดาษ A4 (1 กล่อง)',
                'price' => 550.00,
                'vat_type' => '7',
                'stock_qty' => 100,
                'has_serial_number' => false,
            ],
            [
                'company_id' => $company->id,
                'category_id' => $catOffice->id,
                'sku' => 'OF-0002',
                'name' => 'แฟ้มเอกสาร',
                'price' => 45.00,
                'vat_type' => '7',
                'stock_qty' => 200,
                'has_serial_number' => false,
            ]
        ];

        // บันทึกสินค้าลง Database
        foreach ($products as $product) {
            Product::create($product);
        }
    }
}
