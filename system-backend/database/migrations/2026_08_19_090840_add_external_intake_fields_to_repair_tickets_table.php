<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('repair_tickets', function (Blueprint $table) {
            // true = ลูกค้านำเครื่องมาเองโดยไม่ได้ซื้อผ่านระบบ — ข้ามการตรวจสอบ S/N/เอกสารขายจริงที่บังคับปกติ
            $table->boolean('is_external')->default(false)->after('reference_sale_document_id');
            // S/N ที่ผู้ใช้พิมพ์เองตอนโหมด external (ไม่ผูกกับ product_serials เพราะไม่เคยมีประวัติหน่วยนี้ในระบบ)
            $table->string('manual_serial_number', 100)->nullable()->after('is_external');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('repair_tickets', function (Blueprint $table) {
            $table->dropColumn(['is_external', 'manual_serial_number']);
        });
    }
};
