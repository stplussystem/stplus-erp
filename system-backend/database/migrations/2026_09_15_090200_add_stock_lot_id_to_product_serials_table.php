<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🆕 ผูก S/N แต่ละชิ้นเข้ากับล็อตต้นทุนของมันโดยตรง — ไม่ลบ/แตะ stock_movement_id เดิม (ยังใช้อยู่ที่
// GoodsReceiptController::cancelGoodsReceipt() และ import-undo) คอลัมน์นี้มีไว้เพื่อ "ต้นทุน" เท่านั้น
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            $table->foreignId('stock_lot_id')->nullable()->after('stock_movement_id')
                ->constrained('stock_lots')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            $table->dropForeign(['stock_lot_id']);
            $table->dropColumn('stock_lot_id');
        });
    }
};
