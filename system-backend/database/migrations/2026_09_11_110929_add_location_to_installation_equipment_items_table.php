<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('installation_equipment_items', function (Blueprint $table) {
            // 🚀 ห้อง/ตำแหน่งติดตั้ง — เว้นว่างได้ ใช้แยกกรณีสินค้าตัวเดียวกันหลายชุดแต่ติดคนละห้อง (สร้างหลาย
            // แถวของ product_id เดียวกัน แต่ระบุ location ต่างกันได้ — ตารางนี้ไม่มี unique constraint ผูกกับ
            // product_id อยู่แล้ว จึงรองรับได้โดยไม่ต้องแก้ schema อื่นเพิ่ม)
            $table->string('location')->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('installation_equipment_items', function (Blueprint $table) {
            $table->dropColumn('location');
        });
    }
};
