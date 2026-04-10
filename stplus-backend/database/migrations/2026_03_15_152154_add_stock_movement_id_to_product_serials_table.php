<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            // เพิ่มคอลัมน์ใหม่ต่อท้าย status
            $table->foreignId('stock_movement_id')
                ->nullable()
                ->after('status')
                ->constrained('stock_movements')
                ->nullOnDelete()
                ->comment('อ้างอิงจากลอตที่รับเข้า');

            // แอบเพิ่ม Unique ให้เลข S/N ด้วยครับ เพื่อป้องกันการยิงบาร์โค้ดซ้ำเข้าตาราง
            $table->unique('serial_number');
        });
    }

    public function down(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            // วิธีย้อนกลับ (ลบความสัมพันธ์ และ ลบคอลัมน์)
            $table->dropForeign(['stock_movement_id']);
            $table->dropColumn('stock_movement_id');
            $table->dropUnique(['serial_number']);
        });
    }
};
