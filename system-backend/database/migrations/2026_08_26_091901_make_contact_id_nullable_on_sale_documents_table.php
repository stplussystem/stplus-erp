<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ใบยืมสินค้า (loan_issue) ยืมได้โดยไม่ผูกกับลูกค้าในระบบ (กรอกผู้ยืมเองผ่าน borrower_name แทนได้) — contact_id เดิม NOT NULL
// ใช้ raw statement แทน Schema::table()->change() เพื่อไม่ต้องพึ่ง doctrine/dbal (ไม่ได้ติดตั้งไว้ในโปรเจกต์นี้)
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE sale_documents MODIFY contact_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE sale_documents MODIFY contact_id BIGINT UNSIGNED NOT NULL');
    }
};
