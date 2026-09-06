<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goods_receipt_items', function (Blueprint $table) {
            // ราคาต่อหน่วยตอนรับของจริง — รับผ่าน PO จะ auto-fill จาก purchase_order_items.unit_price,
            // รับตรงไม่มี PO ผู้ใช้กรอกเอง (บังคับกรอกในหน้า create-direct อยู่แล้ว)
            // ใช้เป็นฐานคำนวณต้นทุนถัวเฉลี่ยถ่วงน้ำหนักในรายงานสินค้าคงเหลือ
            $table->decimal('unit_price', 10, 2)->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('goods_receipt_items', function (Blueprint $table) {
            $table->dropColumn('unit_price');
        });
    }
};
