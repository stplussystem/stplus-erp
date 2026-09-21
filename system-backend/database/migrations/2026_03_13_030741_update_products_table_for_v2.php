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
            // เพิ่มคอลัมน์ ยี่ห้อ, รุ่น, และ รูปภาพ
            $table->foreignId('brand_id')->nullable()->after('category_id')->constrained('brands')->nullOnDelete();
            $table->string('model_name')->nullable()->after('name')->comment('รุ่นสินค้า');
            $table->string('image')->nullable()->after('model_name')->comment('พาธรูปภาพ');

            // เอาคอลัมน์สต็อกตั้งต้นออก (เพราะเราจะไปใช้ระบบรับเข้าคลังแทน)
            $table->dropColumn('stock_qty');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['brand_id']);
            $table->dropColumn(['brand_id', 'model_name', 'image']);
            $table->integer('stock_qty')->default(0);
        });
    }
};
