<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // เพิ่มฟิลด์ที่จำเป็นสำหรับพิมพ์ใบกำกับภาษี/ใบส่งสินค้าตามแบบฟอร์มจริงของบริษัท (การขนส่ง, รหัสพนักงานขาย, หัก มัดจำ)
    // reference_number มีอยู่แล้วในตารางนี้ ใช้เป็น "เลขที่ P.O./เลขที่ใบสั่งซื้อ" ได้เลยไม่ต้องเพิ่ม
    public function up(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->string('transportation', 255)->nullable()->after('reference_number');
            $table->string('saleman_code', 100)->nullable()->after('transportation');
            $table->decimal('deposit_amount', 15, 2)->nullable()->default(0)->after('discount_amount');
        });
    }

    public function down(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->dropColumn(['transportation', 'saleman_code', 'deposit_amount']);
        });
    }
};
