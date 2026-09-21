<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. เติมลงตาราง Users
        // Schema::table('users', function (Blueprint $table) {
        //     if (!Schema::hasColumn('users', 'company_id')) {
        //         // ให้เป็น nullable() ก่อน เพื่อไม่ให้ Error กับข้อมูลเก่าที่มีอยู่แล้ว
        //         $table->unsignedBigInteger('company_id')->nullable()->after('id');
        //     }
        // });

        // 2. เติมลงตาราง Roles
        Schema::table('roles', function (Blueprint $table) {
            if (!Schema::hasColumn('roles', 'company_id')) {
                $table->unsignedBigInteger('company_id')->nullable()->after('id');
            }
        });

        // 3. เติมลงตาราง Warehouses
        Schema::table('warehouses', function (Blueprint $table) {
            if (!Schema::hasColumn('warehouses', 'company_id')) {
                $table->unsignedBigInteger('company_id')->nullable()->after('id');
            }
        });

        // 4. เติมลงตาราง Units (ตามที่เราวิเคราะห์กันว่าต้องแยก)
        Schema::table('units', function (Blueprint $table) {
            if (!Schema::hasColumn('units', 'company_id')) {
                $table->unsignedBigInteger('company_id')->nullable()->after('id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('company_id');
        });
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('company_id');
        });
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropColumn('company_id');
        });
        Schema::table('units', function (Blueprint $table) {
            $table->dropColumn('company_id');
        });
    }
};
