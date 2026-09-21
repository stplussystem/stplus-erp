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
    Schema::create('products', function (Blueprint $table) {
        $table->id();
        $table->string('sku')->unique();
        $table->string('barcode')->nullable();
        $table->string('name');
        $table->decimal('price', 15, 2)->default(0);
        $table->enum('vat_type', ['7', '0', 'exempt'])->default('7')->comment('ตั้งค่า VAT');
        $table->integer('stock_qty')->default(0)->comment('สต็อกคงเหลือรวม');
        $table->string('image_url')->nullable();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
