<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// ใบยืมสินค้า (loan_issue) — ยืมได้ทั้งลูกค้าในระบบ (contact_id) หรือผู้ยืมนอกระบบ (กรอกชื่อ/เบอร์เองตรงนี้)
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->string('borrower_name')->nullable()->after('contact_id');
            $table->string('borrower_phone', 50)->nullable()->after('borrower_name');
        });
    }

    public function down(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->dropColumn(['borrower_name', 'borrower_phone']);
        });
    }
};
