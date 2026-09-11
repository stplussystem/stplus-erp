<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * 🧹 ล้างข้อมูลธุรกิจ/ทำธุรกรรมทั้งหมดในระบบกลับเป็นค่าเริ่มต้น แต่ "เก็บระบบสิทธิ์ + Super Admin" ไว้ครบ
 * ให้ระบบใช้งานต่อได้ทันทีหลังรัน (ไม่ใช่ fresh migrate+seed ที่จะรีเซ็ตกลับไปเป็นบัญชี seeder คนละคน)
 *
 * ออกแบบตามที่ผู้ใช้ยืนยันไว้ในแผนงาน (ดู plan file หัวข้อ "คำถามใหม่ (ยังไม่ใช่งานให้ลงมือทำ): reset ข้อมูลใน
 * database แต่ต้องเก็บ super admin + permissions ไว้") — ห้ามแก้ตารางกลุ่ม A (permissions, role_has_permissions)
 * เด็ดขาด เพราะเป็นแกนของระบบสิทธิ์ทั้งหมด
 *
 * ⚠️ คำสั่งนี้ลบข้อมูลถาวร ย้อนกลับไม่ได้ (ไม่มี undo) — สำรองฐานข้อมูลก่อนรันเสมอ เช่น:
 *   docker exec system_mariadb mysqldump -u root -p [database] > backup_before_reset.sql
 */
class ResetSystemDataCommand extends Command
{
    protected $signature = 'system:reset-data {--force : ข้ามการถามยืนยันทั้งหมด (ใช้ตอนรันอัตโนมัติ/ทดสอบเท่านั้น)}';

    protected $description = 'ล้างข้อมูลธุรกิจ/ทำธุรกรรมทั้งหมดกลับเป็นค่าเริ่มต้น เก็บเฉพาะระบบสิทธิ์ + Super Admin + บริษัทของ Super Admin ไว้';

    // 🚀 กลุ่ม C — ตารางที่ TRUNCATE ทิ้งทั้งหมดทุกแถวทุกบริษัท (เหลือบริษัทเดียวอยู่แล้วหลังขั้นตอนกลุ่ม B)
    // เรียงตามที่ตรวจสอบจริงจาก migrations ทั้ง 91 ไฟล์ในระบบ ไม่ได้เดา
    private const TRUNCATE_TABLES = [
        'sale_documents', 'sale_document_items', 'sale_document_item_serials', 'sale_document_invoice_refs',
        'purchase_orders', 'purchase_order_items',
        'goods_receipts', 'goods_receipt_items',
        'contractor_work_orders', 'contractor_work_order_items',
        'government_contracts',
        'projects', 'rental_jobs',
        'repair_tickets', 'repair_ticket_photos',
        'installation_records', 'installation_equipment_items',
        'stock_movements', 'stock_balances',
        'products', 'product_serials', 'product_bundle_items', 'product_relations', 'product_categories',
        'contacts', 'customers', // customers เป็นตารางเก่าที่ไม่มี Model/Controller อ้างอิงแล้วในโค้ดจริง เคลียร์ไปเผื่อสะอาด
        'brands', 'units',
        'assets',
        'company_access_logs', // FK แบบ restrict (default) ไปที่ companies — ต้องล้างก่อน DELETE FROM companies ไม่งั้นชน constraint
        'notifications',
        'activity_log',
        'document_sequences',
        'personal_access_tokens', 'token_active_company',
        'warehouses', // ลบทั้งหมดก่อนสร้างคลังใหม่ 3 อันในขั้นตอนถัดไป
    ];

    // 🚀 ค่าเริ่มต้นเดียวกับที่ DatabaseSeeder.php seed ให้บริษัทใหม่ปกติ (ไม่ได้คิดเลขเอง)
    private const DEFAULT_PRODUCT_CATEGORIES = ['Sound System', 'Visual System', 'Lighting', 'Security', 'IT', 'Network'];

    public function handle(): int
    {
        $keepUser = User::where('is_platform_admin', true)->get();

        if ($keepUser->isEmpty()) {
            $this->error('ไม่พบผู้ใช้ที่เป็น Platform Admin (is_platform_admin=1) ในระบบเลย — ยกเลิกการทำงาน กันรันผิดบริบท');
            return self::FAILURE;
        }
        if ($keepUser->count() > 1) {
            $this->error('พบผู้ใช้ที่เป็น Platform Admin มากกว่า 1 คน (' . $keepUser->count() . ' คน) — คำสั่งนี้รองรับกรณีมีคนเดียวเท่านั้น กันเลือกผิดคน ยกเลิกการทำงาน');
            return self::FAILURE;
        }

        $keepUser = $keepUser->first();
        $keepCompanyId = $keepUser->company_id;
        $keepCompany = DB::table('companies')->where('id', $keepCompanyId)->first();

        if (!$keepCompany) {
            $this->error("ผู้ใช้ {$keepUser->name} (id={$keepUser->id}) มี company_id={$keepCompanyId} แต่หาบริษัทนี้ไม่เจอในตาราง companies — ยกเลิกการทำงาน");
            return self::FAILURE;
        }

        $this->warn('=== สรุปก่อนล้างข้อมูล ===');
        $this->line("จะเก็บไว้: user \"{$keepUser->name}\" (id={$keepUser->id}) + บริษัท \"{$keepCompany->name}\" (id={$keepCompanyId})");
        $this->line('จะเก็บไว้ทั้งหมด: permissions, role_has_permissions (ระบบสิทธิ์ทั้งชุด ไม่แตะเลย)');
        $this->line('จะลบถาวร (ย้อนกลับไม่ได้): บริษัทอื่นทั้งหมด, user อื่นทั้งหมด, สินค้า/ลูกค้า/คลังสินค้า/เอกสารขาย-ซื้อ-โครงการ-งานเช่าทั้งหมด');
        $this->newLine();

        $rowCounts = [];
        foreach (self::TRUNCATE_TABLES as $table) {
            $rowCounts[$table] = DB::table($table)->count();
        }
        $totalRows = array_sum($rowCounts);
        $this->line("รวมแถวข้อมูลที่จะถูกลบทิ้งทั้งหมด: {$totalRows} แถว จาก " . count(self::TRUNCATE_TABLES) . ' ตาราง');
        $this->newLine();

        if (!$this->option('force')) {
            $this->error('คำเตือน: การกระทำนี้ลบข้อมูลถาวร ย้อนกลับไม่ได้ กรุณาสำรองฐานข้อมูลก่อนถ้ายังไม่ได้ทำ');
            if (!$this->confirm('ยืนยันว่าต้องการล้างข้อมูลถาวรตามที่สรุปไว้ด้านบนใช่หรือไม่?')) {
                $this->info('ยกเลิกการทำงาน ไม่มีข้อมูลใดถูกแก้ไข');
                return self::SUCCESS;
            }
            $typed = $this->ask('พิมพ์คำว่า RESET (ตัวพิมพ์ใหญ่) เพื่อยืนยันอีกครั้ง');
            if ($typed !== 'RESET') {
                $this->info('ข้อความยืนยันไม่ตรง ยกเลิกการทำงาน ไม่มีข้อมูลใดถูกแก้ไข');
                return self::SUCCESS;
            }
        }

        // 🛡️ TRUNCATE เป็น DDL ใน MySQL/MariaDB จะ auto-commit ทันที ใช้ร่วมกับ DB::transaction() ไม่ได้
        // (ลองแล้วชน PDOException "There is no active transaction") ต้องรันแยกนอก transaction ก่อน
        // แล้วค่อยเปิด transaction จริงสำหรับส่วนที่เป็น DML ล้วน (DELETE/INSERT) ต่อจากนี้
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        try {
            // กลุ่ม C — ล้างทิ้งทั้งหมด
            foreach (self::TRUNCATE_TABLES as $table) {
                DB::table($table)->truncate();
            }
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        DB::transaction(function () use ($keepUser, $keepCompanyId) {
            // กลุ่ม B — ตัดส่วนเกิน เหลือเฉพาะของที่เก็บไว้
            DB::table('users')->where('id', '!=', $keepUser->id)->delete();
            DB::table('companies')->where('id', '!=', $keepCompanyId)->delete();
            DB::table('company_user')->where('company_id', '!=', $keepCompanyId)->delete();
            DB::table('roles')->where('company_id', '!=', $keepCompanyId)->delete(); // cascade ลบ role_has_permissions/model_has_roles ของ role พวกนี้ให้เอง
            DB::table('model_has_roles')->where('team_id', '!=', $keepCompanyId)->delete(); // กันแถวผิดปกติที่ team_id ไม่ตรงกับ role เจ้าของ (พบจริงในข้อมูล)
            DB::table('model_has_permissions')
                ->where('model_type', User::class)
                ->where('model_id', '!=', $keepUser->id)
                ->delete();

            // สร้างข้อมูลเริ่มต้นใหม่ให้บริษัทที่เหลือ
            $now = now();

            DB::table('warehouses')->insert([
                ['company_id' => $keepCompanyId, 'name' => 'คลังสินค้าสำหรับขาย', 'is_default' => true, 'created_at' => $now, 'updated_at' => $now],
                ['company_id' => $keepCompanyId, 'name' => 'คลังสินค้าสำหรับเช่า', 'is_default' => false, 'created_at' => $now, 'updated_at' => $now],
                ['company_id' => $keepCompanyId, 'name' => 'คลังสินค้าสำหรับติดตั้ง', 'is_default' => false, 'created_at' => $now, 'updated_at' => $now],
            ]);

            foreach (self::DEFAULT_PRODUCT_CATEGORIES as $categoryName) {
                DB::table('product_categories')->insert([
                    'company_id' => $keepCompanyId,
                    'name' => $categoryName,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('company_user')->updateOrInsert(
                ['user_id' => $keepUser->id, 'company_id' => $keepCompanyId],
                ['granted_by' => null, 'created_at' => $now, 'updated_at' => $now],
            );
        });

        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

        $this->newLine();
        $this->info('✅ ล้างข้อมูลสำเร็จ — ระบบสิทธิ์ + Super Admin + บริษัทเดิมยังอยู่ครบ พร้อมใช้งานต่อได้ทันที');
        $this->line('เลขรันเอกสารจะเริ่มนับใหม่จาก 1 อัตโนมัติตอนออกเอกสารถัดไป');
        $this->line('คลังสินค้าใหม่ 3 อัน + หมวดสินค้าเริ่มต้น 6 หมวด ถูกสร้างไว้ให้แล้ว');

        return self::SUCCESS;
    }
}
