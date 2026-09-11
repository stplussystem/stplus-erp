<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * 🧹 ล้างเฉพาะ "เอกสารขาย/เช่า/โครงการ/งานเช่า" และข้อมูลที่เกี่ยวข้องกัน (สต็อก/การเคลื่อนไหวสต็อก/ใบซ่อม/
 * ใบติดตั้ง) — ต่างจาก `system:reset-data` ที่กว้างกว่ามาก (ล้างสินค้า/ลูกค้า/คลังสินค้า/ใบสั่งซื้อ/สัญญาราชการ
 * ไปด้วย) คำสั่งนี้ **ไม่แตะ** products, product_serials (ลบเฉพาะแถว ไม่ลบ record), contacts, warehouses,
 * purchase_orders, government_contracts, contractor_work_orders, ระบบสิทธิ์/users/companies เลย
 * ตามที่ผู้ใช้ยืนยันขอบเขตไว้ชัดเจน (ดู plan file ตอนวางแผนคำสั่งนี้)
 *
 * ลำดับการลบสำคัญมาก — ตรวจสอบ FK constraint จริงจาก migrations ครบทุกจุดแล้ว:
 * installation_equipment_items/installation_records มี restrictOnDelete() ชี้ไปทั้ง projects และ
 * sale_document_items ต้องลบก่อนเสมอ ไม่งั้นจะลบ projects/sale_document_items ไม่ได้เลย (ติด FK constraint)
 *
 * ใช้ DB::table()->delete() (ไม่ใช้ truncate()) เพราะ TRUNCATE ใน MySQL ไม่กระตุ้น nullOnDelete()/cascade ใดๆ
 * เลย ต่างจาก DELETE ที่ MySQL จัดการ FK action ให้ถูกต้องตามที่ migration กำหนดไว้จริง — จำเป็นต้องให้
 * product_serials.sold_to_sale_document_id/rented_via_sale_document_id ถูก set NULL อัตโนมัติตอนลบ
 * sale_documents (เพราะเป็น FK จริงที่มี nullOnDelete())
 *
 * ⚠️ คำสั่งนี้ลบข้อมูลถาวร ย้อนกลับไม่ได้ (ไม่มี undo) — สำรองฐานข้อมูลก่อนรันเสมอ เช่น:
 *   docker exec system_mariadb mariadb-dump -u root -prootpassword system_db > backup_before_clear_transactions.sql
 */
class ClearTransactionalDataCommand extends Command
{
    protected $signature = 'system:clear-transactions
        {--dry-run : แสดงจำนวนแถวที่จะลบ โดยไม่ลบจริง}
        {--force : ข้ามการถามยืนยันทั้งหมด (ใช้ตอนรันอัตโนมัติ/ทดสอบเท่านั้น)}';

    protected $description = 'ล้างเอกสารขาย/เช่า/โครงการ/งานเช่า และข้อมูลที่เกี่ยวข้องกัน (สต็อก/ใบซ่อม/ใบติดตั้ง) โดยไม่แตะสินค้า/ลูกค้า/คลังสินค้า';

    // เรียงตามลำดับที่ต้องลบจริง — ห้ามสลับลำดับ (ดูคอมเมนต์ด้านบนเรื่อง FK restrictOnDelete)
    private const DELETE_TABLES_IN_ORDER = [
        'installation_equipment_items',
        'installation_records',
        'repair_ticket_photos',
        'repair_tickets',
        'sale_document_item_serials',
        'sale_document_invoice_refs',
        'sale_document_items',
        'sale_documents',
        'projects',
        'rental_jobs',
        'stock_movements',
        'stock_balances',
        'document_sequences',
    ];

    public function handle(): int
    {
        $isDryRun = (bool) $this->option('dry-run');

        $rowCounts = [];
        foreach (self::DELETE_TABLES_IN_ORDER as $table) {
            $rowCounts[$table] = DB::table($table)->count();
        }
        $staleSerialCount = DB::table('product_serials')
            ->whereIn('status', ['sold', 'rented'])
            ->count();

        $this->warn('=== สรุปก่อนล้างข้อมูล ===');
        foreach ($rowCounts as $table => $count) {
            $this->line("  {$table}: {$count} แถว");
        }
        $this->line("  product_serials ที่จะ reset สถานะ (sold/rented -> available): สูงสุด {$staleSerialCount} แถว");
        $this->line('จะไม่แตะเลย: products, product_serials (ลบเฉพาะแถว), contacts, warehouses, purchase_orders, government_contracts, contractor_work_orders, ระบบสิทธิ์/users/companies');
        $this->newLine();

        if ($isDryRun) {
            $this->info('[DRY RUN] ไม่มีข้อมูลใดถูกแก้ไข');
            return self::SUCCESS;
        }

        if (!$this->option('force')) {
            $this->error('คำเตือน: การกระทำนี้ลบข้อมูลถาวร ย้อนกลับไม่ได้ กรุณาสำรองฐานข้อมูลก่อนถ้ายังไม่ได้ทำ');
            if (!$this->confirm('ยืนยันว่าต้องการล้างข้อมูลถาวรตามที่สรุปไว้ด้านบนใช่หรือไม่?')) {
                $this->info('ยกเลิกการทำงาน ไม่มีข้อมูลใดถูกแก้ไข');
                return self::SUCCESS;
            }
            $typed = $this->ask('พิมพ์คำว่า CLEAR (ตัวพิมพ์ใหญ่) เพื่อยืนยันอีกครั้ง');
            if ($typed !== 'CLEAR') {
                $this->info('ข้อความยืนยันไม่ตรง ยกเลิกการทำงาน ไม่มีข้อมูลใดถูกแก้ไข');
                return self::SUCCESS;
            }
        }

        DB::transaction(function () {
            foreach (self::DELETE_TABLES_IN_ORDER as $table) {
                DB::table($table)->delete();
            }

            // 🔗 stock_movement_id เป็น soft reference (ไม่มี FK constraint) ต้อง null เองหลังลบ stock_movements
            DB::table('product_serials')
                ->whereNotNull('stock_movement_id')
                ->update(['stock_movement_id' => null]);

            // 🔄 sold_to_sale_document_id/rented_via_sale_document_id ถูก null ให้อัตโนมัติแล้วจาก nullOnDelete()
            // ตอนลบ sale_documents ด้านบน — แต่ status/sold_at/rented_at ไม่ reset ตาม ต้อง update ต่อเอง
            DB::table('product_serials')
                ->whereIn('status', ['sold', 'rented'])
                ->whereNull('sold_to_sale_document_id')
                ->whereNull('rented_via_sale_document_id')
                ->update([
                    'status' => 'available',
                    'sold_at' => null,
                    'rented_at' => null,
                ]);
        });

        $this->newLine();
        $this->info('✅ ล้างข้อมูลเอกสารขาย/เช่า/โครงการ/งานเช่าสำเร็จ — สินค้า/ลูกค้า/คลังสินค้ายังอยู่ครบ');
        $this->line('เลขรันเอกสารจะเริ่มนับใหม่จาก 1 อัตโนมัติตอนออกเอกสารถัดไป');

        return self::SUCCESS;
    }
}
