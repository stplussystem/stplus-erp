<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // StockMovementController และ GoodsReceiptController ทั้งคู่ insert ProductSerial::create()
    // พร้อม warehouse_id แต่ตาราง product_serials ไม่เคยมีคอลัมน์นี้เลย (schema เดิมมีแค่ company_id/product_id)
    // ทำให้รับสินค้า/เบิกสินค้าสำหรับสินค้าที่คุม S/N พังด้วย SQL error ทุกครั้ง — เพิ่มคอลัมน์ให้ตรงกับโค้ดจริง
    public function up(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            $table->unsignedBigInteger('warehouse_id')->nullable()->after('product_id');
        });
    }

    public function down(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            $table->dropColumn('warehouse_id');
        });
    }
};
