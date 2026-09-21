<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🆕 [2026-09-20] ข้อความย่อหน้าเนื้อหาของใบสำคัญรับเงิน (ใต้หัวเอกสาร) ที่ผู้ใช้พิมพ์เองได้ไม่จำกัดความยาว
// ว่าง = ใช้ข้อความมาตรฐานเดิมของ ReceiptVoucherPdfTemplate
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('government_contracts', function (Blueprint $table) {
            $table->longText('receipt_voucher_text')->nullable()->after('receipt_voucher_number');
        });
    }

    public function down(): void
    {
        Schema::table('government_contracts', function (Blueprint $table) {
            $table->dropColumn('receipt_voucher_text');
        });
    }
};
