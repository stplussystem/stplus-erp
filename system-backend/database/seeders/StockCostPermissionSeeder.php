<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

/**
 * 🆕 เพิ่มสิทธิ์ "ดูราคาต้นทุนสินค้าคงเหลือ" (view_stock_cost) — permission ใหม่ล้วนๆ ไม่แตะแถวเดิมของใครเลย
 *
 * ก่อนหน้านี้หน้า /stock-on-hand แสดงต้นทุนให้ทุกคนที่มีสิทธิ์ view_stock_on_hand เห็นเหมือนกันหมด
 * permission นี้แยกการมองเห็น "ต้นทุน" ออกจาก "จำนวนคงเหลือ" โดยไม่ต้องสร้างหน้าใหม่
 *
 * รันแยกได้เองบน production ที่รันไปแล้วโดยไม่ต้องรัน DatabaseSeeder ทั้งก้อน:
 *   php artisan db:seed --class="Database\Seeders\StockCostPermissionSeeder"
 *
 * เพื่อไม่ให้ผู้ใช้ที่เห็นต้นทุนอยู่แล้ว (ทุกคนที่มี view_stock_on_hand ในปัจจุบัน) เสียสิทธิ์เดิมไปทันทีตอน deploy —
 * ให้ role เดิมที่มี view_stock_on_hand ได้รับ view_stock_cost ไปด้วยโดยอัตโนมัติ (คงพฤติกรรมเดิม 100%)
 * จากนั้น Company Admin ค่อยไปเอาสิทธิ์นี้ออกจาก role ที่ไม่ต้องการให้เห็นต้นทุนเองภายหลังผ่านหน้า /permissions
 */
class StockCostPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permission = Permission::firstOrCreate(
            ['name' => 'view_stock_cost', 'guard_name' => 'web'],
            [
                'group' => 'คลังสินค้า',
                'sub_group' => 'ปุ่ม',
                'title_th' => 'ดูราคาต้นทุนสินค้าคงเหลือ',
                'icon' => 'Boxes',
            ],
        );

        foreach (Role::permission('view_stock_on_hand')->get() as $role) {
            if (!$role->hasPermissionTo($permission)) {
                $role->givePermissionTo($permission);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
