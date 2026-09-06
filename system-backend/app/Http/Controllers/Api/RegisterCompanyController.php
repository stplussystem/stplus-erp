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

        DB::beginTransaction();
        try {
            // 1. สร้างบริษัทใหม่
            $company = Company::create([
                'name' => $request->company_name,
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

            // 2. 🚀 สร้างตำแหน่ง "Super Admin" เฉพาะกิจสำหรับบริษัทนี้ (เติม ID ต่อท้ายเพื่อไม่ให้ชื่อซ้ำกันในระบบ)
            $roleName = 'Super Admin (C' . $company->id . ')';
            $newRole = Role::create([
                'name' => $roleName,
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
                'message' => 'ลงทะเบียนเปิดบริษัทใหม่สำเร็จ!',
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()
            ], 500);
        }
    }
}
