<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🪜 เพิ่มคอลัมน์ stage (ขั้นตอนงาน) ให้ projects/rental_jobs — แยกจาก status เดิมโดยสิ้นเชิง
// ไม่มี DB-level enum ตามธรรมเนียมเดิมของโปรเจกต์ (validate ที่ชั้น Controller แทน)
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('stage')->nullable()->after('status');
        });
        Schema::table('rental_jobs', function (Blueprint $table) {
            $table->string('stage')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('stage');
        });
        Schema::table('rental_jobs', function (Blueprint $table) {
            $table->dropColumn('stage');
        });
    }
};
