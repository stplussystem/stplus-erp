<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// ทะเบียนสินทรัพย์ถาวรของบริษัทเอง (รถขนของ, เครื่องมือช่าง, อุปกรณ์ตรวจสอบ ฯลฯ) — คนละส่วนกับ Product/StockBalance
// ที่เป็นสินค้าขาย MVP นี้เก็บแค่ทะเบียนทรัพย์ + วันครบกำหนดบำรุงรักษาเชิงป้องกัน ไม่มีค่าเสื่อมราคา/อายุการใช้งาน
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('serial_number')->nullable();
            $table->date('purchase_date')->nullable();
            $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['active', 'maintenance', 'retired'])->default('active');
            $table->date('next_maintenance_date')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'next_maintenance_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
