<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Company;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. เคลียร์ Cache ของ Spatie Permission ก่อนเพื่อความชัวร์
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ==========================================
        // 📚 1. ดึง Permission ทั้งหมดอ้างอิงตามไฟล์ api.php
        // ==========================================
        $allPermissions = [
            // Dashboard
            'view_dashboard',

            // System Management
            'manage_users',
            'manage_permissions',
            'manage_roles',
            'manage_company',

            // Inventory & Product
            'view_products',
            'manage_products',
            'bt_InventoryAdjustment', // สิทธิ์ปรับปรุงสต๊อก
            'view_movements',
            'menu_stock_in',
            'menu_stock_out',
            'manage_warehouses',

            // Contacts
            'view_contacts',
            'create_contacts',
            'edit_contacts',
            'delete_contacts',

            // Purchase Orders
            'view_purchase',
            'create_purchase',
            'edit_purchase',
            'delete_purchase',
            'approve_purchase',

            // Sale Documents
            'view_sale_document',
            'create_sale_document',
            'edit_sale_document',
            'delete_sale_document',
            'approve_sale_document',

            // Goods Receipts
            'stock_in_purchase',
            'create_goods_receipt',
            'create_goods_receipt_no_po'
        ];

        // วนลูปสร้าง Permission ทั้งหมดลงในระบบ
        foreach ($allPermissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // ==========================================
        // 👑 2. สร้าง Role สูงสุด (Super Admin)
        // ==========================================
        $roleSuper = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
        $roleSuper->syncPermissions(Permission::all()); // มอบสิทธิ์ทุกอย่างที่มีในระบบให้ Super Admin

        // ==========================================
        // 🏢 3. สร้างบริษัทเจ้าของระบบ (HQ)
        // ==========================================
        $hqCompany = Company::firstOrCreate(
            ['tax_id' => '0000000000000'],
            [
                'name' => 'MINI ERP SYSTEM',
                'phone' => '02-000-0000',
                'address' => 'Bangkok, Thailand'
            ]
        );

        // ==========================================
        // 👤 4. สร้างบัญชีพระเจ้า (Platform Admin)
        // ==========================================
        $superAdmin = User::firstOrCreate(
            ['email' => 'worakit.wa@gmail.com'],
            [
                'name' => 'Super Administrator',
                'password' => Hash::make('M@ck044145750'),
                'company_id' => $hqCompany->id,
                'is_platform_admin' => true, // เปิดโหมดพลังสูงสุด (ข้ามบริษัทได้)
                'is_active' => true,
            ]
        );

        // ผูก Role Super Admin เข้ากับบัญชีพระเจ้า
        $superAdmin->assignRole($roleSuper);

        $this->command->info('✨ สร้างฐานข้อมูลเริ่มต้นสำเร็จ!');
        $this->command->info('👑 Super Admin : worakit.wa@gmail.com (รหัสผ่าน: M@ck044145750)');
        $this->command->info('💡 หมายเหตุ: ระบบ Package SaaS สามารถนำมาเพิ่มทีหลังได้เมื่อพร้อม');
    }
}
