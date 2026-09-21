<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 🔄 [2026-09-08] Data-fix เฉพาะรูปแบบชื่อ role "Super Admin (C{ตัวเลข})" เท่านั้น — ไม่แตะ role อื่นเลย
 * (เช่น role id=1 "Super Admin" ของ HQ ที่ team_id/company_id เป็น NULL อยู่แล้ว ไม่ตรง pattern นี้)
 *
 * เดิม RegisterCompanyController::register() ตั้งชื่อ role Super Admin ของบริษัทใหม่เป็น
 * "Super Admin (C{company_id})" เพื่อกันชื่อซ้ำ — แต่ unique constraint จริงของตาราง roles ผูกกับ team_id
 * (บริษัท) อยู่แล้ว (roles_team_id_name_guard_name_unique) หลายบริษัทมี role ชื่อ "Super Admin" ซ้ำกันได้จริง
 * ไม่ชนกัน จึงเปลี่ยนไปตั้งชื่อแบบสั้นๆ "Super Admin" เฉยๆ แทน (ดู RegisterCompanyController.php) —
 * migration นี้ทำหน้าที่ backfill role ที่มีอยู่แล้วก่อนการเปลี่ยนแปลงนี้ให้ตรงรูปแบบใหม่ด้วย
 *
 * ใช้ pattern match (REGEXP) ไม่ hardcode role id เพื่อให้ถูกต้องในทุก environment ไม่ใช่แค่ dev ปัจจุบัน
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('roles')
            ->whereRaw("name REGEXP '^Super Admin \\\\(C[0-9]+\\\\)$'")
            ->update(['name' => 'Super Admin']);
    }

    public function down(): void
    {
        // ย้อนกลับเฉพาะแถวที่ backfill ตอน up() น่าจะเคยแตะ (name ตรงเป๊ะ "Super Admin" + มี company_id +
        // เป็น role admin ของบริษัท) — คืนค่า suffix จาก company_id ของแถวนั้นเอง ไม่แตะ role id=1 (HQ) ที่
        // company_id เป็น NULL อยู่แล้ว
        DB::table('roles')
            ->where('name', 'Super Admin')
            ->where('is_company_admin', true)
            ->whereNotNull('company_id')
            ->get(['id', 'company_id'])
            ->each(function ($role) {
                DB::table('roles')
                    ->where('id', $role->id)
                    ->update(['name' => 'Super Admin (C' . $role->company_id . ')']);
            });
    }
};
