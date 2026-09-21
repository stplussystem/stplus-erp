<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // เพิ่มฟิลด์ "วิธีการชำระเงิน" (payment_method) — ใช้เฉพาะใบเสนอราคา (quotation) ตามที่ผู้ใช้ระบุ แต่เก็บเป็น
    // คอลัมน์กลางบนตาราง sale_documents เหมือน transportation/saleman_code เดิม เผื่ออนาคตอยากใช้กับเอกสารอื่นด้วย
    // เป็น string อิสระ (ไม่ใช่ enum) เพราะ frontend ใช้ combobox เลือกจากรายการสำเร็จรูป + พิมพ์เองได้
    public function up(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->string('payment_method', 255)->nullable()->after('saleman_code');
        });
    }

    public function down(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
