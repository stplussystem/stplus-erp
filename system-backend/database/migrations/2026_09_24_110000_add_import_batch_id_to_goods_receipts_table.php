<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🆕 ผูก "ใบรับสินค้าอัตโนมัติ" ที่ Excel นำเข้าสินค้าใหม่สร้างให้ (เมื่อกรอกต้นทุนต่อหน่วย) เข้ากับ import batch — ให้ปุ่ม "ยกเลิกการนำเข้าล่าสุด"
// รู้ว่าใบรับสินค้าใบไหนมาจากการนำเข้ารอบนั้น และย้อนสต๊อก/ล็อตต้นทุน/S/N ของใบนั้นกลับได้ครบ (เดิมย้อนไม่ครบ สต๊อกกับใบรับสินค้าค้างอยู่)
// ADD COLUMN เท่านั้น ข้อมูลเดิมไม่กระทบ (ใบรับสินค้าเดิมทั้งหมดเป็น NULL)
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goods_receipts', function (Blueprint $table) {
            $table->foreignId('import_batch_id')->nullable()->after('created_by')
                ->constrained('import_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('goods_receipts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('import_batch_id');
        });
    }
};
