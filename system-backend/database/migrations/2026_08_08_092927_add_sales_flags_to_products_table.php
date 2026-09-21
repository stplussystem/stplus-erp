<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::table('products', function (Blueprint $table) {
            // 🚀 เพิ่มป้ายกำกับ (Flags) เข้าไป
            $table->boolean('can_sell')->default(true)->after('product_type');
            $table->boolean('can_rent')->default(false)->after('can_sell');
            $table->boolean('is_install_job')->default(false)->after('can_rent');
        });

        // 🚀 คืนค่า product_type ให้กลับเป็นมาตรฐานบัญชี 3 ตัวหลัก (เผื่อรอบที่แล้วพี่เคเผลอแก้ไปแล้ว)
        DB::statement("ALTER TABLE products MODIFY product_type ENUM('inventory', 'non-inventory', 'service') DEFAULT 'inventory'");
    }

    public function down()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['can_sell', 'can_rent', 'is_install_job']);
        });
    }
};
