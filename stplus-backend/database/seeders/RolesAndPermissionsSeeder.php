<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run()
    {
        // เคลียร์แคชของ Spatie ก่อนรัน
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // 💡 1. สร้าง Permissions (สิทธิ์รายบุคคล - Hybrid)
        $permissions = [
            'view_products',    // ดูสินค้า
            'manage_products',  // จัดการสินค้า (เพิ่ม/ลบ/แก้)
            'stock_in',         // รับเข้าสต็อก
            'stock_out',        // เบิกออกสต็อก
            'view_stock_history', // ดูประวัติสต็อก
            'manage_users',     // จัดการผู้ใช้งาน
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // 💡 2. สร้าง Role (กลุ่ม)
        $roleAdmin = Role::firstOrCreate(['name' => 'Super Admin']);
        $roleStaff = Role::firstOrCreate(['name' => 'Staff']);

        // Admin ได้ทุกสิทธิ์
        $roleAdmin->givePermissionTo(Permission::all());

        // Staff ได้แค่ดูและรับเข้า/เบิกออก
        $roleStaff->givePermissionTo([
            'view_products',
            'stock_in',
            'stock_out',
            'view_stock_history'
        ]);

        // 💡 3. สร้าง User สำหรับพี่แม็คไว้ใช้ทดสอบ
        $adminUser = User::firstOrCreate(
            ['email' => 'admin@stplus.com'],
            [
                'name' => 'Max Admin',
                'password' => Hash::make('password123'), // รหัสผ่านคือ password123
            ]
        );

        // มอบตำแหน่ง Super Admin ให้พี่แม็ค
        $adminUser->assignRole($roleAdmin);
    }
}
