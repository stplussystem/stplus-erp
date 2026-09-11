<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            // เพิ่มคอลัมน์ is_active ต่อท้าย note (ค่าเริ่มต้นคือ 1 = ใช้งานอยู่)
            $table->boolean('is_active')->default(1)->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
