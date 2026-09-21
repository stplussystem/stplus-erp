<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // migration 2026_06_23_101845_add_warehouse_id_to_stock_movements_table.php เป็นไฟล์เปล่า (up/down ไม่ทำอะไรเลย)
    // แต่คอลัมน์ company_id/warehouse_id มีอยู่จริงในเครื่อง dev เดิม (เพิ่มตรงๆ ผ่าน DB ไม่ผ่าน migration)
    // ทำให้ฐานข้อมูลใหม่ (fresh install) ไม่มีคอลัมน์เหล่านี้เลย ทั้งที่ StockMovementController ใช้งานอยู่จริง — เพิ่มให้ถูกต้องที่นี่
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->unsignedBigInteger('company_id')->nullable()->after('product_id');
            $table->unsignedBigInteger('warehouse_id')->nullable()->after('company_id');
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropColumn(['company_id', 'warehouse_id']);
        });
    }
};
