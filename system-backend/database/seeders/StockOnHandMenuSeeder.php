<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

/**
 * 🆕 เพิ่มเมนู "สินค้าคงเหลือ" (/stock-on-hand) — permission ใหม่ล้วนๆ ไม่แตะแถวเดิมของใครเลย
 *
 * รันแยกได้เองบน production ที่รันไปแล้วโดยไม่ต้องรัน DatabaseSeeder ทั้งก้อน:
 *   php artisan db:seed --class="Database\Seeders\StockOnHandMenuSeeder"
 *
 * มิเรอร์ pattern การ sync สิทธิ์ใหม่ให้ role ที่มีอยู่แล้วจาก PermissionController::store() (จุดเดียวในระบบที่
 * เพิ่ม permission ใหม่แล้ว "เห็นผลจริง" ให้ tenant ที่มีอยู่แล้วโดยไม่ต้องรอ syncPermissions(Permission::all())
 * ตอนสร้างบริษัทใหม่) — ให้ทุก role ที่เป็น is_company_admin (ทั้ง Super Admin ของบริษัทเจ้าของระบบ และของทุก
 * tenant) ได้สิทธิ์นี้ทันที ไม่ต้องรอ Platform Admin ไปกดตั้งค่าอะไรเพิ่ม เพราะเป็นเมนูพื้นฐานของทุกบริษัท
 * ไม่ใช่ฟีเจอร์ระดับแพ็กเกจที่ต้องคุมสิทธิ์แยก
 */
class StockOnHandMenuSeeder extends Seeder
{
    public function run(): void
    {
        $permission = Permission::firstOrCreate(
            ['name' => 'view_stock_on_hand', 'guard_name' => 'web'],
            [
                'group' => 'คลังสินค้า',
                'sub_group' => 'ทั่วไป',
                'is_menu' => true,
                'title_th' => 'สินค้าคงเหลือ',
                'path' => '/stock-on-hand',
                'icon' => 'Boxes',
                // 🔄 [2026-09-15] sync sort_order ให้ตรงกับลำดับเมนูจริงหลังจัดเรียงใหม่ผ่านหน้า /permissions
                // (ดู DatabaseSeeder.php ส่วน sync รอบสอง)
                'sort_order' => 301,
            ],
        );

        foreach (Role::where('is_company_admin', true)->get() as $role) {
            if (!$role->hasPermissionTo($permission)) {
                $role->givePermissionTo($permission);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
