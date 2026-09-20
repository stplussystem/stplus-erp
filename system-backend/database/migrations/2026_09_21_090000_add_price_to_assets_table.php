<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            // มูลค่า/ราคาสินทรัพย์ (ราคาซื้อ) — nullable เพื่อไม่กระทบสินทรัพย์เดิมที่ยังไม่มีข้อมูล
            $table->decimal('price', 15, 2)->nullable()->after('purchase_date');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('price');
        });
    }
};
