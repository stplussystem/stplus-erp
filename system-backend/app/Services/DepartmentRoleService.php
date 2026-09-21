<?php

namespace App\Services;

use App\Models\Role;
use Spatie\Permission\Models\Permission;

class DepartmentRoleService
{
    // 🚀 สร้าง role คู่ "ผู้จัดการ / พนักงาน" ให้ทีเดียวต่อแผนก (permissions.group) ที่ระบุ ให้บริษัทที่กำหนด —
    // ผู้จัดการได้ทุกสิทธิ์ในแผนก พนักงานได้ทุกสิทธิ์ยกเว้นสิทธิ์ที่ชื่อมีคำว่า approve (ครอบคลุมทั้ง
    // approve_xxx ปกติ และ bt_approve_purchase ในกลุ่มจัดซื้อ) ใช้ firstOrCreate + givePermissionTo (ไม่ใช่
    // syncPermissions) เพื่อให้เรียกซ้ำได้เรื่อยๆ แบบเติมสิทธิ์เท่านั้น ไม่ไปลบสิทธิ์อื่นที่ admin ปรับเพิ่มเอง
    // ทีหลังผ่านหน้าแก้ไข role ปกติ
    //
    // ใช้ร่วมกัน 2 จุด: RoleController::generateDepartmentRoles (ปุ่มในหน้า /roles ให้ admin กดเองทีหลัง —
    // ผู้เรียกต้องเช็คสิทธิ์ผู้ใช้ปัจจุบันเอง เช่น currentUserCanGrantAll ก่อนเรียกเมธอดนี้) และ
    // RegisterCompanyController::register (สร้างเป็นค่าเริ่มต้นให้ทุกบริษัทใหม่อัตโนมัติทุกแผนกที่มีในระบบ —
    // ไม่ต้องเช็คสิทธิ์ผู้เรียก เพราะยังไม่มี user ใดถือสิทธิ์อะไรเลยตอนบริษัทเพิ่งถูกสร้าง)
    public static function generateForCompany(int $companyId, array $groups): array
    {
        $results = [];

        foreach (array_unique($groups) as $group) {
            $permissionsInGroup = Permission::where('group', $group)->get();
            if ($permissionsInGroup->isEmpty()) {
                continue;
            }

            $approvalNames = $permissionsInGroup
                ->filter(fn($p) => str_contains($p->name, 'approve'))
                ->pluck('name')->all();
            $allNames = $permissionsInGroup->pluck('name')->all();
            $staffNames = array_values(array_diff($allNames, $approvalNames));

            $managerRole = Role::firstOrCreate(
                ['name' => "ผู้จัดการ - {$group}", 'guard_name' => 'web', 'company_id' => $companyId]
            );
            $managerRole->givePermissionTo($allNames);

            $staffRole = Role::firstOrCreate(
                ['name' => "พนักงาน - {$group}", 'guard_name' => 'web', 'company_id' => $companyId]
            );
            $staffRole->givePermissionTo($staffNames);

            $results[] = [
                'group' => $group,
                'manager_role' => $managerRole->only(['id', 'name']),
                'manager_permission_count' => count($allNames),
                'staff_role' => $staffRole->only(['id', 'name']),
                'staff_permission_count' => count($staffNames),
            ];
        }

        return $results;
    }
}
