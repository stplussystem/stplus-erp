<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Models\Company;
use App\Models\User;
use App\Models\Role;
use App\Models\Warehouse;
use App\Models\SystemSetting;
use Spatie\Permission\Models\Permission; // 🚀 อย่าลืมบรรทัดนี้

class RegisterCompanyController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'company_name' => 'required|string|max:255|unique:companies,name', // 🚀 ดักชื่อบริษัทซ้ำ
            'admin_name' => 'required|string|max:255',
            'admin_username' => 'required|string|max:255|unique:users,username',
            'admin_email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
        ], [
            'company_name.required' => 'กรุณากรอกชื่อบริษัทด้วยครับ',
            'company_name.unique' => 'ชื่อบริษัทนี้มีอยู่ในระบบแล้ว', // 🚀 แจ้งเตือนภาษาไทย
            'admin_username.unique' => 'ชื่อผู้ใช้งานนี้ถูกใช้ไปแล้ว กรุณาตั้งชื่ออื่นครับ',
            'admin_email.unique' => 'อีเมลนี้ถูกใช้ไปแล้วในระบบ กรุณาใช้อีเมลอื่นครับ',
        ]);

        // 🛡️ endpoint นี้เป็นหน้าลงทะเบียนสาธารณะ ไม่มี auth:sanctum middleware (ต้องเรียกได้จากคนที่ยัง
        // ไม่ login) แต่หน้าแอดมิน (/company/register-settings) ก็ใช้ฟอร์มเดียวกันนี้ผ่าน RegisterCompanyForm
        // component ที่แนบ Bearer token มาด้วยถ้ามี (ดู RegisterCompanyForm.tsx) — resolve token เองแบบ
        // best-effort ตรงนี้ (ไม่ผ่าน middleware) เพื่อรู้ว่าคำขอนี้มาจาก Platform Admin ที่ login อยู่จริงไหม
        // ถ้าใช่ ให้ข้ามโหมด "รออนุมัติ" เสมอ เพราะ Platform Admin เป็นคนสร้างเองตรงๆ อยู่แล้ว ไม่ต้องรอ
        // อนุมัติตัวเองซ้ำอีกชั้น (โหมดรออนุมัติมีไว้กรองเฉพาะคนแปลกหน้าที่สมัครเองผ่านหน้าสาธารณะเท่านั้น)
        $isPlatformAdminRequest = false;
        if ($bearerToken = $request->bearerToken()) {
            $accessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($bearerToken);
            if ($accessToken && $accessToken->tokenable && $accessToken->tokenable->is_platform_admin) {
                $isPlatformAdminRequest = true;
            }
        }
        $requireApproval = !$isPlatformAdminRequest && SystemSetting::getBool('require_company_approval', false);

        DB::beginTransaction();
        try {
            // 1. สร้างบริษัทใหม่ — is_approved=false ถ้าเปิดโหมดรออนุมัติไว้และไม่ใช่ Platform Admin เป็นคนสร้างเอง
            $company = Company::create([
                'name' => $request->company_name,
                'is_approved' => !$requireApproval,
            ]);

            // 🛡️ Spatie permission teams mode เปิดอยู่ (config/permission.php) — roles.team_id เป็น NOT NULL
            // แต่ endpoint นี้เป็นหน้าลงทะเบียนสาธารณะ ไม่ผ่านการล็อกอิน/middleware ที่ set team id ให้เลย
            // ต้อง set เองตรงนี้ก่อนสร้าง role มิฉะนั้น Role::create()/assignRole() ด้านล่างจะพยายามเขียน team_id
            // เป็น null แล้วชน constraint ทันที (เหมือนที่ DatabaseSeeder.php ต้องทำเช่นเดียวกัน)
            app(\Spatie\Permission\PermissionRegistrar::class)->setPermissionsTeamId($company->id);

            // 1.5 🚀 สร้างคลังหลัก (default warehouse) ให้บริษัทใหม่ทันที เพื่อให้ stock movement มีที่อ้างอิงตั้งแต่วันแรก
            Warehouse::create([
                'company_id' => $company->id,
                'name' => 'คลังหลัก',
                'is_default' => true,
            ]);

            // 2. 🚀 สร้างตำแหน่ง "Super Admin" เฉพาะกิจสำหรับบริษัทนี้ — ไม่ต้องเติม ID ต่อท้ายชื่ออีกต่อไป
            // เพราะ unique constraint ของตาราง roles ผูกกับ team_id (บริษัท) อยู่แล้ว
            // (roles_team_id_name_guard_name_unique) หลายบริษัทมี role ชื่อ "Super Admin" ซ้ำกันได้จริง
            // ไม่ชนกัน — ถ้าจะแยกแยะว่าเป็นของบริษัทไหน (เช่นตอน Platform Admin ดูข้ามบริษัท) ให้ต่อชื่อ
            // บริษัทเข้าไปตอนแสดงผลแทน (คำนวณสดจาก relation เสมอ ไม่ฝังลงชื่อ role ตรงๆ กันปัญหาชื่อค้าง
            // ไม่ sync ถ้าบริษัทเปลี่ยนชื่อทีหลัง — ดู users/page.tsx และ roles/page.tsx)
            // 🛡️ ใช้ Role::query()->create() (Eloquent ธรรมดา) แทน Role::create() ของ Spatie ตรงๆ โดยตั้งใจ —
            // Spatie\Permission\Models\Role::create() เช็คชื่อซ้ำก่อนสร้างด้วย findByParam() ซึ่งใน teams
            // mode จะ query แบบ "team_id ตรงกัน OR team_id เป็น NULL" เสมอ (ดู vendor/spatie/laravel-permission/
            // src/Models/Role.php บรรทัด 178-184) ตั้งใจให้ role ที่ team_id เป็น NULL ถือเป็น role ระดับ
            // "กลาง" ที่ชื่อชนกับทุกทีมได้ — แต่ role "Super Admin" ของ HQ (id=1, สร้างจาก DatabaseSeeder.php
            // ด้วย firstOrCreate() แบบไม่ระบุ team_id เลย) มี team_id เป็น NULL อยู่แล้วโดยไม่ตั้งใจ (เป็น
            // anomaly เก่าที่คอมเมนต์ไว้ในไฟล์นั้นแล้ว) ทำให้ role นี้ไปชนกับ "Super Admin" ของทุกบริษัทใหม่
            // เสมอ พังการสมัครบริษัทที่ 2 เป็นต้นไปทั้งหมด (bug ที่เพิ่งเจอจริงตอนทดสอบสร้างบริษัทที่ 2 ผ่าน
            // ฟอร์มนี้) — ข้าม pre-check ที่มีปัญหานี้ไปเลย ใช้ unique constraint จริงระดับ DB
            // (roles_team_id_name_guard_name_unique ซึ่งกรองด้วย team_id ตรงๆ ไม่มี NULL-matches-all แบบนี้)
            // เป็นตัวป้องกันการซ้ำจริงแทน
            $roleName = 'Super Admin';
            $newRole = Role::query()->create([
                'name' => $roleName,
                'team_id' => $company->id,
                'company_id' => $company->id, // 🚀 ประทับตราบอกว่าเป็น Role ของบริษัทนี้
                'is_company_admin' => true, // 🚀 flag ที่แท้จริง ไม่ต้องพึ่งการเทียบชื่อ role อีกต่อไป
                'guard_name' => 'web'
            ]);

            // 3. 🚀 ดึงสิทธิ์ (เมนู) ทั้งหมดที่มีในระบบ โยนใส่ตำแหน่งนี้
            $allPermissions = Permission::all();
            $newRole->syncPermissions($allPermissions);

            // 4. สร้างบัญชีผู้ใช้คนแรก พร้อมประทับตรา company_id
            $user = User::create([
                'company_id' => $company->id,
                'name' => $request->admin_name,
                'username' => $request->admin_username,
                'email' => $request->admin_email,
                'password' => Hash::make($request->password),
                'is_active' => true,
            ]);

            // 5. สวมมงกุฎให้ User ใหม่
            $user->assignRole($newRole);

            DB::commit();

            return response()->json([
                'message' => $requireApproval
                    ? 'ลงทะเบียนสำเร็จ! กรุณารอ Platform Admin อนุมัติบัญชีของท่านก่อนเข้าใช้งาน'
                    : 'ลงทะเบียนเปิดบริษัทใหม่สำเร็จ!',
                'pending' => $requireApproval,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()
            ], 500);
        }
    }
}
