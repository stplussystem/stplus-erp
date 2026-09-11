<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🚀 ระบุว่าแถวสินค้านี้ถูก "สร้างใหม่" โดยการนำเข้า Excel ครั้งไหน (นำไปใช้ตอนกด "ยกเลิกการนำเข้าล่าสุด")
// เติมค่าเฉพาะตอนสร้างแถวใหม่เท่านั้น — ถ้าไฟล์นำเข้ามี SKU ซ้ำกับสินค้าเดิม (updateOrCreate ไปอัปเดตทับ)
// จะไม่แตะคอลัมน์นี้ สินค้าเดิมจึงไม่มีวันถูกลบตอน undo
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('import_batch_id')->nullable()->after('id')
                ->constrained('import_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['import_batch_id']);
            $table->dropColumn('import_batch_id');
        });
    }
};
