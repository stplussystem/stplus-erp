<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // 🚀 รองรับโหมด "รออนุมัติจาก Platform Admin" ตอนบริษัทใหม่สมัครผ่านหน้า /register-company สาธารณะ —
    // default(true) เพื่อไม่กระทบบริษัทที่มีอยู่แล้วในระบบ (ถือว่าอนุมัติแล้วทั้งหมดโดยอัตโนมัติ)
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->boolean('is_approved')->default(true)->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('is_approved');
        });
    }
};
