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
        $permissions = [
            // 📊 หมวด แดชบอร์ด
            ['name' => 'view_dashboard', 'group' => 'แดชบอร์ด', 'is_menu' => true, 'title_th' => 'ภาพรวมระบบ', 'path' => '/dashboard', 'icon' => 'LayoutDashboard', 'sort_order' => 1],

            // 🛒 หมวด จัดซื้อ (Purchase)
            ['name' => 'view_purchase', 'group' => 'จัดซื้อ', 'is_menu' => true, 'title_th' => 'ใบสั่งซื้อ (PO)', 'path' => '/purchase-orders', 'icon' => 'ShoppingCart', 'sort_order' => 2],
            ['name' => 'stock_in_purchase', 'group' => 'จัดซื้อ', 'is_menu' => true, 'title_th' => 'รับสินค้า (GR)', 'path' => '/goods-receipts', 'icon' => 'ShoppingCart', 'sort_order' => 3],

            // 🏗️ หมวด โครงการ (Project)
            ['name' => 'view_projects', 'group' => 'โครงการ', 'is_menu' => true, 'title_th' => 'โครงการ', 'path' => '/projects', 'icon' => 'FolderKanban', 'sort_order' => 3],
            ['name' => 'create_projects', 'group' => 'โครงการ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างโครงการ'],
            ['name' => 'edit_projects', 'group' => 'โครงการ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขโครงการ'],
            ['name' => 'delete_projects', 'group' => 'โครงการ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบโครงการ'],

            // 🎪 หมวด งานเช่า (Rental Jobs) — เทียบเท่าโครงการ (peer module) ไม่ใช่โมดูลย่อยของโครงการ
            ['name' => 'view_rental_jobs', 'group' => 'งานเช่า', 'is_menu' => true, 'title_th' => 'งานเช่า', 'path' => '/rental-jobs', 'icon' => 'Spotlight', 'sort_order' => 4],
            ['name' => 'create_rental_jobs', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างงานเช่า'],
            ['name' => 'edit_rental_jobs', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขงานเช่า'],
            ['name' => 'delete_rental_jobs', 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบงานเช่า'],

            // 🔧 หมวด งานซ่อม (Repairs)
            ['name' => 'view_repairs', 'group' => 'งานซ่อม', 'is_menu' => true, 'title_th' => 'รายการแจ้งซ่อม', 'path' => '/repairs', 'icon' => 'Wrench', 'sort_order' => 20],
            ['name' => 'create_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างงานซ่อม'],
            ['name' => 'edit_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขงานซ่อม'],
            ['name' => 'transition_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ทั่วไป', 'title_th' => 'สิทธิ์เปลี่ยนสถานะงานซ่อม'],
            ['name' => 'bill_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ทั่วไป', 'title_th' => 'สิทธิ์ออกบิล/เก็บเงินค่าซ่อม'],
            ['name' => 'delete_repairs', 'group' => 'งานซ่อม', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบงานซ่อม'],

            // 🏗️ หมวด งานติดตั้ง (Installations)
            ['name' => 'view_installations', 'group' => 'งานติดตั้ง', 'is_menu' => true, 'title_th' => 'บันทึกการติดตั้ง', 'path' => '/installations', 'icon' => 'MapPin', 'sort_order' => 21],
            ['name' => 'create_installations', 'group' => 'งานติดตั้ง', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างงานติดตั้ง'],
            ['name' => 'edit_installations', 'group' => 'งานติดตั้ง', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขงานติดตั้ง'],
            ['name' => 'transition_installations', 'group' => 'งานติดตั้ง', 'sub_group' => 'ทั่วไป', 'title_th' => 'สิทธิ์เปลี่ยนสถานะงานติดตั้ง'],
            ['name' => 'delete_installations', 'group' => 'งานติดตั้ง', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบงานติดตั้ง'],

            // 📊 หมวด รายงาน (Reports)
            ['name' => 'view_reports', 'group' => 'รายงาน', 'is_menu' => true, 'title_th' => 'รายงานประวัติ S/N', 'path' => '/reports/serial-history', 'icon' => 'History', 'sort_order' => 30],
            ['name' => 'view_reports_repairs', 'group' => 'รายงาน', 'is_menu' => true, 'title_th' => 'รายงานสรุปงานซ่อม', 'path' => '/reports/repairs-summary', 'icon' => 'BarChart3', 'sort_order' => 31],
            ['name' => 'view_reports_sales', 'group' => 'รายงาน', 'is_menu' => true, 'title_th' => 'รายงานยอดขาย', 'path' => '/reports/sales-summary', 'icon' => 'PieChart', 'sort_order' => 32],
            ['name' => 'view_reports_purchases', 'group' => 'รายงาน', 'is_menu' => true, 'title_th' => 'รายงานจัดซื้อ', 'path' => '/reports/purchases', 'icon' => 'ShoppingCart', 'sort_order' => 33],
            ['name' => 'view_reports_installations', 'group' => 'รายงาน', 'is_menu' => true, 'title_th' => 'รายงานสรุปงานติดตั้ง', 'path' => '/reports/installations-summary', 'icon' => 'LineChart', 'sort_order' => 34],
            ['name' => 'view_reports_top_customers', 'group' => 'รายงาน', 'is_menu' => true, 'title_th' => 'รายงานลูกค้าซื้อสูงสุด', 'path' => '/reports/top-customers', 'icon' => 'Users', 'sort_order' => 35],
            ['name' => 'view_reports_inventory', 'group' => 'รายงาน', 'is_menu' => true, 'title_th' => 'รายงานสินค้าคงเหลือ', 'path' => '/reports/inventory-valuation', 'icon' => 'Archive', 'sort_order' => 36],
            ['name' => 'view_reports_executive', 'group' => 'รายงาน', 'is_menu' => true, 'title_th' => 'รายงานสำหรับผู้บริหาร', 'path' => '/reports/executive-summary', 'icon' => 'Wallet', 'sort_order' => 37],

            // 📦 หมวด คลังสินค้า (Inventory)
            ['name' => 'view_products', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'รายการสินค้า', 'path' => '/products', 'icon' => 'Package', 'sort_order' => 5],
            ['name' => 'view_movements', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'ความเคลื่อนไหวสต๊อก', 'path' => '/stock-movements', 'icon' => 'Package', 'sort_order' => 6],
            ['name' => 'manage_warehouses', 'group' => 'คลังสินค้า', 'is_menu' => true, 'title_th' => 'จัดการสถานที่เก็บ', 'path' => '/warehouses', 'icon' => 'Package', 'sort_order' => 7],

            // 🛠️ หมวด สินทรัพย์ถาวร (Fixed Assets — MVP: ทะเบียนทรัพย์ + แจ้งเตือนกำหนดบำรุง)
            ['name' => 'manage_assets', 'group' => 'สินทรัพย์ถาวร', 'is_menu' => true, 'title_th' => 'ทะเบียนสินทรัพย์', 'path' => '/assets', 'icon' => 'Wrench', 'sort_order' => 20],

            // 📞 หมวด ผู้ติดต่อ
            ['name' => 'view_contacts', 'group' => 'ผู้ติดต่อ', 'is_menu' => true, 'title_th' => 'ลูกค้า & คู่ค้า', 'path' => '/contacts', 'icon' => 'Users', 'sort_order' => 8],

            // ⚙️ หมวด ตั้งค่าระบบ
            ['name' => 'manage_company', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'ข้อมูลบริษัท', 'path' => '/company', 'icon' => 'Settings', 'sort_order' => 9],
            ['name' => 'manage_users', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'จัดการผู้ใช้งาน', 'path' => '/users', 'icon' => 'Settings', 'sort_order' => 10],
            ['name' => 'manage_roles', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'บทบาท (Roles)', 'path' => '/roles', 'icon' => 'Settings', 'sort_order' => 11],
            ['name' => 'manage_permissions', 'group' => 'ตั้งค่าระบบ', 'is_menu' => true, 'title_th' => 'สิทธิ์ (Permissions)', 'path' => '/permissions', 'icon' => 'Settings', 'sort_order' => 12],

            // 🔒 สิทธิ์การทำงานเบื้องหลัง (ไม่แสดงเป็นเมนู แต่ต้องมีในระบบ)
            // 🛡️ จัดซื้อ/รับสินค้า ใช้ชื่อ bt_* ทั้งหมด (มี title_th/group ให้จัดการผ่าน /permissions ได้จริง)
            // ตรงกับ middleware ใน routes/api.php — ห้ามใช้ create_purchase/edit_purchase/delete_purchase/
            // approve_purchase/create_goods_receipt/create_goods_receipt_no_po/bt_InventoryAdjustment (7 ชื่อ
            // เดิมที่เคยเป็น orphan ไม่มี group/title_th และถูกลบออกจากระบบไปแล้ว — ห้ามใส่กลับเข้ามาในนี้)
            ['name' => 'bt_create_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบสั่งซื้อ'],
            ['name' => 'bt_edit_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขใบสั่งซื้อ'],
            ['name' => 'bt_delete_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบใบสั่งซื้อ'],
            ['name' => 'bt_approve_purchase', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มอนุมัติใบสั่งซื้อ'],
            ['name' => 'bt_create_goods_receipt', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบรับสินค้าจาก PO'],
            ['name' => 'bt_create_goods_receipt_no_po', 'group' => 'จัดซื้อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างใบรับสินค้าไม่มี PO'],
            ['name' => 'manage_products', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างสินค้าใหม่'],
            ['name' => 'stock_adjustment', 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มปรับปรุงสต๊อก'],
            ['name' => 'menu_stock_in', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'title_th' => 'รับสินค้าเข้าคลัง', 'path' => '/stock/in', 'icon' => 'Package', 'sort_order' => 4],
            ['name' => 'menu_stock_out', 'group' => 'คลังสินค้า', 'sub_group' => 'ทั่วไป', 'title_th' => 'เบิกสินค้าออก', 'path' => '/stock/out', 'icon' => 'Package', 'sort_order' => 5],
            ['name' => 'create_contacts', 'group' => 'ผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มสร้างรายชื่อผู้ติดต่อ'],
            ['name' => 'edit_contacts', 'group' => 'ผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มแก้ไขรายชื่อผู้ติดต่อ'],
            ['name' => 'delete_contacts', 'group' => 'ผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มลบรายชื่อผู้ติดต่อ'],
            ['name' => 'export_contacts', 'group' => 'ผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มส่งออกรายชื่อผู้ติดต่อ'],
            ['name' => 'import_contacts', 'group' => 'ผู้ติดต่อ', 'sub_group' => 'ปุ่ม', 'title_th' => 'ปุ่มนำเข้ารายชื่อผู้ติดต่อ'],
        ];

        // 🏷️ ใช้ generate title_th ให้ปุ่ม action (create/edit/delete/approve) ของทุก doc-type loop ด้านล่าง
        // แบบเดียวกัน ("ปุ่ม" + กริยา + ชื่อเอกสาร) แทนที่จะปล่อยว่างเหมือนเดิม (ทำให้ก่อนหน้านี้ต้องไปตั้งชื่อ
        // เองทีหลังผ่าน /permissions ทุกตัว ไม่ก็ค้าง NULL ถ้าไม่มีใครไปตั้ง)
        $actionTitleTh = ['create' => 'สร้าง', 'edit' => 'แก้ไข', 'delete' => 'ลบ', 'approve' => 'อนุมัติ'];

        // 📄 หมวด ขาย (Sales) — แยกสิทธิ์ตามประเภทเอกสาร (view/create/edit/delete/approve x 7 ประเภท)
        // view_{type} เป็นทั้งสิทธิ์ดูและตัวกำหนดเมนูย่อยในแถบข้าง (แต่ละประเภทเป็นเมนูของตัวเอง)
        $saleDocTypes = [
            'quotation'      => ['title' => 'ใบเสนอราคา',     'path' => '/sales/quotations',        'sort' => 4],
            'billing_invoice' => ['title' => 'ใบวางบิล',       'path' => '/sales/billing-invoices',  'sort' => 41],
            'tax_invoice'    => ['title' => 'ใบกำกับภาษี',     'path' => '/sales/tax-invoices',      'sort' => 42],
            'cash'           => ['title' => 'บิลเงินสด',       'path' => '/sales/cash-sales',        'sort' => 43],
            'receipt'        => ['title' => 'ใบเสร็จรับเงิน',   'path' => '/sales/receipts',          'sort' => 44],
            'credit_note'    => ['title' => 'ใบลดหนี้',        'path' => '/sales/credit-notes',      'sort' => 45],
            'debit_note'     => ['title' => 'ใบเพิ่มหนี้',      'path' => '/sales/debit-notes',       'sort' => 46],
            'delivery_note'  => ['title' => 'ใบส่งสินค้า',      'path' => '/sales/delivery-notes',    'sort' => 47],
            // 🚗 ใบเบิกสินค้าเช่า — ผูกกับงานเช่า (RentalJob) เท่านั้น ไม่ตัดสต๊อกจริง แค่จอง (reserved_qty)
            'stock_issue'    => ['title' => 'ใบเบิกสินค้าเช่า',   'path' => '/sales/stock-issues',      'sort' => 48],
            // 🧾 คืนสินค้าที่ขายไปแล้ว อ้างอิงใบลดหนี้เท่านั้น (แยกจากคืนอุปกรณ์เช่าแล้ว — ดู $rentalReturnDocTypes ด้านล่าง)
            'stock_return'   => ['title' => 'ใบคืนสินค้า (จากใบลดหนี้)', 'path' => '/sales/stock-returns', 'sort' => 49],
            // 🎨 ใบเสนอราคาแบบกำหนดเอง (งานเช่า) — module แยกต่างหาก ปรับโลโก้/ชื่อบริษัท/ผู้เสนอราคาได้ต่อเอกสาร
            'custom_quotation' => ['title' => 'ใบเสนอราคา (กำหนดเอง)', 'path' => '/sales/custom-quotations', 'sort' => 50],
            // 💵 บิลเงินสดแบบกำหนดเอง — เหมือน cash แต่เพิ่มธีมกำหนดเอง (โลโก้/ชื่อ-ที่อยู่ผู้ขาย/Subtotal-VAT แก้เองได้)
            'custom_cash'    => ['title' => 'บิลเงินสด (กำหนดเอง)', 'path' => '/sales/custom-cash-sales', 'sort' => 51],
            // 📦 ใบเบิกสินค้า (โครงการขายทั่วไป) — ผูกกับโครงการ+ใบเสนอราคา ไม่ใช่งานเช่า ตัดสต๊อกจริงตอนอนุมัติ (คนละกลไกกับ stock_issue)
            'material_issue' => ['title' => 'ใบเบิกสินค้า',      'path' => '/sales/material-issues',   'sort' => 52],
            // 🧾 ใบแจ้งหนี้ — เอกสารแยกใหม่ ไม่ผูกกับสายเอกสารขายเดิมเลย (ไม่โหลดจาก/ไม่ถูกโหลดโดยเอกสารอื่นในสาย quotation→material_issue→tax_invoice→billing_invoice→receipt)
            'invoice'        => ['title' => 'ใบแจ้งหนี้',       'path' => '/sales/invoices',           'sort' => 53],
        ];
        foreach ($saleDocTypes as $type => $meta) {
            $permissions[] = [
                'name' => "view_{$type}", 'group' => 'ขาย', 'is_menu' => true,
                'title_th' => $meta['title'], 'path' => $meta['path'], 'icon' => 'Receipt', 'sort_order' => $meta['sort'],
            ];
            foreach (['create', 'edit', 'delete', 'approve'] as $action) {
                $permissions[] = [
                    'name' => "{$action}_{$type}", 'group' => 'ขาย', 'sub_group' => 'ปุ่ม',
                    'title_th' => "ปุ่ม{$actionTitleTh[$action]}{$meta['title']}",
                ];
            }
        }

        // 🤝 ใบยืมสินค้า/ใบคืนสินค้ายืม — อยู่ใต้กลุ่มเมนู "คลังสินค้า" (ต่อจากรายการสินค้า/ความเคลื่อนไหวสต๊อก/สถานที่เก็บ)
        // ไม่ผูกกับโครงการ/งานเช่าเลย (สินค้ายังอยู่ในระบบ แค่ถูกล็อกไว้ผ่าน reserved_qty เหมือน stock_issue —
        // ดู SaleDocumentController::approve()/cancel())
        $loanDocTypes = [
            'loan_issue'  => ['title' => 'ใบยืมสินค้า',   'path' => '/loans/issues',  'sort' => 60],
            'loan_return' => ['title' => 'ใบคืนสินค้ายืม', 'path' => '/loans/returns', 'sort' => 61],
        ];
        foreach ($loanDocTypes as $type => $meta) {
            $permissions[] = [
                'name' => "view_{$type}", 'group' => 'คลังสินค้า', 'is_menu' => true,
                'title_th' => $meta['title'], 'path' => $meta['path'], 'icon' => 'PackageOpen', 'sort_order' => $meta['sort'],
            ];
            foreach (['create', 'edit', 'delete', 'approve'] as $action) {
                $permissions[] = [
                    'name' => "{$action}_{$type}", 'group' => 'คลังสินค้า', 'sub_group' => 'ปุ่ม',
                    'title_th' => "ปุ่ม{$actionTitleTh[$action]}{$meta['title']}",
                ];
            }
        }

        // 🏠 คืนอุปกรณ์เช่า อ้างอิงใบเบิกสินค้า (stock_issue) เท่านั้น — แยกออกมาจาก stock_return เดิม (ที่เหลือ
        // เฉพาะคืนจากใบลดหนี้ ฝั่ง "ขาย" ด้านบน) ให้เป็น document_type ของตัวเอง อยู่กลุ่มเมนู "งานเช่า" เพื่อให้
        // scope สิทธิ์ role แบบ "พนักงานคืนสินค้าเช่า" ได้จริง โดยไม่พ่วงสิทธิ์คืนสินค้าจากใบลดหนี้ (ฝั่งขาย) มาด้วย
        $rentalReturnDocTypes = [
            'rental_stock_return' => ['title' => 'ใบคืนสินค้าเช่า', 'path' => '/sales/rental-stock-returns', 'sort' => 49],
        ];
        foreach ($rentalReturnDocTypes as $type => $meta) {
            $permissions[] = [
                'name' => "view_{$type}", 'group' => 'งานเช่า', 'is_menu' => true,
                'title_th' => $meta['title'], 'path' => $meta['path'], 'icon' => 'PackageMinus', 'sort_order' => $meta['sort'],
            ];
            foreach (['create', 'edit', 'delete', 'approve'] as $action) {
                $permissions[] = [
                    'name' => "{$action}_{$type}", 'group' => 'งานเช่า', 'sub_group' => 'ปุ่ม',
                    'title_th' => "ปุ่ม{$actionTitleTh[$action]}{$meta['title']}",
                ];
            }
        }

        // 🛠️ ใบสั่งซื้อ/ใบสั่งจ้าง ผู้รับเหมา — จ้างช่าง/ผู้รับเหมารายตัว แยกจากใบสั่งซื้อ (Purchase Order) เดิมโดยสิ้นเชิง
        // ผูกได้ทั้งโครงการและงานเช่า (ดู ContractorWorkOrderController)
        $permissions[] = [
            'name' => 'view_contractor_work_orders', 'group' => 'ผู้รับเหมา', 'is_menu' => true,
            'title_th' => 'ใบสั่งซื้อ/จ้างผู้รับเหมา', 'path' => '/contractor-work-orders', 'icon' => 'HardHat', 'sort_order' => 62,
        ];
        foreach (['create', 'edit', 'delete', 'approve'] as $action) {
            // 🛡️ ใช้ "ใบสั่งซื้อ-สั่งจ้าง" (สั้นกว่า title ของเมนู "ใบสั่งซื้อ/จ้างผู้รับเหมา" ด้านบน) ตรงกับ
            // ชื่อที่ตั้งไว้จริงในระบบตอนนี้
            $permissions[] = [
                'name' => "{$action}_contractor_work_orders", 'group' => 'ผู้รับเหมา', 'sub_group' => 'ปุ่ม',
                'title_th' => "ปุ่ม{$actionTitleTh[$action]}ใบสั่งซื้อ-สั่งจ้าง",
            ];
        }

        // 📋 ใบคุมสัญญาราชการ — ทะเบียนติดตามสัญญาราชการ+หลักประกัน ผูกกับโครงการเสมอ ไม่มี approve (เป็นทะเบียน ไม่ใช่เอกสารอนุมัติ)
        $permissions[] = [
            'name' => 'view_government_contracts', 'group' => 'สัญญาราชการ', 'is_menu' => true,
            'title_th' => 'ใบคุมสัญญาราชการ', 'path' => '/government-contracts', 'icon' => 'FileLock2', 'sort_order' => 63,
        ];
        foreach (['create', 'edit', 'delete'] as $action) {
            // 🛡️ ใช้ "สัญญาราชการ" (สั้นกว่า title ของเมนู "ใบคุมสัญญาราชการ" ด้านบน) ตรงกับชื่อที่ตั้งไว้จริง
            $permissions[] = [
                'name' => "{$action}_government_contracts", 'group' => 'สัญญาราชการ', 'sub_group' => 'ปุ่ม',
                'title_th' => "ปุ่ม{$actionTitleTh[$action]}สัญญาราชการ",
            ];
        }

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
        $defaultCategories = ['Sound System', 'Visual System', 'Lighting', 'Security', 'IT', 'Network', 'เช่า'];
        foreach ($defaultCategories as $categoryName) {
            \App\Models\ProductCategory::firstOrCreate(
                ['name' => $categoryName, 'company_id' => $hqCompany->id],
                ['company_id' => $hqCompany->id]
            );
        }

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
