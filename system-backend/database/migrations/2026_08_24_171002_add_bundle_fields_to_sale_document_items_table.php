<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // item_name: ชื่อรายการที่แก้ไขได้ต่อแถว (ถ้าไม่ตั้งใช้ชื่อสินค้าเดิม) — ใช้กับสินค้าชุดและกรณีอื่นที่ต้องการเปลี่ยนชื่อที่แสดง
    // parent_item_id: ระบุว่าแถวนี้เป็น "ส่วนประกอบของ" แถวไหน (ใช้แค่จัดกลุ่มแสดงผล ไม่กระทบ logic ตัดสต๊อกที่ยังวนทุกแถวเหมือนเดิม)
    public function up(): void
    {
        Schema::table('sale_document_items', function (Blueprint $table) {
            $table->string('item_name')->nullable()->after('product_id');
            $table->foreignId('parent_item_id')->nullable()->after('id')
                ->constrained('sale_document_items')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sale_document_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_item_id');
            $table->dropColumn('item_name');
        });
    }
};
