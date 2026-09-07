<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('permissions', function (Blueprint $table) {
            // 🔌 ปิดเมนูชั่วคราวโดยไม่ลบ permission — ใช้กรองเฉพาะตอนสร้างเมนู sidebar/topbar เท่านั้น
            // (ดู UserSessionFormatter::format()) ไม่กระทบสิทธิ์ manage_* จริงที่มอบให้ role
            $table->boolean('is_active')->default(true)->after('is_menu');
        });
    }

    public function down(): void
    {
        Schema::table('permissions', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
