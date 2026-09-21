<?php

namespace App\Support;

// 🕵️ แปล method+path ของ request ให้เป็นคำอธิบายภาษาไทยอ่านง่าย สำหรับ Activity Log
// (เช่น "DELETE api/contacts/5" → "ลบข้อมูลผู้ติดต่อ") ครอบคลุมทุกโมดูลในระบบ แต่ไม่ระบุชื่อเฉพาะเจาะจง
// ของแต่ละรายการ (เช่น ไม่บอกว่าลบ "ผู้ติดต่อ A" — บอกแค่ประเภทการกระทำ "ลบข้อมูลผู้ติดต่อ" เท่านั้น)
//
// วิธีเพิ่ม route ใหม่ในอนาคต: ถ้าเป็น CRUD ปกติ (index/store/show/update/destroy) แค่เพิ่มคีย์ resource
// ใหม่ใน RESOURCE_LABELS ก็พอ ระบบจะประกอบคำกริยา+ชื่อประเภทให้อัตโนมัติ ถ้าเป็น action พิเศษ (เช่น approve/
// cancel/restore) ให้เพิ่มเข้า EXACT_PATH_LABELS (ระบุ path เต็มไม่มี id) หรือ SUFFIX_LABELS (จับ path ที่ลงท้าย
// ด้วยคำนั้น) ตามความเหมาะสม
class ActivityActionLabeler
{
    // path เต็ม (ตัด "api/" และเลข id ออกแล้ว) ที่มีความหมายเฉพาะตัว ไม่ใช่ CRUD ปกติ
    private const EXACT_PATH_LABELS = [
        'switch-company' => 'สลับบริษัท',
        'user/change-password' => 'เปลี่ยนรหัสผ่านตัวเอง',
        'user/profile-update' => 'แก้ไขข้อมูลโปรไฟล์ตัวเอง',
        'users/restore-batch' => 'กู้คืนผู้ใช้งาน (หลายรายการ)',
        'users/force-batch' => 'ลบผู้ใช้งานถาวร (หลายรายการ)',
        'users/excel/import' => 'นำเข้าข้อมูลผู้ใช้งาน (Excel)',
        'permissions/group-icon' => 'แก้ไขไอคอนหมวดหมู่สิทธิ์',
        'settings/auto-sync-permissions' => 'ตั้งค่าซิงค์สิทธิ์อัตโนมัติ',
        'master-data' => 'เพิ่มข้อมูลตั้งต้น (Master Data)',
        'stock-balances/check' => 'ตรวจสอบยอดคงเหลือสต๊อก',
        'stock-movements/batch' => 'บันทึกรายการเคลื่อนไหวสต๊อก (หลายรายการ)',
        'products/excel/import-master' => 'นำเข้าข้อมูลสินค้าหลัก (Excel)',
        'products/excel/import-adjust' => 'นำเข้าข้อมูลปรับปรุงสต๊อก (Excel)',
        'contacts/import' => 'นำเข้าข้อมูลผู้ติดต่อ (Excel)',
        'contacts/quick-create' => 'เพิ่มผู้ติดต่อแบบย่อ',
        'direct-goods-receipt' => 'รับสินค้าโดยไม่มีใบสั่งซื้อ',
        'sale-documents/custom-quotations/upload-logo' => 'อัปโหลดโลโก้ใบเสนอราคา',
        'sale-documents/custom-cash-sales/upload-logo' => 'อัปโหลดโลโก้ใบเงินสด',
        // 🛡️ /company ใช้ POST แทน PUT สำหรับ "แก้ไข" ข้อมูลบริษัท (ไม่ใช่สร้างใหม่ — สร้างบริษัทใหม่ทำผ่าน
        // RegisterCompanyController คนละ route) ถ้าไม่ override ตรงนี้ VERB_LABELS จะเดาว่า POST = "เพิ่มข้อมูล" ผิดความหมาย
        'company' => 'แก้ไขข้อมูลบริษัท',
    ];

    // path ที่มี prefix คงที่ (จับด้วย str_starts_with กับ $normalized ที่ตัด id ออกแล้ว)
    private const PREFIX_PATH_LABELS = [
        'company/letter-layout-background' => 'อัปโหลดรูปพื้นหลังเอกสาร (Letter Layout)',
        'company/quotation-header-background' => 'อัปโหลดรูปหัวกระดาษใบเสนอราคา',
        'company/print-layout-background' => 'อัปโหลดรูปพื้นหลังเอกสารพิมพ์',
        'company/a4-watermark-background' => 'อัปโหลดลายน้ำ A4',
        'permissions/group/' => 'ลบหมวดหมู่สิทธิ์',
        'users/{id}/companies' => 'จัดการสิทธิ์เข้าใช้งานหลายบริษัท',
        'purchase-orders/{id}/goods-receipt' => 'รับสินค้าตามใบสั่งซื้อ',
    ];

