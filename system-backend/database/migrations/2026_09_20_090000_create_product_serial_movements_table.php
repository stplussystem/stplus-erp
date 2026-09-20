<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🆕 [2026-09-20] log การเคลื่อนไหวของ S/N รายตัว (เริ่มจากการโอนย้ายคลังสินค้า) — ProductSerial เก็บได้แค่ตำแหน่ง
// ปัจจุบัน (warehouse_id/stock_movement_id ถูกเขียนทับทุกครั้งที่โอน) จึงไม่เหลือประวัติว่าเคยอยู่คลังไหนมาก่อน
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_serial_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('product_serial_id')->constrained('product_serials')->cascadeOnDelete();
            $table->string('event_type', 30)->default('transfer');
            $table->foreignId('from_warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->foreignId('to_warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->foreignId('from_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('to_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('reference_number', 100)->nullable();
            $table->text('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['product_serial_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_serial_movements');
    }
};
