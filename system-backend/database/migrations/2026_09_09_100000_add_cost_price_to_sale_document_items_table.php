<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🚀 เก็บ "ราคาต้นทุน" ต่อรายการสินค้าไว้คำนวณกำไร-ขาดทุน (ไม่แสดงตอนพิมพ์เอกสาร) — เดิมระบบไม่มีต้นทุน
// ผูกกับแถวขายเลยสักแถว มีแต่คำนวณถัวเฉลี่ยสดจากใบรับสินค้าตอนทำรายงานเท่านั้น
// (ReportController::averageCostByProduct()) ค่าเริ่มต้นของคอลัมน์นี้จะถูกดึงมาจากค่าถัวเฉลี่ยเดียวกันตอน
// เลือกสินค้าในฟอร์ม แต่แก้ไขเองได้เฉพาะกรณีเป็นงานเช่า + สินค้าประเภทเช่า/บริการ
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_document_items', function (Blueprint $table) {
            $table->decimal('cost_price', 15, 2)->nullable()->default(0)->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('sale_document_items', function (Blueprint $table) {
            $table->dropColumn('cost_price');
        });
    }
};
