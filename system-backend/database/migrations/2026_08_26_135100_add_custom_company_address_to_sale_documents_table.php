<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// เอกสารกำหนดเอง (custom_quotation / custom_cash) — เพิ่มที่อยู่บริษัทที่ override ได้ต่อเอกสาร คู่กับ custom_company_name เดิม
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->text('custom_company_address')->nullable()->after('custom_company_name');
        });
    }

    public function down(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->dropColumn('custom_company_address');
        });
    }
};
