<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// ใบยืมสินค้า (loan_issue) รองรับ 2 ทิศทาง: 'lend_out' (ให้ลูกค้ายืม, ผูกสต๊อกเรา) กับ 'borrow_in'
// (เราขอยืมของลูกค้ามา, ไม่ผูกสต๊อกเลย กรอกรายการสินค้าเป็นข้อความอิสระผ่าน sale_document_items.item_name แทน
// จึงต้องเปิด product_id ให้ nullable ด้วย — ใช้ raw statement เพื่อไม่ต้องพึ่ง doctrine/dbal เหมือน migration ก่อนหน้า)
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->string('loan_direction')->nullable()->after('borrower_phone');
        });

        DB::statement('ALTER TABLE sale_document_items MODIFY product_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->dropColumn('loan_direction');
        });

        DB::statement('ALTER TABLE sale_document_items MODIFY product_id BIGINT UNSIGNED NOT NULL');
    }
};
