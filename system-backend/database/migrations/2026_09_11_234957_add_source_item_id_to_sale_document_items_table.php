<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // source_item_id: ชี้ไปยังแถวสินค้าต้นทางในเอกสารอื่น (เช่น ใบเสนอราคา) ที่แถวนี้ถูกโหลดมาจาก — ใช้คำนวณ
    // จำนวนคงเหลือที่ยังเบิกได้ต่อรายการ (ดู SaleDocumentController::issuableItems()) คนละความหมายกับ
    // parent_item_id ที่เชื่อมแถวแม่-ลูกสินค้าชุดภายในเอกสารเดียวกัน
    public function up(): void
    {
        Schema::table('sale_document_items', function (Blueprint $table) {
            $table->foreignId('source_item_id')->nullable()->after('parent_item_id')
                ->constrained('sale_document_items')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sale_document_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_item_id');
        });
    }
};
