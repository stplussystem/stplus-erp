<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

/**
 * เติม sub_group ให้ 8 permission รายงานเดิม (group='รายงาน') + สร้าง permission ใหม่ 24 ตัวสำหรับ
 * หน้ารายงานที่มีอยู่จริงใน system-frontend/src/app/reports/**\/page.tsx แต่ยังไม่เคยถูกลงทะเบียนเป็นเมนูเลย
 * (เข้าถึงได้แค่ผ่านลิงก์ข้ามหน้าที่ฝังอยู่ในบางหน้า ไม่โผล่ในเมนูข้างซ้าย/บนเลย)
 *
 * ทำให้ UserSessionFormatter::format() (ซึ่งอ่าน sub_group แล้วจัดเป็นเมนูย่อยชั้นที่ 3) มีข้อมูลครบทั้ง
 * 32 รายงาน แบ่งเป็น 9 หมวดหมู่ (ขาย/จัดซื้อ/คลังสินค้า/งานซ่อม/งานติดตั้ง/โครงการ/งานเช่า/สินทรัพย์ถาวร/ผู้บริหาร)
 * ชื่อหมวดใช้ตาม group เดิมที่มีอยู่แล้วในระบบ (ดู DatabaseSeeder.php) เพื่อความสอดคล้อง
 *
 * Idempotent: ใช้ updateOrCreate() ตาม name รันซ้ำกี่ครั้งก็ได้ไม่พัง ไม่ต้อง setPermissionsTeamId()
 * เพราะไฟล์นี้แค่สร้าง/แก้แถวในตาราง permissions เอง ไม่แตะ pivot ตาราง role/permission ใดๆ
 * (DatabaseSeeder.php เป็นคนเรียก syncPermissions(Permission::all()) ให้ Super Admin อีกทีหลังจากนี้)
 */
