<?php

namespace App\Imports;

use App\Models\User;
use App\Models\Department;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Hash;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithStartRow;

class UsersImport implements ToModel, WithStartRow
{
    public function startRow(): int
    {
        return 2;
    }

    public function model(array $row)
    {
        // บังคับว่าต้องมีชื่อ และ อีเมล
        if (empty($row[0]) || empty($row[1])) {
            return null;
        }

        $email = trim($row[1]);

        // 🛡️ อีเมล unique ทั้งระบบ แต่ query ปกติถูก scope ตามบริษัทของผู้ import อัตโนมัติ (BelongsToCompany) —
        // ถ้าอีเมลนี้เป็นของบริษัทอื่นอยู่แล้ว updateOrCreate() ด้านล่างจะพยายาม INSERT ซ้ำแล้วชน unique constraint
        // ระดับฐานข้อมูล ได้ error ที่แยกแยะได้จาก "import สำเร็จ" กลายเป็นช่องทางเช็คว่าอีเมลนี้มีอยู่ในระบบทั้ง
        // แพลตฟอร์มหรือไม่ (ข้ามบริษัท) — ข้ามแถวนี้แบบเงียบๆ เหมือนแถวที่ข้อมูลไม่ครบแทน ไม่ให้มีสัญญาณต่างกัน
        $currentCompanyId = auth()->user()->company_id ?? null;
        $existingElsewhere = User::withoutGlobalScopes()->where('email', $email)->first();
        if ($existingElsewhere && $currentCompanyId && $existingElsewhere->company_id !== $currentCompanyId) {
            return null;
        }

        // 1. ตรวจสอบ/สร้าง แผนก
        $departmentId = null;
        if (!empty($row[3])) {
            $dept = Department::firstOrCreate(['name' => trim($row[3])]);
            $departmentId = $dept->id;
        }

        // 2. จัดเตรียมข้อมูลสำหรับบันทึก
        $userData = [
            'name' => trim($row[0]),
        ];
        // 🐛 [2026-09-24] ตั้ง department_id เฉพาะเมื่อไฟล์ระบุแผนกมา — เดิมช่องแผนกว่างจะเขียน null ทับแผนกเดิมของผู้ใช้ที่มีอยู่แล้วเงียบๆ
        if ($departmentId !== null) {
            $userData['department_id'] = $departmentId;
        }

        // 3. จัดการเรื่องรหัสผ่าน
        if (!empty($row[2])) {
            // ถ้าระบุรหัสผ่านใน Excel มา ให้เปลี่ยนตามนั้นเลย
            $plainPassword = trim($row[2]);
            if (mb_strlen($plainPassword) < 8) {
                throw new \DomainException("รหัสผ่านของ {$email} สั้นเกินไป (ต้องมีอย่างน้อย 8 ตัวอักษร) — ไม่มีการนำเข้าใดๆ เกิดขึ้น");
            }
            $userData['password'] = Hash::make($plainPassword);
        } else if (!User::where('email', $email)->exists()) {
            // 🐛 [2026-09-24] เดิมผู้ใช้ใหม่ที่ไม่ระบุรหัสผ่านถูกตั้งเป็น "12345678" ตายตัว (เดาได้ ทุกคนที่ import แบบนี้ได้รหัสเดียวกัน)
            // ไม่มีระบบบังคับเปลี่ยนรหัสผ่านตอนเข้าครั้งแรก จึงบังคับให้ระบุรหัสผ่านสำหรับผู้ใช้ใหม่ในไฟล์เสมอ
            throw new \DomainException("{$email} เป็นผู้ใช้ใหม่ ต้องระบุรหัสผ่านในไฟล์ (อย่างน้อย 8 ตัวอักษร) — ไม่มีการนำเข้าใดๆ เกิดขึ้น");
        }

        // 4. บันทึกข้อมูล (ถ้าอีเมลซ้ำ = อัปเดต, ถ้าไม่ซ้ำ = สร้างใหม่)
        $user = User::updateOrCreate(
            ['email' => $email],
            $userData
        );

        // 5. จัดการเรื่องบทบาท (Role) - ใช้แพ็คเกจ Spatie
        if (!empty($row[4])) {
            $roleName = trim($row[4]);
            // 🛡️ ต้องกรองด้วย company_id เสมอ — ตั้งแต่ตัดวงเล็บ "(C{id})" ออกจากชื่อ role Super Admin แล้ว
            // ชื่อ role ไม่ unique ข้ามบริษัทอีกต่อไป (หลายบริษัทมี role ชื่อ "Super Admin" ซ้ำกันได้จริง)
            // ถ้าไม่กรอง query นี้ (ซึ่งข้าม global scope ได้เมื่อผู้ import เป็น Platform Admin) อาจหยิบ role
            // ผิดบริษัทมาผูกกับ user ที่กำลัง import — $currentCompanyId ประกาศไว้แล้วด้านบน (บรรทัด 32)
            $role = Role::where('name', $roleName)->where('company_id', $currentCompanyId)->first();
            if ($role) {
                // 🛡️ ห้ามตั้งบทบาท Super Admin ผ่านการนำเข้า Excel เว้นแต่ผู้ import เองเป็น Platform Admin
                // หรือ Super Admin ของบริษัทอยู่แล้ว — เดิม path นี้ไม่มีการเช็คเลย ต่างจาก UserController::store()/update()
                // ที่ป้องกันไว้ ทำให้ผู้ใช้ที่มีแค่สิทธิ์ manage_users ยกระดับตัวเองเป็น Super Admin ผ่านไฟล์นำเข้าได้
                $currentUser = auth()->user();
                $isAssigningSuper = (bool) $role->is_company_admin;
                $allowed = !$isAssigningSuper
                    || !$currentUser
                    || $currentUser->is_platform_admin
                    || $currentUser->isCompanyAdmin();

                if ($allowed) {
                    // อัปเดตบทบาทให้ตรงกับใน Excel
                    $user->syncRoles([$role->name]);
                }
            }
        }

        return $user;
    }
}
