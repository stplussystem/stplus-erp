<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🚀 คู่กับ import_batch_id บนตาราง products แต่ฝั่งนี้ใช้กับการ "ปรับปรุงสต๊อก/S/N" (ไม่ได้สร้างสินค้าใหม่
// แค่แก้จำนวน/สถานะของเดิม) — undo_meta เก็บค่าก่อน/หลังของแถวนั้นๆ ไว้ (เช่น previous_qty/new_qty,
// previous_status/new_status, serial_created) ให้ "ยกเลิกการนำเข้าล่าสุด" คืนค่ากลับได้แม่นยำ
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->foreignId('import_batch_id')->nullable()->after('id')
                ->constrained('import_batches')->nullOnDelete();
            $table->json('undo_meta')->nullable()->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropForeign(['import_batch_id']);
            $table->dropColumn(['import_batch_id', 'undo_meta']);
        });
    }
};
