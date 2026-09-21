<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // show_serials: ติ๊กแสดง/ไม่แสดงเลข S/N ต่อท้ายรายการสินค้าตอนพิมพ์เอกสาร (ใช้กับใบกำกับภาษี/ใบส่งสินค้า)
    // default true = พฤติกรรมเดิม (โชว์เสมอ) ไม่กระทบเอกสารที่มีอยู่แล้ว/ประเภทอื่นที่ไม่ใช้ฟีเจอร์นี้
    public function up(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->boolean('show_serials')->default(true)->after('custom_quoter_name');
        });
    }

    public function down(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->dropColumn('show_serials');
        });
    }
};
