<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // purchase_orders.status ถูกสร้างเป็น ENUM('Draft','Pending','Approved','Completed','Cancelled')
    // ตั้งแต่แรก แต่โค้ดจริง (GoodsReceiptController::storeGoodsReceipt) เซ็ตสถานะเป็น 'Partial'
    // ทุกครั้งที่รับสินค้าไม่ครบตามจำนวนสั่งซื้อ — ค่านี้ไม่อยู่ใน ENUM เลย ทำให้ MariaDB
    // ปฏิเสธด้วย "Data truncated for column 'status'" ทุกครั้งที่รับของบางส่วน
    public function up(): void
    {
        DB::statement("ALTER TABLE purchase_orders MODIFY status ENUM('Draft','Pending','Approved','Partial','Completed','Cancelled') DEFAULT 'Draft'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE purchase_orders MODIFY status ENUM('Draft','Pending','Approved','Completed','Cancelled') DEFAULT 'Draft'");
    }
};