class ReportsMenuSeeder extends Seeder
{
    public function run(): void
    {
        $reports = [
            // ===== เติม sub_group ให้ 8 รายการเดิม (name ต้องตรงกับ DatabaseSeeder.php เป๊ะ) =====
            ['name' => 'view_reports', 'sub_group' => 'คลังสินค้า'],
            ['name' => 'view_reports_repairs', 'sub_group' => 'งานซ่อม'],
            ['name' => 'view_reports_sales', 'sub_group' => 'ขาย'],
            ['name' => 'view_reports_purchases', 'sub_group' => 'จัดซื้อ'],
            ['name' => 'view_reports_installations', 'sub_group' => 'งานติดตั้ง'],
            ['name' => 'view_reports_top_customers', 'sub_group' => 'ขาย'],
            ['name' => 'view_reports_inventory', 'sub_group' => 'คลังสินค้า'],
            ['name' => 'view_reports_executive', 'sub_group' => 'ผู้บริหาร'],

            // ===== ขาย (sort 70-75) =====
            ['name' => 'view_reports_sales_all', 'sub_group' => 'ขาย', 'title_th' => 'เอกสารขายทั้งหมด', 'path' => '/reports/sales', 'icon' => 'Receipt', 'sort_order' => 70],
            ['name' => 'view_reports_sales_trend', 'sub_group' => 'ขาย', 'title_th' => 'แนวโน้มยอดขาย', 'path' => '/reports/sales-trend', 'icon' => 'TrendingUp', 'sort_order' => 71],
            ['name' => 'view_reports_sales_margin', 'sub_group' => 'ขาย', 'title_th' => 'กำไรขั้นต้นจากการขาย', 'path' => '/reports/sales-margin', 'icon' => 'Percent', 'sort_order' => 72],
            ['name' => 'view_reports_sales_by_salesperson', 'sub_group' => 'ขาย', 'title_th' => 'ยอดขายตามพนักงานขาย', 'path' => '/reports/sales-by-salesperson', 'icon' => 'UserCheck', 'sort_order' => 73],
            ['name' => 'view_reports_quotation_conversion', 'sub_group' => 'ขาย', 'title_th' => 'อัตราปิดใบเสนอราคา', 'path' => '/reports/quotation-conversion', 'icon' => 'FileCheck2', 'sort_order' => 74],
            ['name' => 'view_reports_ar_aging', 'sub_group' => 'ขาย', 'title_th' => 'อายุลูกหนี้ (AR Aging)', 'path' => '/reports/ar-aging', 'icon' => 'Clock', 'sort_order' => 75],

            // ===== จัดซื้อ (sort 76-80) =====
            ['name' => 'view_reports_purchase_summary', 'sub_group' => 'จัดซื้อ', 'title_th' => 'สรุปยอดจัดซื้อ', 'path' => '/reports/purchase-summary', 'icon' => 'PieChart', 'sort_order' => 76],
            ['name' => 'view_reports_top_suppliers', 'sub_group' => 'จัดซื้อ', 'title_th' => 'ซัพพลายเออร์อันดับต้น', 'path' => '/reports/top-suppliers', 'icon' => 'Truck', 'sort_order' => 77],
            ['name' => 'view_reports_po_backorder', 'sub_group' => 'จัดซื้อ', 'title_th' => 'PO ค้างรับ/ยังไม่ครบ', 'path' => '/reports/po-backorder', 'icon' => 'PackageX', 'sort_order' => 78],
            ['name' => 'view_reports_supplier_price_comparison', 'sub_group' => 'จัดซื้อ', 'title_th' => 'เปรียบเทียบราคาซื้อ', 'path' => '/reports/supplier-price-comparison', 'icon' => 'Scale', 'sort_order' => 79],
            ['name' => 'view_reports_ap_aging', 'sub_group' => 'จัดซื้อ', 'title_th' => 'อายุเจ้าหนี้ (AP Aging)', 'path' => '/reports/ap-aging', 'icon' => 'Clock', 'sort_order' => 80],

            // ===== คลังสินค้า (sort 81-85) =====
            ['name' => 'view_reports_low_stock', 'sub_group' => 'คลังสินค้า', 'title_th' => 'สินค้าใกล้หมด', 'path' => '/reports/low-stock', 'icon' => 'AlertTriangle', 'sort_order' => 81],
            ['name' => 'view_reports_slow_moving_stock', 'sub_group' => 'คลังสินค้า', 'title_th' => 'สินค้าเคลื่อนไหวช้า', 'path' => '/reports/slow-moving-stock', 'icon' => 'PackageSearch', 'sort_order' => 82],
            ['name' => 'view_reports_stock_by_warehouse', 'sub_group' => 'คลังสินค้า', 'title_th' => 'สต๊อกแยกตามคลัง', 'path' => '/reports/stock-by-warehouse', 'icon' => 'Warehouse', 'sort_order' => 83],
            ['name' => 'view_reports_stock_movement_ledger', 'sub_group' => 'คลังสินค้า', 'title_th' => 'บัญชีเดินสต๊อก', 'path' => '/reports/stock-movement-ledger', 'icon' => 'History', 'sort_order' => 84],
            ['name' => 'view_reports_warranty_expiry', 'sub_group' => 'คลังสินค้า', 'title_th' => 'สินค้าใกล้หมดประกัน', 'path' => '/reports/warranty-expiry', 'icon' => 'ShieldAlert', 'sort_order' => 85],

            // ===== งานซ่อม (sort 86-88) =====
            ['name' => 'view_reports_repair_turnaround', 'sub_group' => 'งานซ่อม', 'title_th' => 'ระยะเวลาซ่อมเฉลี่ย', 'path' => '/reports/repair-turnaround', 'icon' => 'Timer', 'sort_order' => 86],
            ['name' => 'view_reports_repair_cost_trend', 'sub_group' => 'งานซ่อม', 'title_th' => 'แนวโน้มค่าใช้จ่ายซ่อม', 'path' => '/reports/repair-cost-trend', 'icon' => 'LineChart', 'sort_order' => 87],
            ['name' => 'view_reports_frequently_repaired_products', 'sub_group' => 'งานซ่อม', 'title_th' => 'สินค้าที่ซ่อมบ่อย', 'path' => '/reports/frequently-repaired-products', 'icon' => 'Wrench', 'sort_order' => 88],

            // ===== งานติดตั้ง / โครงการ (sort 89-90) =====
            ['name' => 'view_reports_installations_by_project', 'sub_group' => 'งานติดตั้ง', 'title_th' => 'งานติดตั้งแยกตามโครงการ', 'path' => '/reports/installations-by-project', 'icon' => 'MapPin', 'sort_order' => 89],
            ['name' => 'view_reports_project_profitability', 'sub_group' => 'โครงการ', 'title_th' => 'กำไรขาดทุนโครงการ', 'path' => '/reports/project-profitability', 'icon' => 'FolderKanban', 'sort_order' => 90],

            // ===== งานเช่า (sort 91-92) =====
            ['name' => 'view_reports_rental_jobs', 'sub_group' => 'งานเช่า', 'title_th' => 'สรุปงานเช่า', 'path' => '/reports/rental-jobs', 'icon' => 'Spotlight', 'sort_order' => 91],
            ['name' => 'view_reports_overdue_rentals', 'sub_group' => 'งานเช่า', 'title_th' => 'งานเช่าค้างคืนเกินกำหนด', 'path' => '/reports/overdue-rentals', 'icon' => 'AlertTriangle', 'sort_order' => 92],

            // ===== สินทรัพย์ถาวร (sort 93) =====
            ['name' => 'view_reports_asset_maintenance_due', 'sub_group' => 'สินทรัพย์ถาวร', 'title_th' => 'ทรัพย์สินถึงกำหนดบำรุงรักษา', 'path' => '/reports/asset-maintenance-due', 'icon' => 'Wrench', 'sort_order' => 93],
        ];

        foreach ($reports as $r) {
            $attrs = ['sub_group' => $r['sub_group']];
            // รายการใหม่ (มี title_th/path มาด้วย) ต้องตั้งค่าเมนูให้ครบตั้งแต่แรก — รายการเดิม (แค่เติม
            // sub_group) จะไม่มี key พวกนี้เลย เพราะมีอยู่แล้วในตาราง (สร้างไว้ตั้งแต่ DatabaseSeeder.php)
            foreach (['title_th', 'path', 'icon', 'sort_order'] as $key) {
                if (array_key_exists($key, $r)) {
                    $attrs[$key] = $r[$key];
                }
            }
            if (isset($r['title_th'])) {
                $attrs['group'] = 'รายงาน';
                $attrs['is_menu'] = true;
            }

            Permission::updateOrCreate(
                ['name' => $r['name'], 'guard_name' => 'web'],
                $attrs,
            );
        }
    }
}
