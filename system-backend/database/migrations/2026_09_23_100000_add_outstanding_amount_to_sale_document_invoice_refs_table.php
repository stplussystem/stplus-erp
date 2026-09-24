<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🧾 ช่อง "ยอดค้างชำระ" ในใบเสร็จรับเงิน — ผู้ใช้กรอกเองได้ (ไม่ดึงอัตโนมัติ) ปล่อยว่างได้เหมือนฟอร์มใบเสร็จจริงที่เว้นช่องนี้ไว้เขียนมือ
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_document_invoice_refs', function (Blueprint $table) {
            $table->decimal('outstanding_amount', 15, 2)->nullable()->after('payment_amount');
        });
    }

    public function down(): void
    {
        Schema::table('sale_document_invoice_refs', function (Blueprint $table) {
            $table->dropColumn('outstanding_amount');
        });
    }
};
