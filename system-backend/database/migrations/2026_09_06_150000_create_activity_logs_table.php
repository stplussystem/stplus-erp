<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🕵️ Activity Log — บันทึกว่าใครทำอะไร เมื่อไหร่ จาก IP ไหน (audit trail) แยกตารางเองจากของ
// spatie/laravel-activitylog (ตาราง activity_log เอกพจน์) เพราะแพ็กเกจนั้นมีอยู่แล้วแต่ใช้แค่กับ
// RepairTicket (บันทึก diff ของ field status อย่างเดียว) และตารางเดิมไม่มีคอลัมน์ company_id/ip_address
// เลย การเอามาต่อยอดจะเสี่ยงชนกับการใช้งานเดิมและต้องผ่าคอลัมน์แปลกปลอมเข้าไปในตารางของแพ็กเกจ
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            // ไม่ผูก FK แบบ constrained() ตรงๆ เพราะ platform admin อาจไม่มี company_id (เขียน log ข้ามบริษัทได้)
            $table->unsignedBigInteger('company_id')->nullable()->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // เก็บ snapshot ชื่อ/อีเมลไว้เผื่อ user ถูกลบทิ้งภายหลัง ประวัติจะได้ยังอ่านได้ว่าใครทำ
            $table->string('user_name')->nullable();
            $table->string('user_email')->nullable();
            $table->string('method', 10);
            $table->string('path');
            $table->string('action');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
