<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB; // 🚀 เพิ่ม DB
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run()
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // 🛡️ ต้องตั้ง team id ก่อนเรียก syncPermissions()/assignRole() ด้านล่างเสมอ — ระบบเปิด Spatie
        // teams mode (config('permission.teams') = true) ทำให้ pivot ตาราง model_has_roles/
        // role_has_permissions ทุกแถวต้องมี team_id (NOT NULL) กำกับ ถ้าไม่ตั้งไว้ก่อน Spatie จะแนบ
        // team_id = null ลงไปเอง ชนกับ constraint ทันที (seeder รันซ้ำไม่ได้เลยถ้าขาดบรรทัดนี้ — พังตอน
        // assignRole() ด้วย error "Column 'team_id' cannot be null") บริษัท 1 คือบริษัทเจ้าของระบบที่
        // seeder นี้สร้าง Super Admin/admin user ให้อยู่แล้วโดยตรง (ดู 'company_id' => 1 ด้านล่าง)
        app(\Spatie\Permission\PermissionRegistrar::class)->setPermissionsTeamId(1);

        // 🚀 พลังล้างไพ่: ล้างข้อมูลสิทธิ์และ Role เดิมทิ้งทั้งหมดก่อน
        // DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        // DB::table('role_has_permissions')->truncate();
        // DB::table('model_has_permissions')->truncate();
        // DB::table('model_has_roles')->truncate();
        // DB::table('permissions')->truncate();
        // DB::table('roles')->truncate();
        // DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 🚀 1. เมนูหลัก (is_menu = true)
        $menuPermissions = [
            ['name' => 'view_dashboard', 'group' => 'ภาพรวมระบบ', 'is_menu' => true, 'title_th' => 'Dashboard', 'path' => '/dashboard', 'icon' => 'LayoutDashboard', 'sort_order' => 1],
            ['name' => 'view_products', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'รายการสินค้า', 'path' => '/products', 'icon' => 'Package', 'sort_order' => 2],
            ['name' => 'view_inventory', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'สินค้าคงคลัง', 'path' => '/inventory', 'icon' => 'Package', 'sort_order' => 3],
            ['name' => 'manage_warehouses', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'จัดการคลังสินค้า', 'path' => '/warehouses', 'icon' => 'Store', 'sort_order' => 4],
            ['name' => 'menu_stock_in', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'รับสินค้าเข้าคลัง', 'path' => '/stock/in', 'icon' => 'PackagePlus', 'sort_order' => 4],
            ['name' => 'menu_stock_out', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'เบิกสินค้าออก', 'path' => '/stock/out', 'icon' => 'PackageMinus', 'sort_order' => 5],
            ['name' => 'view_movements', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'ประวัติรายการ', 'path' => '/movements', 'icon' => 'History', 'sort_order' => 6],
            ['name' => 'view_contacts', 'group' => 'รายชื่อผู้ติดต่อ', 'is_menu' => true, 'title_th' => 'สมุดรายชื่อ', 'path' => '/contacts', 'icon' => 'SquareUser', 'sort_order' => 7],
            ['name' => 'manage_company', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'ข้อมูลบริษัท', 'path' => '/company', 'icon' => 'Settings', 'sort_order' => 8],
            ['name' => 'manage_users', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'จัดการผู้ใช้งาน', 'path' => '/users', 'icon' => 'Settings', 'sort_order' => 9],
            ['name' => 'manage_permissions', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'สิทธิ์การใช้งาน', 'path' => '/permissions', 'icon' => 'Settings', 'sort_order' => 10],
            ['name' => 'view_activity_log', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'ประวัติการใช้งาน', 'path' => '/logs', 'icon' => 'History', 'sort_order' => 11],
        ];

        // 🚀 2. สิทธิ์แบบกุญแจล็อค (is_menu = false) เอาไว้ล็อค Tab ด้านใน
        $actionPermissions = [
            ['name' => 'manage_products', 'group' => 'คลังสินค้า', 'is_menu' => false, 'title_th' => 'เพิ่มข้อมูลสินค้า'],

            // กุญแจสำหรับ Tab รับเข้า
            ['name' => 'stock_in_single', 'group' => 'คลังสินค้า', 'is_menu' => false, 'title_th' => 'รับเข้าสินค้าทีละรายการ'],
            ['name' => 'stock_in_multi', 'group' => 'คลังสินค้า', 'is_menu' => false, 'title_th' => 'รับเข้าสินค้าหลายรายการ'],
            ['name' => 'stock_in_po', 'group' => 'คลังสินค้า', 'is_menu' => false, 'title_th' => 'รับเข้าสินค้าจากใบสั่งซื้อ (PO)'],

            // กุญแจสำหรับ Tab เบิกออก
            ['name' => 'stock_out_single', 'group' => 'คลังสินค้า', 'is_menu' => false, 'title_th' => 'เบิกสินค้าทีละรายการ'],
            ['name' => 'stock_out_multi', 'group' => 'คลังสินค้า', 'is_menu' => false, 'title_th' => 'เบิกสินค้าหลายรายการ'],
            ['name' => 'stock_out_inv', 'group' => 'คลังสินค้า', 'is_menu' => false, 'title_th' => 'เบิกสินค้าจากเลข Invoice'],
        ];

        $allPerms = array_merge($menuPermissions, $actionPermissions);

        foreach ($allPerms as $perm) {
            Permission::updateOrCreate(['name' => $perm['name']], $perm);
        }

        $roleSuperAdmin = Role::firstOrCreate([
            'name' => 'Super Admin',
            'company_id' => 1
        ], [
            'is_company_admin' => true,
        ]);
        if (!$roleSuperAdmin->is_company_admin) {
            $roleSuperAdmin->update(['is_company_admin' => true]);
        }
        $roleSuperAdmin->syncPermissions(Permission::all());

        $adminUser = User::firstOrCreate(
            ['email' => 'admin@stplus.com'],
            [
                'company_id' => 1,
                'name' => 'Super Admin',
                'username' => 'superadmin',
                'password' => Hash::make('0123456789')
            ]
        );
        $adminUser->assignRole($roleSuperAdmin);
    }
}
