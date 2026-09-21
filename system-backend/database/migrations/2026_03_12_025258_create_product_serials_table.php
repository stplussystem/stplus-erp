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
        Schema::create('product_serials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();

            // unique() ป้องกันพนักงานยิง S/N ซ้ำซ้อนเข้าสู่ระบบครับ
            $table->string('serial_number')->unique()->comment('หมายเลข S/N');
            $table->enum('status', ['available', 'sold', 'defective'])->default('available')->comment('สถานะของ S/N');

            // เพื่อเชื่อมว่า S/N นี้ถูกรับเข้ามาจากการเคลื่อนไหว (ลอต) ไหน
            $table->unsignedBigInteger('stock_movement_id')->nullable()->comment('อ้างอิงจากตาราง stock_movements');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_serials');
    }
};
