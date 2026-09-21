<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * 🗑️ [2026-09-21] ลบสิทธิ์เลิกใช้ 6 ตัวของกลุ่มรับเข้า/เบิกออกสต็อกแบบเก่า ตามที่ผู้ใช้ยืนยัน (ขีดฆ่าในหน้า /permissions):
 * stock_in_single, stock_in_multi, stock_in_po, stock_out_single, stock_out_multi, stock_out_inv
 *
 * ไม่มี route/controller/หน้าเว็บอ้างถึงแล้ว (หน้ารับเข้า/เบิกออกเลิกใช้ตั้งแต่ 2026-09-17) และตัดชื่อเหล่านี้ออกจาก
 * DatabaseSeeder / RolesAndPermissionsSeeder / DefaultRoleTemplatesSeeder แล้ว — seeder นี้มีไว้ลบ "แถวเดิม" ในฐานข้อมูล
 * ที่ติดตั้งไว้ก่อนหน้า (ติดตั้งใหม่ไม่ต้องรัน เพราะไม่มีที่ไหนสร้างสิทธิ์พวกนี้อีก)
 *
 * รันแยกบน production ได้เอง:
 *   php artisan db:seed --class="Database\Seeders\RemoveObsoleteStockPermissionsSeeder"
 *
 * Idempotent: ไม่มีแถวให้ลบก็ไม่ทำอะไร — ลบผ่าน Eloquent ตารางที่ผูกไว้ (role_has_permissions / model_has_permissions)
 * ถูก cascade ลบตามด้วย FK ของ Spatie แล้วล้าง cache สิทธิ์ ไม่แตะแถว permission อื่นเลย
 */
class RemoveObsoleteStockPermissionsSeeder extends Seeder
{
    public const NAMES = [
        'stock_in_single',
        'stock_in_multi',
        'stock_in_po',
        'stock_out_single',
        'stock_out_multi',
        'stock_out_inv',
    ];

    public function run(): void
    {
        $deleted = Permission::whereIn('name', self::NAMES)->where('guard_name', 'web')->get();
        foreach ($deleted as $permission) {
            $permission->delete();
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->command?->info(
            $deleted->isEmpty()
                ? 'ไม่พบสิทธิ์ที่เลิกใช้ให้ลบ (ลบไปแล้ว)'
                : 'ลบสิทธิ์ที่เลิกใช้แล้ว ' . $deleted->count() . ' ตัว: ' . $deleted->pluck('name')->implode(', ')
        );
    }
}
