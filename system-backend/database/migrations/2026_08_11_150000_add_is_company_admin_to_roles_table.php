<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // ก่อนหน้านี้ระบบเช็ค "เป็น Super Admin ไหม" ด้วยการเทียบชื่อ role (str_contains 'Super Admin')
    // ซึ่งใช้ได้บังเอิญเพราะ role ของทุกบริษัทตั้งชื่อ "Super Admin (C{id})" แต่เปราะบาง (เปลี่ยนชื่อ role เมื่อไหร่ก็พัง)
    // ย้ายมาใช้ flag ที่ชัดเจนแทน แล้ว backfill ให้ตรงกับพฤติกรรมเดิมทุกประการ
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->boolean('is_company_admin')->default(false)->after('company_id');
        });

        DB::table('roles')->where('name', 'like', '%Super Admin%')->update(['is_company_admin' => true]);
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('is_company_admin');
        });
    }
};
