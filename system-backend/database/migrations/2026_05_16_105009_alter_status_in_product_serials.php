<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // 🚀 เปลี่ยนประเภทคอลัมน์ status ให้เป็น String ทั่วไป เพื่อให้รองรับคำว่า lost, defective ได้
        DB::statement("ALTER TABLE product_serials MODIFY status VARCHAR(50) DEFAULT 'available'");
    }

    public function down()
    {
        //
    }
};
