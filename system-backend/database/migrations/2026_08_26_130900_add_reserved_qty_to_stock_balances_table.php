<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🎪 แนวคิด "จองสินค้า" (reservation) — ของยังอยู่ใน stock จริง แค่ถูกกันไว้ไม่ให้งานอื่นเบิกซ้ำ
// ต่างจาก qty (จำนวนที่มีในคลังจริง) — คงเหลือใช้ได้จริง = qty - reserved_qty
// ใบเบิกสินค้า(งานเช่า) อนุมัติแล้วจะเพิ่ม reserved_qty แทนการตัด qty จริงแบบเดิม (ดู SaleDocumentController::approve())
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_balances', function (Blueprint $table) {
            $table->unsignedInteger('reserved_qty')->default(0)->after('qty');
        });
    }

    public function down(): void
    {
        Schema::table('stock_balances', function (Blueprint $table) {
            $table->dropColumn('reserved_qty');
        });
    }
};
