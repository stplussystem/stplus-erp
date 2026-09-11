<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProductCategorySeeder extends Seeder
{
    public function run(): void
    {
        // จับคู่ชื่อเดิม กับ ชื่อใหม่ที่ต้องการให้แสดงผล
        $categories = [
            'Visual' => 'Visual (ระบบภาพ)',
            'Sound' => 'Sound (ระบบเสียง)',
            'Lighting' => 'Lighting (ระบบไฟเวที)',
            'Service' => 'Service (บริการ)',
            'Security' => 'Security (ระบบความปลอดภัย)',
            'Network' => 'Network (ระบบเครือข่าย)',
            'Accessories' => 'Accessories (อุปกรณ์เสริม)',
            'Other' => 'Other (อื่นๆ)'
        ];

        foreach ($categories as $oldName => $newName) {
            // เช็คว่ามีชื่อภาษาอังกฤษล้วนอยู่ไหม ถ้ามีให้ "อัปเดต" เป็นชื่อใหม่
            $oldRecord = DB::table('product_categories')->where('name', $oldName)->first();

            if ($oldRecord) {
                DB::table('product_categories')
                    ->where('id', $oldRecord->id)
                    ->update(['name' => $newName, 'updated_at' => now()]);
            }
            // แต่ถ้ายังไม่มีข้อมูลเลย ให้ "สร้างใหม่"
            elseif (!DB::table('product_categories')->where('name', $newName)->exists()) {
                DB::table('product_categories')->insert([
                    'company_id' => 1,
                    'name' => $newName,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
}
