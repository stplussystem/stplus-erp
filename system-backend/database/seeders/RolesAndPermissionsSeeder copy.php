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
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // 🚀 1. เมนูหลัก (is_menu = true) พวกนี้จะไปโชว์ที่ Sidebar / Topbar
        $menuPermissions = [
            ['name' => 'view_dashboard', 'group' => 'ภาพรวมระบบ', 'is_menu' => true, 'title_th' => 'Dashboard', 'path' => '/dashboard', 'icon' => 'LayoutDashboard', 'sort_order' => 1],

            ['name' => 'view_products', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'รายการสินค้า', 'path' => '/products', 'icon' => 'Package', 'sort_order' => 2],
            ['name' => 'view_inventory', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'สินค้าคงคลัง', 'path' => '/inventory', 'icon' => 'Package', 'sort_order' => 3],

            // 🟢 เปลี่ยนรับเข้า/เบิกออก ให้เป็นเมนูหลักหน้าเดียว!
            ['name' => 'menu_stock_in', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'รับสินค้าเข้าคลัง', 'path' => '/stock/in', 'icon' => 'PackagePlus', 'sort_order' => 4],
            ['name' => 'menu_stock_out', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'เบิกสินค้าออก', 'path' => '/stock/out', 'icon' => 'PackageMinus', 'sort_order' => 5],

            ['name' => 'view_movements', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'ประวัติรายการ', 'path' => '/movements', 'icon' => 'History', 'sort_order' => 6], // เปลี่ยนไอคอนให้ดูเป็นประวัติ
            ['name' => 'view_contacts', 'group' => 'รายชื่อผู้ติดต่อ', 'is_menu' => true, 'title_th' => 'สมุดรายชื่อ', 'path' => '/contacts', 'icon' => 'SquareUser', 'sort_order' => 7],

            ['name' => 'manage_company', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'ข้อมูลบริษัท', 'path' => '/company', 'icon' => 'Settings', 'sort_order' => 8],
            ['name' => 'manage_users', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'จัดการผู้ใช้งาน', 'path' => '/users', 'icon' => 'Settings', 'sort_order' => 9],
            ['name' => 'manage_permissions', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'สิทธิ์การใช้งาน', 'path' => '/permissions', 'icon' => 'Settings', 'sort_order' => 10],
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

        $roleSuperAdmin = Role::firstOrCreate(['name' => 'Super Admin']);
        // Super Admin จะได้ทุกสิทธิ์ (ทั้งเมนูและกุญแจ)
        $roleSuperAdmin->syncPermissions(Permission::all());

        $adminUser = User::firstOrCreate(
            ['email' => 'admin@stplus.com'],
            ['name' => 'Super Admin', 'username' => 'superadmin', 'password' => Hash::make('password123')]
        );
        $adminUser->assignRole($roleSuperAdmin);
    }
}
