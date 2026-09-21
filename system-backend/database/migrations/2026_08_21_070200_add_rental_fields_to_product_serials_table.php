<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            // mirror sold_at / sold_to_sale_document_id ที่มีอยู่แล้ว — แต่สำหรับสถานะ 'rented' (ชั่วคราว ไม่ใช่ขายขาด)
            $table->timestamp('rented_at')->nullable()->after('sold_to_sale_document_id');
            $table->foreignId('rented_via_sale_document_id')->nullable()->after('rented_at')
                ->constrained('sale_documents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            $table->dropConstrainedForeignId('rented_via_sale_document_id');
            $table->dropColumn('rented_at');
        });
    }
};
