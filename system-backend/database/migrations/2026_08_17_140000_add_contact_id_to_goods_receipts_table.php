<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // ใบรับสินค้าแบบ "รับตรงไม่มี PO" (storeDirectGoodsReceipt) validate contact_id ว่าต้องเลือกผู้จำหน่าย
    // แต่ไม่เคยมีคอลัมน์ให้บันทึกค่านี้เก็บไว้เลย ทำให้ข้อมูลผู้จำหน่ายหายไปทันทีหลังบันทึก
    // (ต่างจากใบรับสินค้าที่อ้างอิง PO ซึ่งดึงผู้จำหน่ายผ่าน purchase_order_id -> contact ได้อยู่แล้ว)
    public function up(): void
    {
        Schema::table('goods_receipts', function (Blueprint $table) {
            $table->foreignId('contact_id')->nullable()->after('purchase_order_id')->constrained('contacts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('goods_receipts', function (Blueprint $table) {
            $table->dropForeign(['contact_id']);
            $table->dropColumn('contact_id');
        });
    }
};
