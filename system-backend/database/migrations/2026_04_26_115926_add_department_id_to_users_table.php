<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // เพิ่มคอลัมน์ department_id และผูกกับตาราง departments
            // (ถ้าแผนกถูกลบ ให้ข้อมูลพนักงานคนนั้นกลายเป็น null แทน เพื่อไม่ให้พนักงานหายไป)
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropColumn('department_id');
        });
    }
};
