<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // เพิ่มประเภทสินค้า (ตั้งค่าเริ่มต้นเป็น inventory = สินค้านับสต็อก)
            $table->enum('product_type', ['service', 'inventory', 'non-inventory'])
                ->default('inventory')
                ->after('id')
                ->comment('ประเภท: บริการ, นับสต็อก, ไม่นับสต็อก');

            // เพิ่มหน่วยนับ (เชื่อมไปตาราง units)
            $table->foreignId('unit_id')->nullable()->after('brand_id')->constrained('units')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['unit_id']);
            $table->dropColumn(['product_type', 'unit_id']);
        });
    }
};
