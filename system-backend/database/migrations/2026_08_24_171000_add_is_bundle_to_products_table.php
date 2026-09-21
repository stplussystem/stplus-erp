<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // สินค้าชุด (Bundle/Kit) — ขายเป็น 1 บรรทัดราคาชุด ไม่มีสต๊อกของตัวเอง ตัดสต๊อกเฉพาะส่วนประกอบผ่าน product_bundle_items
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_bundle')->default(false)->after('is_install_job');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('is_bundle');
        });
    }
};
