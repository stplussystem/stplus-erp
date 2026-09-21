<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 🆕 เพิ่มค่า 'price_list' ให้ enum import_batches.type รองรับการนำเข้า Excel ของโมดูล Price List
// (เดิมมีแค่ master/adjust สำหรับสินค้า) — ตาราง/แถวเดิมไม่ถูกแตะ แค่ขยายชุดค่าที่ enum ยอมรับ
return new class extends Migration
{
    // 🛡️ Laravel 11+ ใช้ driver name 'mariadb' แยกจาก 'mysql' เมื่อ DB_CONNECTION=mariadb (ดู
    // config/database.php) — เช็คแค่ 'mysql' เดิมทำให้ ALTER TABLE ไม่ทำงานเลยบน MariaDB (silently skipped)
    private function isMySqlFamily(): bool
    {
        return in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    public function up(): void
    {
        if ($this->isMySqlFamily()) {
            DB::statement("ALTER TABLE import_batches MODIFY COLUMN type ENUM('master', 'adjust', 'price_list') NOT NULL COMMENT 'master=นำเข้าสินค้าใหม่, adjust=ปรับปรุงสต๊อก/S/N, price_list=นำเข้า Price List ผู้จำหน่าย'");
        }
    }

    public function down(): void
    {
        if ($this->isMySqlFamily()) {
            DB::statement("ALTER TABLE import_batches MODIFY COLUMN type ENUM('master', 'adjust') NOT NULL COMMENT 'master=นำเข้าสินค้าใหม่, adjust=ปรับปรุงสต๊อก/S/N'");
        }
    }
};
