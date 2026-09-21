<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

/**
 * 🆕 เพิ่มเมนู "Price List ผู้จำหน่าย" (/price-lists) — permission ใหม่ล้วนๆ ไม่แตะแถวเดิมของใครเลย
 *
 * รันแยกได้เองบน production ที่รันไปแล้วโดยไม่ต้องรัน DatabaseSeeder ทั้งก้อน:
 *   php artisan db:seed --class="Database\Seeders\PriceListMenuSeeder"
 *
 * มิเรอร์ pattern เดียวกับ StockOnHandMenuSeeder.php ทุกประการ — ให้ทุก role ที่เป็น is_company_admin ได้สิทธิ์
 * เมนูนี้ทันที เพราะเป็นเมนูพื้นฐานของทุกบริษัท ไม่ใช่ฟีเจอร์ระดับแพ็กเกจที่ต้องคุมสิทธิ์แยก
 */
class PriceListMenuSeeder extends Seeder
{
    public function run(): void
    {
        $menuPermission = Permission::firstOrCreate(
            ['name' => 'view_price_lists', 'guard_name' => 'web'],
            [
                'group' => 'คลังสินค้า',
                'sub_group' => 'ทั่วไป',
                'is_menu' => true,
                'title_th' => 'Price List ผู้จำหน่าย',
                'path' => '/price-lists',
                'icon' => 'Tags',
                // 🔄 [2026-09-15] sync sort_order ให้ตรงกับลำดับเมนูจริงหลังจัดเรียงใหม่ผ่านหน้า /permissions
                // (ดู DatabaseSeeder.php ส่วน sync รอบสอง)
                'sort_order' => 305,
            ],
        );

        $buttonPermissions = [
            ['name' => 'manage_price_lists', 'title_th' => 'ปุ่มจัดการ Price List'],
            ['name' => 'import_price_lists', 'title_th' => 'ปุ่มนำเข้า Price List'],
            ['name' => 'export_price_lists', 'title_th' => 'ปุ่มส่งออก Price List'],
        ];

        $allPermissions = collect([$menuPermission]);

        foreach ($buttonPermissions as $data) {
            $allPermissions->push(Permission::firstOrCreate(
                ['name' => $data['name'], 'guard_name' => 'web'],
                ['group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => $data['title_th'], 'icon' => 'Tags'],
            ));
        }

        foreach (Role::where('is_company_admin', true)->get() as $role) {
            foreach ($allPermissions as $permission) {
                if (!$role->hasPermissionTo($permission)) {
                    $role->givePermissionTo($permission);
                }
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
