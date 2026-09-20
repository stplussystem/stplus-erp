<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Company;
use App\Models\Warehouse;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. เคลียร์ Cache ของ Spatie Permission ก่อน
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ==========================================
        // 📚 1. สร้าง Permission พร้อมข้อมูลการแสดงผลเมนู
        // ==========================================
        // 🔄 [2026-09-08] Sync ทั้งชุดจาก DB จริงตรงๆ (dump ทุก field ของทุก permission ที่มีอยู่จริงตอนนี้)
        // แทนอาร์เรย์เดิม+5 loop ที่เคย generate เอง — เพราะมีคนจัดระเบียบเมนูใหม่ทั้งระบบผ่านหน้า /permissions
        // (เปลี่ยน sort_order เป็นเลขหลักร้อยตามหมวด, ย้าย group ของหลายเมนู เช่น stock_issue/custom_quotation
        // ย้ายจาก "ขาย" ไป "งานเช่า", material_issue ย้ายไป "คลังสินค้า") ทำให้ assumption เดิมของ loop ที่ว่า
        // "ทุก doc-type ในกลุ่มเดียวกันตายตัว" ใช้ไม่ได้แล้วจริง ๆ — เขียนเป็นอาร์เรย์ราบตรงจาก DB แทนเพื่อความ
        // ถูกต้อง 100% แลกกับ DRY ของ loop เดิม (เพิ่ม doc-type ใหม่ในอนาคตต้องพิมพ์เองครบ ไม่ auto-gen ให้แล้ว)
        //
        // 🔄 [2026-09-15] Sync รอบสอง — แก้ sort_order ของกลุ่ม "คลังสินค้า" 5 รายการ (view_stock_on_hand,
        // view_material_issue, view_packing_list, view_movements, view_price_lists) ให้ตรงกับลำดับเมนูจริง
        // หลังมีคนจัดเรียงใหม่ผ่านหน้า /permissions อีกรอบ + เพิ่ม permission ใหม่ '/' (group "หน้าหลัก")
        // ที่ถูกสร้างเพิ่มพร้อมกับชุด role template มาตรฐาน (ดู DefaultRoleTemplatesSeeder.php)
        $permissions = [
            // 🏠 หมวด หน้าหลัก — สร้างเพิ่มพร้อมชุด role template มาตรฐาน (ดู DefaultRoleTemplatesSeeder.php)
            ['name' => '/', 'group' => 'หน้าหลัก', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'หน้าหลัก', 'path' => '/', 'icon' => 'LayoutDashboard'],

            // 📊 หมวด ภาพรวม
            ['name' => 'view_dashboard', 'group' => 'ภาพรวมระบบ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'Dashboard', 'path' => '/dashboard', 'icon' => 'LayoutDashboard', 'sort_order' => 1],

            // 🏗️ หมวด โครงการ (Project)
            ['name' => 'view_projects', 'group' => 'โครงการ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'โครงการ', 'path' => '/projects', 'icon' => 'FolderKanban', 'sort_order' => 100],
            ['name' => 'create_projects', 'group' => 'โครงการ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างโครงการ', 'icon' => 'FolderKey'],
            ['name' => 'edit_projects', 'group' => 'โครงการ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขโครงการ', 'icon' => 'FolderKey'],
            ['name' => 'delete_projects', 'group' => 'โครงการ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบโครงการ', 'icon' => 'FolderKey'],

            // 🛒 หมวด จัดซื้อ (Purchase)
            ['name' => 'view_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบสั่งซื้อ', 'path' => '/purchase-orders', 'icon' => 'ShoppingCart', 'sort_order' => 200],
            ['name' => 'stock_in_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'รับสินค้า', 'path' => '/goods-receipts', 'icon' => 'PackagePlus', 'sort_order' => 210],
            ['name' => 'view_contractor_work_orders', 'group' => 'จัดซื้อ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบสั่งซื้อ/จ้าง', 'path' => '/contractor-work-orders', 'icon' => 'HardHat', 'sort_order' => 220],
            ['name' => 'bt_create_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบสั่งซื้อ'],
            ['name' => 'bt_edit_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบสั่งซื้อ', 'icon' => 'ShoppingCart'],
            ['name' => 'bt_delete_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบสั่งซื้อ'],
            ['name' => 'bt_approve_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบสั่งซื้อ', 'icon' => 'ShoppingCart'],
            ['name' => 'bt_create_goods_receipt', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบรับสินค้าจาก PO', 'icon' => 'ShoppingCart'],
            ['name' => 'bt_create_goods_receipt_no_po', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบรับสินค้าไม่มี PO', 'icon' => 'ShoppingCart'],
            // 🛡️ ห้ามใส่กลับ: create_purchase/edit_purchase/delete_purchase/approve_purchase/
            // create_goods_receipt/create_goods_receipt_no_po/bt_InventoryAdjustment (ชื่อเดิมที่เคยเป็น
            // orphan ไม่มี group/title_th ถูกลบออกจากระบบไปแล้ว)

            // 🎪 หมวด งานเช่า (Rental Jobs) — เทียบเท่าโครงการ (peer module) ไม่ใช่โมดูลย่อยของโครงการ
            ['name' => 'view_rental_jobs', 'group' => 'งานเช่า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'งานเช่า', 'path' => '/rental-jobs', 'icon' => 'Spotlight', 'sort_order' => 500],
            ['name' => 'view_custom_quotation', 'group' => 'งานเช่า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบเสนอราคา (กำหนดเอง)', 'path' => '/sales/custom-quotations', 'icon' => 'FilePen', 'sort_order' => 510],
            ['name' => 'view_stock_issue', 'group' => 'งานเช่า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'เบิกสินค้าเช่า', 'path' => '/sales/stock-issues', 'icon' => 'PackageMinus', 'sort_order' => 520],
            ['name' => 'view_rental_stock_return', 'group' => 'งานเช่า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'คืนสินค้าเช่า', 'path' => '/sales/rental-stock-returns', 'icon' => 'PackagePlus', 'sort_order' => 530],
            ['name' => 'create_rental_jobs', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างงานเช่า', 'icon' => 'FolderKey'],
            ['name' => 'edit_rental_jobs', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขงานเช่า', 'icon' => 'FolderKey'],
            ['name' => 'delete_rental_jobs', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบงานเช่า', 'icon' => 'FolderKey'],
            ['name' => 'create_custom_quotation', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบเสนอราคา (กำหนดเอง)', 'icon' => 'Receipt'],
            ['name' => 'edit_custom_quotation', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบเสนอราคา (กำหนดเอง)', 'icon' => 'Receipt'],
            ['name' => 'delete_custom_quotation', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบเสนอราคา (กำหนดเอง)', 'icon' => 'Receipt'],
            ['name' => 'approve_custom_quotation', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบเสนอราคา (กำหนดเอง)', 'icon' => 'Receipt'],
            ['name' => 'create_stock_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบเบิกสินค้าเช่า', 'icon' => 'Receipt'],
            ['name' => 'edit_stock_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบเบิกสินค้าเช่า', 'icon' => 'Receipt'],
            ['name' => 'delete_stock_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบเบิกสินค้าเช่า', 'icon' => 'Receipt'],
            ['name' => 'approve_stock_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบเบิกสินค้าเช่า', 'icon' => 'Receipt'],
            ['name' => 'create_rental_stock_return', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบคืนสินค้าเช่า', 'icon' => 'FolderKey'],
            ['name' => 'edit_rental_stock_return', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบคืนสินค้าเช่า', 'icon' => 'FolderKey'],
            ['name' => 'delete_rental_stock_return', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบคืนสินค้าเช่า', 'icon' => 'FolderKey'],
            ['name' => 'approve_rental_stock_return', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบคืนสินค้าเช่า', 'icon' => 'FolderKey'],
            // 🛡️ create/edit/delete/approve_custom_quotation กับ _stock_issue ยังอยู่ group "ขาย" ตาม DB จริง
            // แม้ view_* ของมันจะย้ายไป "งานเช่า" แล้วก็ตาม (สถานะจริงตอนนี้ ยังไม่ได้ตามไปย้ายด้วย)

            // 🔧 หมวด งานซ่อม (Repairs)
            ['name' => 'create_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างงานซ่อม', 'icon' => 'FolderKey'],
            ['name' => 'edit_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขงานซ่อม', 'icon' => 'FolderKey'],
            ['name' => 'transition_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ทั่วไป', 'title_th' => 'สิทธิ์เปลี่ยนสถานะงานซ่อม', 'icon' => 'FolderKey'],
            ['name' => 'bill_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ทั่วไป', 'title_th' => 'สิทธิ์ออกบิล/เก็บเงินค่าซ่อม', 'icon' => 'FolderKey'],
            ['name' => 'delete_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบงานซ่อม', 'icon' => 'FolderKey'],

            // 🏗️ หมวด งานติดตั้ง (Installations)
            ['name' => 'create_installations', 'group' => 'งานติดตั้ง', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างงานติดตั้ง', 'icon' => 'FolderKey'],
            ['name' => 'edit_installations', 'group' => 'งานติดตั้ง', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขงานติดตั้ง', 'icon' => 'FolderKey'],
            ['name' => 'transition_installations', 'group' => 'งานติดตั้ง', 'sub_group' => 'ทั่วไป', 'title_th' => 'สิทธิ์เปลี่ยนสถานะงานติดตั้ง', 'icon' => 'FolderKey'],
            ['name' => 'delete_installations', 'group' => 'งานติดตั้ง', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบงานติดตั้ง', 'icon' => 'FolderKey'],

            // 🧰 หมวด งานบริการ (Service) — view_repairs/view_installations ย้ายมาอยู่กลุ่มนี้แล้วจริงตาม DB
            ['name' => 'view_repairs', 'group' => 'งานบริการ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'รายการแจ้งซ่อม', 'path' => '/repairs', 'icon' => 'Wrench', 'sort_order' => 600],
            ['name' => 'view_installations', 'group' => 'งานบริการ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'บันทึกการติดตั้ง', 'path' => '/installations', 'icon' => 'Drill', 'sort_order' => 610],

            // 📦 หมวด คลังสินค้า (Inventory)
            ['name' => 'view_products', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'รายการสินค้า', 'path' => '/products', 'icon' => 'Package', 'sort_order' => 300],
            ['name' => 'view_material_issue', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบเบิกสินค้า', 'path' => '/sales/material-issues', 'icon' => 'PackageMinus', 'sort_order' => 302],
            // 🆕 สินค้าคงเหลือ — แยกรายชิ้นตาม S/N / รายล็อต พร้อมต้นทุนจริงจากชั้นข้อมูลล็อต FIFO (ดู StockOnHandMenuSeeder ที่รันแยกได้บน production เดิม)
            ['name' => 'view_stock_on_hand', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'สินค้าคงเหลือ', 'path' => '/stock-on-hand', 'icon' => 'Boxes', 'sort_order' => 301],
            // 🆕 Price List ผู้จำหน่าย — แคตตาล็อกราคาที่แต่ละ vendor ตั้งไว้ต่อสินค้า (ดู PriceListMenuSeeder ที่รันแยกได้บน production เดิม)
            // 🔄 [2026-09-15] sort_order sync กับสถานะจริงหลังจัดเรียงเมนูใหม่ผ่านหน้า /permissions
            ['name' => 'view_price_lists', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'Price List ผู้จำหน่าย', 'path' => '/price-lists', 'icon' => 'Tags', 'sort_order' => 305],
            // 🆕 [2026-09-12] ใบจัดสินค้า — ขั้นตอนเลือก S/N จากใบเบิกสินค้าที่อนุมัติแล้ว ก่อนตัดออกจริงตอนอนุมัติ
            // ใบกำกับภาษี/ใบส่งสินค้า (ดู SaleDocumentController::store() branch $materialIssueLock)
            ['name' => 'view_packing_list', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบจัดสินค้า', 'path' => '/sales/packing-lists', 'icon' => 'PackageCheck', 'sort_order' => 303],
            ['name' => 'view_movements', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ประวัติรายการ', 'path' => '/stock-movements', 'icon' => 'History', 'sort_order' => 304],
            ['name' => 'manage_warehouses', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'จัดการคลังสินค้า', 'path' => '/warehouses', 'icon' => 'Store', 'sort_order' => 306],
            // 🆕 [2026-09-17] ใบเบิกวัสดุ/บริการสำหรับงานติดตั้ง — แทนที่ InstallationEquipmentItem เดิม (บันทึก
            // ต้นทุนไว้ดูเฉยๆ ไม่ตัดสต๊อกจริง) ด้วยเอกสาร sale_documents ตัวใหม่ที่ตัดสต๊อกจริงทันทีหลังอนุมัติ
            ['name' => 'view_installation_issue', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบเบิกวัสดุติดตั้ง', 'path' => '/sales/installation-issues', 'icon' => 'HardHat', 'sort_order' => 308],
            // 🆕 [2026-09-09] เพิ่มใหม่ — เดิม product_categories/units มีแค่ "เพิ่ม" ผ่าน MasterDataController
            // (ปุ่ม "+ เพิ่ม..." ใน combobox ตอนสร้างสินค้า) ไม่มีหน้าจัดการ/แก้ไข/ลบเลย ต่างจาก warehouses
            ['name' => 'manage_categories', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'จัดการหมวดหมู่สินค้า', 'path' => '/product-categories', 'icon' => 'Tags', 'sort_order' => 335],
            ['name' => 'manage_units', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'จัดการหน่วยนับ', 'path' => '/units', 'icon' => 'Scale', 'sort_order' => 340],
            ['name' => 'view_loan_issue', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบยืมสินค้า', 'path' => '/loans/issues', 'icon' => 'FileBox', 'sort_order' => 370],
            ['name' => 'view_loan_return', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบคืนสินค้ายืม', 'path' => '/loans/returns', 'icon' => 'FileBox', 'sort_order' => 380],
            ['name' => 'manage_products', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'เพิ่มข้อมูลสินค้า', 'icon' => 'FolderKey'],
            ['name' => 'export_products', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มส่งออกสินค้า', 'icon' => 'Package'],
            ['name' => 'import_products', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มนำเข้าสินค้า', 'icon' => 'Package'],
            ['name' => 'stock_adjustment', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มปรับปรุงสต๊อก', 'icon' => 'Package'],
            ['name' => 'manage_price_lists', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มจัดการ Price List', 'icon' => 'Tags'],
            ['name' => 'import_price_lists', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มนำเข้า Price List', 'icon' => 'Tags'],
            ['name' => 'export_price_lists', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มส่งออก Price List', 'icon' => 'Tags'],
            ['name' => 'create_material_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบเบิกสินค้า', 'icon' => 'Receipt'],
            ['name' => 'edit_material_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบเบิกสินค้า', 'icon' => 'Receipt'],
            ['name' => 'delete_material_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบเบิกสินค้า', 'icon' => 'Receipt'],
            ['name' => 'approve_material_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบเบิกสินค้า', 'icon' => 'Receipt'],
            ['name' => 'create_installation_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบเบิกวัสดุติดตั้ง', 'icon' => 'HardHat'],
            ['name' => 'edit_installation_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบเบิกวัสดุติดตั้ง', 'icon' => 'HardHat'],
            ['name' => 'delete_installation_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบเบิกวัสดุติดตั้ง', 'icon' => 'HardHat'],
            ['name' => 'approve_installation_issue', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบเบิกวัสดุติดตั้ง', 'icon' => 'HardHat'],
            ['name' => 'create_packing_list', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบจัดสินค้า', 'icon' => 'PackageCheck'],
            ['name' => 'edit_packing_list', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบจัดสินค้า', 'icon' => 'PackageCheck'],
            ['name' => 'delete_packing_list', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบจัดสินค้า', 'icon' => 'PackageCheck'],
            ['name' => 'approve_packing_list', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบจัดสินค้า', 'icon' => 'PackageCheck'],
            ['name' => 'create_loan_issue', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบยืมสินค้า', 'icon' => 'Package'],
            ['name' => 'edit_loan_issue', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบยืมสินค้า', 'icon' => 'Package'],
            ['name' => 'delete_loan_issue', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบยืมสินค้า', 'icon' => 'Package'],
            ['name' => 'approve_loan_issue', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบยืมสินค้า', 'icon' => 'Package'],
            ['name' => 'create_loan_return', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบคืนสินค้า', 'icon' => 'Package'],
            ['name' => 'edit_loan_return', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบคืนสินค้า', 'icon' => 'Package'],
            ['name' => 'delete_loan_return', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบคืนสินค้า', 'icon' => 'Package'],
            ['name' => 'approve_loan_return', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบคืนสินค้า', 'icon' => 'Package'],
            // 🚀 ปุ่มรับเข้า/เบิกออกสต็อกแบบละเอียด (ทีละรายการ/หลายรายการ/อ้างอิง PO หรือ Invoice) — ยังไม่มี
            // sub_group="ปุ่ม" ใน DB จริงตอนนี้ (ปล่อยตามสภาพ ไม่ปรับเพิ่มเองนอกเหนือคำขอ)
            ['name' => 'stock_in_single', 'group' => 'คลังสินค้า', 'title_th' => 'รับเข้าสินค้าทีละรายการ', 'icon' => 'Package'],
            ['name' => 'stock_in_multi', 'group' => 'คลังสินค้า', 'title_th' => 'รับเข้าสินค้าหลายรายการ', 'icon' => 'Package'],
            ['name' => 'stock_in_po', 'group' => 'คลังสินค้า', 'title_th' => 'รับเข้าสินค้าจากใบสั่งซื้อ (PO)', 'icon' => 'Package'],
            ['name' => 'stock_out_single', 'group' => 'คลังสินค้า', 'title_th' => 'เบิกสินค้าทีละรายการ', 'icon' => 'Package'],
            ['name' => 'stock_out_multi', 'group' => 'คลังสินค้า', 'title_th' => 'เบิกสินค้าหลายรายการ', 'icon' => 'Package'],
            ['name' => 'stock_out_inv', 'group' => 'คลังสินค้า', 'title_th' => 'เบิกสินค้าจากเลข Invoice', 'icon' => 'Package'],
            // 🗑️ [2026-09-17] ลบ menu_stock_in (/stock/in) และ menu_stock_out (/stock/out) ตามที่ผู้ใช้ยืนยัน —
            // ไม่มีหน้าเพจจริงรองรับแล้ว (เมนูค้างจากของเก่าที่เลิกใช้ ลบโฟลเดอร์ src/app/stock/in, stock/out
            // ออกไปแล้วด้วย) — sync คู่กับการลบใน RolesAndPermissionsSeeder.php
            // 🆕 [2026-09-09] เพิ่มใหม่ — เดิมระบบไม่มีฟีเจอร์โอนย้ายสินค้าระหว่างคลังเลย ต้องเบิกออก+รับเข้า
            // แยก 2 ขั้นตอนเอง ต่างจาก menu_stock_in/out เดิมตรงนี้ตั้งใจใส่ is_menu=true เพื่อให้ขึ้นเมนูจริง
            // 🛡️ [2026-09-09] sort_order=307 (ไม่ใช่ 6) — ให้ตรงกับค่าจริงที่ถูกจัดลำดับเมนูใหม่ผ่านหน้า
            // /permissions ไปแล้ว (อยู่ระหว่าง view_price_lists=305 กับ manage_warehouses=330 — ดู
            // [2026-09-15] sort_order ของกลุ่มนี้ sync ใหม่อีกรอบ เรียงเป็น view_products=300,
            // view_stock_on_hand=301, view_material_issue=302, view_packing_list=303, view_movements=304,
            // view_price_lists=305) ค่าเดิม (6) ที่เคยใส่ไว้เป็นเลขชุดเก่าของ menu_stock_in/out ทำให้ seed
            // ฐานข้อมูลใหม่ได้ตำแหน่งเมนูผิดจากของจริง
            ['name' => 'menu_stock_transfer', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'โอนย้ายคลังสินค้า', 'path' => '/stock/transfer', 'icon' => 'Truck', 'sort_order' => 307],

            // 🛠️ หมวด สินทรัพย์ถาวร (Fixed Assets — MVP: ทะเบียนทรัพย์ + แจ้งเตือนกำหนดบำรุง)
            ['name' => 'manage_assets', 'group' => 'สินทรัพย์ถาวร', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ทะเบียนสินทรัพย์', 'path' => '/assets', 'icon' => 'Monitor', 'sort_order' => 650],

            // 📞 หมวด ผู้ติดต่อ
            ['name' => 'view_contacts', 'group' => 'รายชื่อผู้ติดต่อ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'สมุดรายชื่อ', 'path' => '/contacts', 'icon' => 'SquareUser', 'sort_order' => 400],
            ['name' => 'create_contacts', 'group' => 'รายชื่อผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างรายชื่อผู้ติดต่อ', 'icon' => 'FolderKey'],
            ['name' => 'edit_contacts', 'group' => 'รายชื่อผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขรายชื่อผู้ติดต่อ', 'icon' => 'FolderKey'],
            ['name' => 'delete_contacts', 'group' => 'รายชื่อผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบรายชื่อผู้ติดต่อ', 'icon' => 'FolderKey'],
            ['name' => 'export_contacts', 'group' => 'รายชื่อผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มส่งออกรายชื่อผู้ติดต่อ'],
            ['name' => 'import_contacts', 'group' => 'รายชื่อผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มนำเข้ารายชื่อผู้ติดต่อ'],

            // 🛠️ ใบสั่งซื้อ/ใบสั่งจ้าง ผู้รับเหมา
            ['name' => 'create_contractor_work_orders', 'group' => 'ผู้รับเหมา', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบสั่งซื้อ-สั่งจ้าง', 'icon' => 'FolderKey'],
            ['name' => 'edit_contractor_work_orders', 'group' => 'ผู้รับเหมา', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบสั่งซื้อ-สั่งจ้าง', 'icon' => 'FolderKey'],
            ['name' => 'delete_contractor_work_orders', 'group' => 'ผู้รับเหมา', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบสั่งซื้อ-สั่งจ้าง', 'icon' => 'FolderKey'],
            ['name' => 'approve_contractor_work_orders', 'group' => 'ผู้รับเหมา', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบสั่งซื้อ-สั่งจ้าง', 'icon' => 'FolderKey'],

            // 📋 ใบคุมสัญญาราชการ
            ['name' => 'view_government_contracts', 'group' => 'สัญญาราชการ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบคุมสัญญาราชการ', 'path' => '/government-contracts', 'icon' => 'FileText', 'sort_order' => 490],
            ['name' => 'create_government_contracts', 'group' => 'สัญญาราชการ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างสัญญาราชการ', 'icon' => 'FolderKey'],
            ['name' => 'edit_government_contracts', 'group' => 'สัญญาราชการ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขสัญญาราชการ', 'icon' => 'FolderKey'],
            ['name' => 'delete_government_contracts', 'group' => 'สัญญาราชการ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบสัญญาราชการ', 'icon' => 'FolderKey'],

            // 📄 หมวด ขาย (Sales) — เอกสารที่เหลือที่ยังอยู่ group "ขาย" ตาม DB จริง
            ['name' => 'view_quotation', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบเสนอราคา', 'path' => '/sales/quotations', 'icon' => 'Receipt', 'sort_order' => 400],
            ['name' => 'view_invoice', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบแจ้งหนี้', 'path' => '/sales/invoices', 'icon' => 'Receipt', 'sort_order' => 406],
            ['name' => 'view_billing_invoice', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบวางบิล', 'path' => '/sales/billing-invoices', 'icon' => 'Receipt', 'sort_order' => 408],
            ['name' => 'view_tax_invoice', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบกำกับภาษี', 'path' => '/sales/tax-invoices', 'icon' => 'Receipt', 'sort_order' => 410],
            ['name' => 'view_delivery_note', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบส่งสินค้า', 'path' => '/sales/delivery-notes', 'icon' => 'Truck', 'sort_order' => 415],
            ['name' => 'view_receipt', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบเสร็จรับเงิน', 'path' => '/sales/receipts', 'icon' => 'Receipt', 'sort_order' => 420],
            ['name' => 'view_cash', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'บิลเงินสด', 'path' => '/sales/cash-sales', 'icon' => 'Receipt', 'sort_order' => 430],
            ['name' => 'view_debit_note', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบเพิ่มหนี้', 'path' => '/sales/debit-notes', 'icon' => 'Receipt', 'sort_order' => 440],
            ['name' => 'view_credit_note', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบลดหนี้', 'path' => '/sales/credit-notes', 'icon' => 'Receipt', 'sort_order' => 450],
            ['name' => 'view_stock_return', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ใบคืนสินค้า (จากใบลดหนี้)', 'path' => '/sales/stock-returns', 'icon' => 'Receipt', 'sort_order' => 455],
            ['name' => 'view_custom_cash', 'group' => 'ขาย', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'บิลเงินสด (กำหนดเอง)', 'path' => '/sales/custom-cash-sales', 'icon' => 'Receipt', 'sort_order' => 460],
            ['name' => 'create_quotation', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบเสนอราคา', 'icon' => 'Receipt'],
            ['name' => 'edit_quotation', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบเสนอราคา', 'icon' => 'Receipt'],
            ['name' => 'delete_quotation', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบเสนอราคา', 'icon' => 'Receipt'],
            ['name' => 'approve_quotation', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบเสนอราคา', 'icon' => 'Receipt'],
            ['name' => 'create_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบแจ้งหนี้', 'icon' => 'Receipt'],
            ['name' => 'edit_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบแจ้งหนี้', 'icon' => 'Receipt'],
            ['name' => 'delete_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบแจ้งหนี้', 'icon' => 'Receipt'],
            ['name' => 'approve_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบแจ้งหนี้', 'icon' => 'Receipt'],
            ['name' => 'create_billing_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบวางบิล', 'icon' => 'Receipt'],
            ['name' => 'edit_billing_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบวางบิล', 'icon' => 'Receipt'],
            ['name' => 'delete_billing_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบวางบิล', 'icon' => 'Receipt'],
            ['name' => 'approve_billing_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบวางบิล', 'icon' => 'Receipt'],
            ['name' => 'create_tax_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบกำกับภาษี', 'icon' => 'Receipt'],
            ['name' => 'edit_tax_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบกำกับภาษี', 'icon' => 'Receipt'],
            ['name' => 'delete_tax_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบกำกับภาษี', 'icon' => 'Receipt'],
            ['name' => 'approve_tax_invoice', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบกำกับภาษี', 'icon' => 'Receipt'],
            ['name' => 'create_delivery_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบส่งสินค้า', 'icon' => 'Receipt'],
            ['name' => 'edit_delivery_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบส่งสินค้า', 'icon' => 'Receipt'],
            ['name' => 'delete_delivery_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบส่งสินค้า', 'icon' => 'Receipt'],
            ['name' => 'approve_delivery_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบส่งสินค้า', 'icon' => 'Receipt'],
            ['name' => 'create_receipt', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบเสร็จรับเงิน', 'icon' => 'Receipt'],
            ['name' => 'edit_receipt', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบเสร็จรับเงิน', 'icon' => 'Receipt'],
            ['name' => 'delete_receipt', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบเสร็จรับเงิน', 'icon' => 'Receipt'],
            ['name' => 'approve_receipt', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบเสร็จรับเงิน', 'icon' => 'Receipt'],
            ['name' => 'create_cash', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างบิลเงินสด', 'icon' => 'Receipt'],
            ['name' => 'edit_cash', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขบิลเงินสด', 'icon' => 'Receipt'],
            ['name' => 'delete_cash', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบบิลเงินสด', 'icon' => 'Receipt'],
            ['name' => 'approve_cash', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติบิลเงินสด', 'icon' => 'Receipt'],
            ['name' => 'create_debit_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบเพิ่มหนี้', 'icon' => 'Receipt'],
            ['name' => 'edit_debit_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบเพิ่มหนี้', 'icon' => 'Receipt'],
            ['name' => 'delete_debit_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบเพิ่มหนี้', 'icon' => 'Receipt'],
            ['name' => 'approve_debit_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบเพิ่มหนี้', 'icon' => 'Receipt'],
            ['name' => 'create_credit_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบลดหนี้'],
            ['name' => 'edit_credit_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบลดหนี้', 'icon' => 'Receipt'],
            ['name' => 'delete_credit_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบลดหนี้', 'icon' => 'Receipt'],
            ['name' => 'approve_credit_note', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบลดหนี้', 'icon' => 'Receipt'],
            ['name' => 'create_stock_return', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบคืนสินค้า (จากใบลดหนี้)', 'icon' => 'Receipt'],
            ['name' => 'edit_stock_return', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบคืนสินค้า (จากใบลดหนี้)', 'icon' => 'Receipt'],
            ['name' => 'delete_stock_return', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบคืนสินค้า (จากใบลดหนี้)', 'icon' => 'Receipt'],
            ['name' => 'approve_stock_return', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบคืนสินค้า (จากใบลดหนี้)', 'icon' => 'Receipt'],
            ['name' => 'create_custom_cash', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างบิลเงินสด (กำหนดเอง)', 'icon' => 'Receipt'],
            ['name' => 'edit_custom_cash', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขบิลเงินสด (กำหนดเอง)', 'icon' => 'Receipt'],
            ['name' => 'delete_custom_cash', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบบิลเงินสด (กำหนดเอง)', 'icon' => 'Receipt'],
            ['name' => 'approve_custom_cash', 'group' => 'ขาย', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติบิลเงินสด (กำหนดเอง)', 'icon' => 'Receipt'],

            // ⚙️ หมวด ตั้งค่าระบบ
            ['name' => 'manage_company', 'group' => 'ตั้งค่าระบบ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ข้อมูลบริษัท', 'path' => '/company', 'icon' => 'Settings', 'sort_order' => 900],
            ['name' => 'manage_users', 'group' => 'ตั้งค่าระบบ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'จัดการผู้ใช้งาน', 'path' => '/users', 'icon' => 'Settings', 'sort_order' => 905],
            ['name' => 'manage_roles', 'group' => 'ตั้งค่าระบบ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'บทบาท (Roles)', 'path' => '/roles', 'icon' => 'UserKey', 'sort_order' => 980],
            ['name' => 'manage_permissions', 'group' => 'ตั้งค่าระบบ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'สิทธิ์การใช้งาน', 'path' => '/permissions', 'icon' => 'Settings', 'sort_order' => 999],
            ['name' => 'view_activity_log', 'group' => 'ตั้งค่าระบบ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'ประวัติการใช้งาน', 'path' => '/logs', 'icon' => 'History', 'sort_order' => 906],
            ['name' => 'manage_document_layout', 'group' => 'ตั้งค่าระบบ', 'sub_group' => 'ทั่วไป', 'is_menu' => true, 'title_th' => 'การจัดวางเอกสาร', 'path' => '/document-layout', 'icon' => 'LayoutTemplate', 'sort_order' => 901],

            // 📊 หมวด รายงาน (Reports) — sub_group ของแต่ละรายงานตรงกับกลุ่มเนื้อหา ไม่ใช่ "รายงาน" ซ้ำ
            ['name' => 'view_reports', 'group' => 'รายงาน', 'sub_group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'รายงานประวัติ S/N', 'path' => '/reports/serial-history', 'icon' => 'History', 'sort_order' => 800],
            ['name' => 'view_reports_project_profitability', 'group' => 'รายงาน', 'sub_group' => 'โครงการ', 'is_menu' => true, 'title_th' => 'กำไรขาดทุนโครงการ', 'path' => '/reports/project-profitability', 'icon' => 'FolderKanban', 'sort_order' => 800],
            ['name' => 'view_reports_inventory', 'group' => 'รายงาน', 'sub_group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'รายงานสินค้าคงเหลือ', 'path' => '/reports/inventory-valuation', 'icon' => 'Archive', 'sort_order' => 801],
            ['name' => 'view_reports_low_stock', 'group' => 'รายงาน', 'sub_group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'สินค้าใกล้หมด', 'path' => '/reports/low-stock', 'icon' => 'AlertTriangle', 'sort_order' => 802],
            ['name' => 'view_reports_slow_moving_stock', 'group' => 'รายงาน', 'sub_group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'สินค้าเคลื่อนไหวช้า', 'path' => '/reports/slow-moving-stock', 'icon' => 'PackageSearch', 'sort_order' => 803],
            ['name' => 'view_reports_stock_by_warehouse', 'group' => 'รายงาน', 'sub_group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'สต๊อกแยกตามคลัง', 'path' => '/reports/stock-by-warehouse', 'icon' => 'Warehouse', 'sort_order' => 804],
            ['name' => 'view_reports_stock_movement_ledger', 'group' => 'รายงาน', 'sub_group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'บัญชีเดินสต๊อก', 'path' => '/reports/stock-movement-ledger', 'icon' => 'History', 'sort_order' => 805],
            ['name' => 'view_reports_warranty_expiry', 'group' => 'รายงาน', 'sub_group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'สินค้าใกล้หมดประกัน', 'path' => '/reports/warranty-expiry', 'icon' => 'ShieldAlert', 'sort_order' => 806],
            ['name' => 'view_reports_sales', 'group' => 'รายงาน', 'sub_group' => 'ขาย', 'is_menu' => true, 'title_th' => 'รายงานยอดขาย', 'path' => '/reports/sales-summary', 'icon' => 'PieChart', 'sort_order' => 810],
            ['name' => 'view_reports_top_customers', 'group' => 'รายงาน', 'sub_group' => 'ขาย', 'is_menu' => true, 'title_th' => 'รายงานลูกค้าซื้อสูงสุด', 'path' => '/reports/top-customers', 'icon' => 'Users', 'sort_order' => 811],
            ['name' => 'view_reports_sales_all', 'group' => 'รายงาน', 'sub_group' => 'ขาย', 'is_menu' => true, 'title_th' => 'เอกสารขายทั้งหมด', 'path' => '/reports/sales', 'icon' => 'Receipt', 'sort_order' => 812],
            ['name' => 'view_reports_sales_trend', 'group' => 'รายงาน', 'sub_group' => 'ขาย', 'is_menu' => true, 'title_th' => 'แนวโน้มยอดขาย', 'path' => '/reports/sales-trend', 'icon' => 'TrendingUp', 'sort_order' => 813],
            ['name' => 'view_reports_sales_margin', 'group' => 'รายงาน', 'sub_group' => 'ขาย', 'is_menu' => true, 'title_th' => 'กำไรขั้นต้นจากการขาย', 'path' => '/reports/sales-margin', 'icon' => 'Percent', 'sort_order' => 814],
            ['name' => 'view_reports_sales_by_salesperson', 'group' => 'รายงาน', 'sub_group' => 'ขาย', 'is_menu' => true, 'title_th' => 'ยอดขายตามพนักงานขาย', 'path' => '/reports/sales-by-salesperson', 'icon' => 'UserCheck', 'sort_order' => 815],
            ['name' => 'view_reports_quotation_conversion', 'group' => 'รายงาน', 'sub_group' => 'ขาย', 'is_menu' => true, 'title_th' => 'อัตราปิดใบเสนอราคา', 'path' => '/reports/quotation-conversion', 'icon' => 'FileCheck2', 'sort_order' => 816],
            ['name' => 'view_reports_ar_aging', 'group' => 'รายงาน', 'sub_group' => 'ขาย', 'is_menu' => true, 'title_th' => 'อายุลูกหนี้ (AR Aging)', 'path' => '/reports/ar-aging', 'icon' => 'Clock', 'sort_order' => 817],
            ['name' => 'view_reports_purchases', 'group' => 'รายงาน', 'sub_group' => 'จัดซื้อ', 'is_menu' => true, 'title_th' => 'รายงานจัดซื้อ', 'path' => '/reports/purchases', 'icon' => 'ShoppingCart', 'sort_order' => 830],
            ['name' => 'view_reports_purchase_summary', 'group' => 'รายงาน', 'sub_group' => 'จัดซื้อ', 'is_menu' => true, 'title_th' => 'สรุปยอดจัดซื้อ', 'path' => '/reports/purchase-summary', 'icon' => 'PieChart', 'sort_order' => 831],
            ['name' => 'view_reports_top_suppliers', 'group' => 'รายงาน', 'sub_group' => 'จัดซื้อ', 'is_menu' => true, 'title_th' => 'ซัพพลายเออร์อันดับต้น', 'path' => '/reports/top-suppliers', 'icon' => 'Truck', 'sort_order' => 832],
            ['name' => 'view_reports_po_backorder', 'group' => 'รายงาน', 'sub_group' => 'จัดซื้อ', 'is_menu' => true, 'title_th' => 'PO ค้างรับ/ยังไม่ครบ', 'path' => '/reports/po-backorder', 'icon' => 'PackageX', 'sort_order' => 833],
            ['name' => 'view_reports_supplier_price_comparison', 'group' => 'รายงาน', 'sub_group' => 'จัดซื้อ', 'is_menu' => true, 'title_th' => 'เปรียบเทียบราคาซื้อ', 'path' => '/reports/supplier-price-comparison', 'icon' => 'Scale', 'sort_order' => 834],
            ['name' => 'view_reports_ap_aging', 'group' => 'รายงาน', 'sub_group' => 'จัดซื้อ', 'is_menu' => true, 'title_th' => 'อายุเจ้าหนี้ (AP Aging)', 'path' => '/reports/ap-aging', 'icon' => 'Clock', 'sort_order' => 835],
            ['name' => 'view_reports_installations', 'group' => 'รายงาน', 'sub_group' => 'งานติดตั้ง', 'is_menu' => true, 'title_th' => 'รายงานสรุปงานติดตั้ง', 'path' => '/reports/installations-summary', 'icon' => 'LineChart', 'sort_order' => 840],
            ['name' => 'view_reports_installations_by_project', 'group' => 'รายงาน', 'sub_group' => 'งานติดตั้ง', 'is_menu' => true, 'title_th' => 'งานติดตั้งแยกตามโครงการ', 'path' => '/reports/installations-by-project', 'icon' => 'MapPin', 'sort_order' => 841],
            ['name' => 'view_reports_repairs', 'group' => 'รายงาน', 'sub_group' => 'งานซ่อม', 'is_menu' => true, 'title_th' => 'รายงานสรุปงานซ่อม', 'path' => '/reports/repairs-summary', 'icon' => 'BarChart3', 'sort_order' => 850],
            ['name' => 'view_reports_repair_turnaround', 'group' => 'รายงาน', 'sub_group' => 'งานซ่อม', 'is_menu' => true, 'title_th' => 'ระยะเวลาซ่อมเฉลี่ย', 'path' => '/reports/repair-turnaround', 'icon' => 'Timer', 'sort_order' => 851],
            ['name' => 'view_reports_repair_cost_trend', 'group' => 'รายงาน', 'sub_group' => 'งานซ่อม', 'is_menu' => true, 'title_th' => 'แนวโน้มค่าใช้จ่ายซ่อม', 'path' => '/reports/repair-cost-trend', 'icon' => 'LineChart', 'sort_order' => 852],
            ['name' => 'view_reports_frequently_repaired_products', 'group' => 'รายงาน', 'sub_group' => 'งานซ่อม', 'is_menu' => true, 'title_th' => 'สินค้าที่ซ่อมบ่อย', 'path' => '/reports/frequently-repaired-products', 'icon' => 'Wrench', 'sort_order' => 853],
            ['name' => 'view_reports_rental_jobs', 'group' => 'รายงาน', 'sub_group' => 'งานเช่า', 'is_menu' => true, 'title_th' => 'สรุปงานเช่า', 'path' => '/reports/rental-jobs', 'icon' => 'Spotlight', 'sort_order' => 860],
            ['name' => 'view_reports_overdue_rentals', 'group' => 'รายงาน', 'sub_group' => 'งานเช่า', 'is_menu' => true, 'title_th' => 'งานเช่าค้างคืนเกินกำหนด', 'path' => '/reports/overdue-rentals', 'icon' => 'AlertTriangle', 'sort_order' => 861],
            ['name' => 'view_reports_asset_maintenance_due', 'group' => 'รายงาน', 'sub_group' => 'สินทรัพย์ถาวร', 'is_menu' => true, 'title_th' => 'ทรัพย์สินถึงกำหนดบำรุงรักษา', 'path' => '/reports/asset-maintenance-due', 'icon' => 'Wrench', 'sort_order' => 890],
            ['name' => 'view_reports_executive', 'group' => 'รายงาน', 'sub_group' => 'ผู้บริหาร', 'is_menu' => true, 'title_th' => 'รายงานสำหรับผู้บริหาร', 'path' => '/reports/executive-summary', 'icon' => 'Wallet', 'sort_order' => 895],
        ];

        // วนลูปบันทึก Permission ทีละตัว
        // 🛡️ firstOrCreate() (ไม่ใช่ firstOrNew()+save() แบบเดิม) — set group/sub_group/is_menu/title_th/
        // path/icon/sort_order เฉพาะตอน "สร้างแถวใหม่" เท่านั้น ถ้าแถวมีอยู่แล้วจะไม่แตะ field พวกนี้เลย
        // เดิมโค้ดนี้เขียนทับค่าพวกนี้ทุกครั้งที่รัน db:seed ไม่ว่าแถวจะมีอยู่แล้วหรือไม่ ทำให้การแก้ title_th/
        // sub_group ผ่านหน้า /permissions (ของจริงที่ admin ใช้กันอยู่) หายไปทุกครั้งที่มีคนรัน seeder ซ้ำ —
        // pattern เดียวกับที่ ReportsMenuSeeder.php ใช้กับ 8 รายการเดิมอยู่แล้ว (บรรทัด 76-92 ของไฟล์นั้น)
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(
                ['name' => $perm['name'], 'guard_name' => 'web'],
                [
                    'group' => $perm['group'] ?? null,
                    'sub_group' => $perm['sub_group'] ?? null,
                    'is_menu' => $perm['is_menu'] ?? false,
                    'title_th' => $perm['title_th'] ?? null,
                    'path' => $perm['path'] ?? null,
                    'icon' => $perm['icon'] ?? null,
                    'sort_order' => $perm['sort_order'] ?? 0,
                ],
            );
        }

        // 📊 เติม sub_group ให้ปุ่มรายงานเดิม + ลงทะเบียนหน้ารายงานที่ตกหล่นอีก 24 หน้าเป็นเมนู (ดูรายละเอียด
        // ในไฟล์ตัวเอง) — ต้องรันหลังลูปด้านบนเสมอ เพราะ 8 รายการเดิมต้องถูกสร้างในตาราง permissions ก่อน
        $this->call(ReportsMenuSeeder::class);
        $this->call(StockOnHandMenuSeeder::class);
        $this->call(PriceListMenuSeeder::class);

        // ==========================================
        // 👑 2. สร้าง Role สูงสุด (Super Admin)
        // ==========================================
        $roleSuper = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
        if (!$roleSuper->is_company_admin) {
            $roleSuper->update(['is_company_admin' => true]);
        }
        $roleSuper->syncPermissions(Permission::all());

        // ==========================================
        // 🏢 3. สร้างบริษัทเจ้าของระบบ (HQ)
        // ==========================================
        // 🛡️ เดิมเช็คจาก tax_id='0000000000000' แต่ field นี้แก้ไขได้ผ่านหน้าตั้งค่าบริษัท —
        // พอบริษัทจริงถูกแก้ tax_id เป็นเลขจริงแล้ว firstOrCreate ก็หาไม่เจอ สร้างบริษัทซ้ำใหม่ทุกครั้งที่รัน seed ซ้ำ
        // เปลี่ยนมาเช็คจาก id=1 (แถวแรกสุดของระบบ ไม่มีทางแก้ไขได้) แทน ถ้ามีอยู่แล้วก็ใช้เลย ไม่สร้างซ้ำไม่ว่า tax_id จะถูกแก้เป็นอะไร
        $hqCompany = Company::find(1) ?? Company::create([
            'name' => 'MINI ERP SYSTEM',
            'tax_id' => '0000000000000',
            'phone' => '02-000-0000',
            'address' => 'Bangkok, Thailand'
        ]);

        // 🚀 บริษัทต้องมีคลังหลัก (default warehouse) เสมอ ไม่งั้น stock movement จะหา warehouse ไม่เจอ
        if (!Warehouse::where('company_id', $hqCompany->id)->where('is_default', true)->exists()) {
            Warehouse::firstOrCreate(
                ['company_id' => $hqCompany->id, 'name' => 'คลังหลัก'],
                ['is_default' => true]
            );
        }

        // ==========================================
        // 🏷️ 3.5 สร้างประเภทสินค้าเริ่มต้น (Default Product Categories)
        // ==========================================
        $defaultCategories = ['Sound System', 'Visual System', 'Lighting System', 'Security System', 'IT Solution', 'Network System', 'เช่า', 'ติดตั้ง', 'ซ่อม',];
        foreach ($defaultCategories as $categoryName) {
            \App\Models\ProductCategory::firstOrCreate(
                ['name' => $categoryName, 'company_id' => $hqCompany->id],
                ['company_id' => $hqCompany->id]
            );
        }

        // ==========================================
        // 🧑‍💼 3.6 สร้าง Role Template มาตรฐาน (ผู้จัดการ/พนักงาน ครบทุกกลุ่มเมนู)
        // ==========================================
        // 🆕 [2026-09-15] ต้องรันหลัง $hqCompany มีอยู่แล้วเสมอ (ใช้ company_id ผูก role) — ดูรายละเอียดเต็มใน
        // DefaultRoleTemplatesSeeder.php
        $this->call(DefaultRoleTemplatesSeeder::class);

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

        // 🛡️ Spatie permission teams mode เปิดอยู่ (config/permission.php) — model_has_roles.team_id เป็น NOT NULL
        // แต่ค่านี้ถูก set ผ่าน middleware (ResolveActiveCompany) เฉพาะตอน HTTP request เท่านั้น คำสั่ง Artisan (db:seed/tinker)
        // ไม่เคยผ่าน middleware เลยทำให้ teamId ค้างเป็น null แล้ว assignRole() ชน NOT NULL constraint — ต้อง set เองตรงนี้
        // (ถ้าเขียน console command/seeder ใหม่ที่เรียก assignRole()/syncRoles()/givePermissionTo() ตรงบน model ต้องทำแบบเดียวกัน)
        app(\Spatie\Permission\PermissionRegistrar::class)->setPermissionsTeamId($hqCompany->id);
        // 🔁 assignRole() ไม่เช็คซ้ำก่อน insert เอง (ต่างจาก firstOrCreate ที่ใช้ทั้งไฟล์) รันซ้ำแล้วจะชน unique constraint
        // ของ model_has_roles ทันที — ใช้ hasRole() เช็คไม่ได้เพราะ role ตัวนี้ถูก backfill team_id เป็นค่าเก่าจาก migration
        // (คนละ team_id กับ $hqCompany->id ที่ใช้ตอน insert) ทำให้ hasRole() ในบริบท team ปัจจุบันมองไม่เห็น role ที่มีอยู่แล้ว
        // เช็คตรงจากตาราง pivot ด้วย key ชุดเดียวกับที่กำลังจะ insert แทน ปลอดภัยสุดและไม่ต้องยุ่งกับ team scoping ของ role เอง
        $alreadyAssigned = \Illuminate\Support\Facades\DB::table('model_has_roles')
            ->where('model_id', $superAdmin->id)
            ->where('model_type', get_class($superAdmin))
            ->where('role_id', $roleSuper->id)
            ->where('team_id', $hqCompany->id)
            ->exists();
        if (!$alreadyAssigned) {
            $superAdmin->assignRole($roleSuper);
        }

        $this->command->info('✨ ฟื้นคืนชีพฐานข้อมูลสำเร็จ! พร้อมโครงสร้างเมนูที่สวยงาม');
    }
}
