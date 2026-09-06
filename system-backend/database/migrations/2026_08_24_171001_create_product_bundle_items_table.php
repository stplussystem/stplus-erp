<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // สูตรส่วนประกอบของสินค้าชุด (Bundle) — นิยามครั้งเดียวในหน้าสินค้า ใช้ซ้ำได้ทุกเอกสารขาย
    public function up(): void
    {
        Schema::create('product_bundle_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('bundle_product_id')->constrained('products')->cascadeOnDelete();
            // restrictOnDelete: กันลบสินค้าที่ถูกใช้เป็นส่วนประกอบของชุดอื่นอยู่ (ต้องเอาออกจากสูตรก่อน)
            $table->foreignId('component_product_id')->constrained('products')->restrictOnDelete();
            $table->decimal('quantity', 10, 2);
            $table->integer('sort_order')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'bundle_product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_bundle_items');
    }
};
