<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->string('custom_logo_path')->nullable()->after('note');
            $table->string('custom_company_name')->nullable()->after('custom_logo_path');
            $table->string('custom_quoter_name')->nullable()->after('custom_company_name');
        });
    }

    public function down(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->dropColumn(['custom_logo_path', 'custom_company_name', 'custom_quoter_name']);
        });
    }
};
