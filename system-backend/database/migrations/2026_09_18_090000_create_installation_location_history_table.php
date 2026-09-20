<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🆕 [2026-09-18] เก็บประวัติชั้น/ห้องเดิมก่อนแก้ไข (ดู InstallationRecordController::update()) — ตอนแยก
// room_location เป็น floor/room แยก 2 ช่อง ผู้ใช้ยืนยันไว้ว่าต้องการ "ดูย้อนหลังได้หากมีการเปลี่ยนแปลงห้อง ชั้น"
// แต่ตอนนั้นยังไม่ได้ทำตารางเก็บประวัติจริง แก้ไขแล้วค่าเดิมหายไปเลย — ตารางนี้แก้ช่องว่างนั้น
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installation_location_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('installation_record_id')->constrained('installation_records')->cascadeOnDelete();
            $table->string('floor', 100)->nullable();
            $table->string('room', 100)->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installation_location_history');
    }
};