    // path ที่ลงท้ายด้วยคำนี้ ถือเป็น "การกระทำพิเศษ" ต่อ resource ตัวเอง (ไม่ใช่ CRUD ปกติ)
    // ค่า label จะถูกเติมชื่อ resource ต่อท้ายให้เอง (ผ่าน %s)
    private const SUFFIX_LABELS = [
        'toggle-status' => 'เปิด/ปิดการใช้งาน%s',
        'toggle-active' => 'เปิด/ปิดการใช้งาน%s',
        'restore' => 'กู้คืน%s',
        'force' => 'ลบ%sถาวร',
        'reset-password' => 'รีเซ็ตรหัสผ่าน%s',
        'approve' => 'อนุมัติ%s',
        'cancel' => 'ยกเลิก%s',
        'force-close' => 'ปิด%s (บังคับ)',
        'revise' => 'แก้ไข%s (Revise)',
        'status' => 'เปลี่ยนสถานะ%s',
        'generate-billing' => 'ออกใบแจ้งหนี้%s',
        'related' => 'แก้ไขสินค้าที่เกี่ยวข้อง',
    ];

    // ชื่อ resource ภาษาไทย ใช้ทั้งสำหรับ CRUD ปกติ (index/store/show/update/destroy) และเติมใน SUFFIX_LABELS
    private const RESOURCE_LABELS = [
        'users' => 'ผู้ใช้งาน',
        'permissions' => 'สิทธิ์การใช้งาน',
        'roles' => 'บทบาท',
        'departments' => 'แผนก',
        'company' => 'ข้อมูลบริษัท',
        'products' => 'สินค้า',
        'stock-movements' => 'รายการเคลื่อนไหวสต๊อก',
        'warehouses' => 'คลังสินค้า',
        'assets' => 'ทรัพย์สิน',
        'contacts' => 'ผู้ติดต่อ',
        'purchase-orders' => 'ใบสั่งซื้อ',
        'contractor-work-orders' => 'ใบสั่งจ้างผู้รับเหมา',
        'government-contracts' => 'สัญญาราชการ',
        'projects' => 'โครงการ',
        'rental-jobs' => 'งานเช่า',
        'sale-documents' => 'เอกสารขาย',
        'repairs' => 'ใบแจ้งซ่อม',
        'installations' => 'งานติดตั้ง',
        'goods-receipts' => 'ใบรับสินค้า',
        'stock-balances' => 'ยอดคงเหลือสต๊อก',
        'installation-equipment-items' => 'รายการอุปกรณ์ติดตั้ง',
    ];

    private const VERB_LABELS = [
        'POST' => 'เพิ่มข้อมูล',
        'PUT' => 'แก้ไขข้อมูล',
        'PATCH' => 'แก้ไขข้อมูล',
        'DELETE' => 'ลบข้อมูล',
    ];

    public static function resolve(string $method, string $path): string
    {
        // ตัด "api/" นำหน้าออก แล้วแทนที่ segment ที่เป็นตัวเลขล้วน (id) ด้วย {id} เพื่อให้ match แบบไม่สนใจเลข
        $trimmed = preg_replace('#^api/#', '', $path);
        $segments = array_map(
            fn($seg) => ctype_digit($seg) ? '{id}' : $seg,
            explode('/', $trimmed)
        );
        $normalized = implode('/', $segments);

        if (isset(self::EXACT_PATH_LABELS[$normalized])) {
            return self::EXACT_PATH_LABELS[$normalized];
        }

        foreach (self::PREFIX_PATH_LABELS as $prefix => $label) {
            if (str_starts_with($normalized, $prefix)) {
                return $label;
            }
        }

        $resourceKey = $segments[0] ?? '';
        $resourceName = self::RESOURCE_LABELS[$resourceKey] ?? null;
        $lastSegment = end($segments);

        if ($resourceName !== null && isset(self::SUFFIX_LABELS[$lastSegment])) {
            return sprintf(self::SUFFIX_LABELS[$lastSegment], $resourceName);
        }

        if ($resourceName !== null && isset(self::VERB_LABELS[$method])) {
            return self::VERB_LABELS[$method] . $resourceName;
        }

        // ยังไม่รู้จัก resource นี้ (route ใหม่ที่ยังไม่ได้เพิ่ม label) — fallback แบบเดิม กันข้อมูล log หายไปเฉยๆ
        return $method . ' ' . $path;
    }
}
