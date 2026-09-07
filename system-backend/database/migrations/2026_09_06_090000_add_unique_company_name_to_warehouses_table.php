<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // 🛡️ กันชื่อคลังสินค้าซ้ำภายในบริษัทเดียวกัน (เช่น "คลังหลัก" ซ้ำ) — ตอนตรวจสอบก่อนรัน migration นี้ยืนยันแล้วว่าไม่มีข้อมูลซ้ำเหลืออยู่
    // สาเหตุเดิม: WarehouseController::store() ไม่มี validation กันชื่อซ้ำ + DatabaseSeeder.php สร้างบริษัท/คลังหลักซ้ำได้ถ้ารัน db:seed ซ้ำ (แก้แยกอีกจุดแล้ว)
    public function up(): void
    {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->unique(['company_id', 'name'], 'warehouses_company_id_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropUnique('warehouses_company_id_name_unique');
        });
    }
};
