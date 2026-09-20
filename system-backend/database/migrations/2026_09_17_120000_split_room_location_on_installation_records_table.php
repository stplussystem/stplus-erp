<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🔀 [2026-09-17] แยก room_location (ช่องเดียว) เป็น floor + room สองช่องอิสระ ไม่บังคับกรอกทั้งคู่ — ผู้ใช้ต้องการ
// แก้ไขย้อนหลังได้ถ้ามีการย้ายจุดติดตั้งภายหลัง (ดู InstallationRecordController::update() ที่ผ่อนให้แก้ไข 2 ช่องนี้
// ได้แม้สถานะไม่ใช่ scheduled แล้ว) ตาราง installation_records ยังไม่มีข้อมูลจริงในระบบ (0 แถว) จึง drop คอลัมน์เดิม
// ทิ้งได้เลยโดยไม่ต้อง data-migration แยกค่าเก่า
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('installation_records', function (Blueprint $table) {
            $table->string('floor', 100)->nullable()->after('site_address');
            $table->string('room', 100)->nullable()->after('floor');
        });
        Schema::table('installation_records', function (Blueprint $table) {
            $table->dropColumn('room_location');
        });
    }

    public function down(): void
    {
        Schema::table('installation_records', function (Blueprint $table) {
            $table->string('room_location', 150)->nullable()->after('site_address');
        });
        Schema::table('installation_records', function (Blueprint $table) {
            $table->dropColumn(['floor', 'room']);
        });
    }
};
