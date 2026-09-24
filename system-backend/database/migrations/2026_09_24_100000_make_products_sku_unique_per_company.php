<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🛡️ SKU ต้องไม่ซ้ำ "ภายในบริษัทเดียวกัน" (เดิม unique ทั้งระบบ ทำให้บริษัท A ตั้ง SKU ที่บริษัท B ใช้อยู่แล้วไม่ได้ และรู้ได้ว่า
// อีกบริษัทมี SKU นี้) — ข้อมูลเดิมไม่กระทบ เพราะเดิมไม่ซ้ำทั้งระบบอยู่แล้ว จึงไม่ซ้ำภายในบริษัทแน่นอน
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique('products_sku_unique');
            $table->unique(['company_id', 'sku'], 'products_company_sku_unique');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique('products_company_sku_unique');
            $table->unique('sku', 'products_sku_unique');
        });
    }
};
