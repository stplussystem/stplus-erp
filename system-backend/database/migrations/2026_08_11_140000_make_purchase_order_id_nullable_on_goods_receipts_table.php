<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // purchase_order_id ต้องเป็น nullable เพราะ storeDirectGoodsReceipt (รับของตรงไม่มี PO) ต้องบันทึกเป็น null ได้
    // ใช้ raw SQL แทน ->change() เพราะโปรเจกต์นี้ไม่ได้ติดตั้ง doctrine/dbal
    public function up()
    {
        DB::statement('ALTER TABLE goods_receipts MODIFY purchase_order_id BIGINT UNSIGNED NULL');
    }

    public function down()
    {
        DB::statement('UPDATE goods_receipts SET purchase_order_id = 0 WHERE purchase_order_id IS NULL');
        DB::statement('ALTER TABLE goods_receipts MODIFY purchase_order_id BIGINT UNSIGNED NOT NULL');
    }
};
