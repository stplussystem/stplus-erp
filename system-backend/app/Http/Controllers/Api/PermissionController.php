<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use App\Models\Role; // 🚀 นำเข้าเพื่อใช้ใน Auto-Sync
use App\Models\SystemSetting;

class PermissionController extends Controller
{
    public function index()
    {
        return response()->json(Permission::orderBy('sort_order', 'asc')->get()->groupBy('group'));
    }

    // 🚀 ตั้งค่า: sync สิทธิ์ใหม่ให้ทุกบริษัทอัตโนมัติไหม (Platform Admin เท่านั้นที่ดู/แก้ได้)
    public function getAutoSyncSetting()
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin เท่านั้น'], 403);
        }
        return response()->json([
            'auto_sync_new_permissions_to_all_companies' => SystemSetting::getBool('auto_sync_new_permissions_to_all_companies', true),
        ]);
    }

    public function updateAutoSyncSetting(Request $request)
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin เท่านั้น'], 403);
        }
        $request->validate(['enabled' => 'required|boolean']);
        SystemSetting::setBool('auto_sync_new_permissions_to_all_companies', $request->boolean('enabled'));

        return response()->json(['message' => 'บันทึกการตั้งค่าสำเร็จ']);
    }

    public function store(Request $request)
    {
        // 🛡️ Permission เป็นตารางกลางใช้ร่วมกันทุกบริษัท ไม่แยกตาม company_id — จำกัดเฉพาะ Platform Admin
        // เท่านั้นที่แก้/ลบได้ (เดิมเช็คแค่ permission:manage_permissions ทำให้ Super Admin ของบริษัทไหนก็ได้
        // ที่สมัครเองผ่าน /register-company แก้ไข/ลบสิทธิ์ที่บริษัทอื่นใช้งานอยู่จริงได้)
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin ของระบบเท่านั้นที่จัดการสิทธิ์ได้'], 403);
        }

        // 🚀 1. เพิ่ม Array ที่สองเข้าไป เพื่อกำหนดข้อความ Error ภาษาไทย
        $request->validate([
            'name' => 'required|unique:permissions,name',
            'group' => 'required|string',
            'sub_group' => 'nullable|string',
            'is_menu' => 'boolean',
            'title_th' => 'nullable|string',
            'path' => 'nullable|string',
            'icon' => 'nullable|string',
            'sort_order' => 'nullable|integer',
        ], [
            'name.unique' => 'รหัสสิทธิ์นี้มีอยู่ในระบบแล้ว ไม่สามารถบันทึกซ้ำได้ครับ',
            'name.required' => 'กรุณากรอกรหัสสิทธิ์ (ภาษาอังกฤษ)',
            'group.required' => 'กรุณาระบุหมวดหมู่ (Group Name)',
        ]);

        try {
            $permission = Permission::create([
                'name' => $request->name,
                'group' => $request->group,
                'sub_group' => $request->sub_group,
                'guard_name' => 'web',
                'is_menu' => $request->is_menu ?? false,
                'title_th' => $request->title_th,
                'path' => $request->path,
                'icon' => $request->icon,
                'sort_order' => $request->sort_order ?? 0,
            ]);

            // 🚀 Auto-Sync: บริษัท 1 (เจ้าของระบบ/Platform Admin) ได้สิทธิ์ใหม่เสมอ เพราะเป็นคนเพิ่มโมดูลเอง
            // เดิมเช็คด้วยชื่อ role ตรงตัว 'Super Admin' ซึ่งมีแค่ role ของบริษัท 1 เท่านั้นที่ชื่อตรงเป๊ะ (ของ tenant อื่นคือ "Super Admin (C{id})")
            // ทำให้ทุก tenant ไม่เคยได้รับสิทธิ์ใหม่อัตโนมัติเลยที่ผ่านมา ตอนนี้เปลี่ยนมาใช้ is_company_admin แทนชื่อ
            // หมายเหตุ: role "Super Admin" ดั้งเดิมในฐานข้อมูลจริงมี company_id เป็น NULL (ไม่ใช่ 1) จึงต้องรองรับทั้งสองแบบ
            $platformAdminRoles = Role::where('is_company_admin', true)
                ->where(fn($q) => $q->whereNull('company_id')->orWhere('company_id', 1))
                ->get();
            foreach ($platformAdminRoles as $role) {
                $role->givePermissionTo($permission);
            }

            $syncedCompanyCount = 0;
            // 🚀 ส่วนของ tenant อื่น: sync ให้ทันทีก็ต่อเมื่อ Platform Admin เปิด toggle นี้ไว้ในหน้าตั้งค่า (ปิดได้ถ้าต้องการคุมสิทธิ์เป็นแพ็กเกจ/tier)
            if (SystemSetting::getBool('auto_sync_new_permissions_to_all_companies', true)) {
                $tenantAdminRoles = Role::where('is_company_admin', true)
                    ->whereNotNull('company_id')->where('company_id', '!=', 1)
                    ->get();
                foreach ($tenantAdminRoles as $role) {
                    $role->givePermissionTo($permission);
                }
                $syncedCompanyCount = $tenantAdminRoles->count();
            }

            app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

            return response()->json([
                'message' => 'เพิ่มสิทธิ์/เมนูสำเร็จ และเพิ่มเข้า Super Admin ของบริษัทเจ้าของระบบแล้ว'
                    . ($syncedCompanyCount > 0 ? " (sync ให้ tenant อื่นอีก {$syncedCompanyCount} บริษัท)" : ''),
                'permission' => $permission,
            ]);
        } catch (\Exception $e) {
            // ดักจับ Error อื่นๆ ที่อาจทำให้เซิร์ฟเวอร์พัง
            return response()->json(['message' => 'เกิดข้อผิดพลาดในการบันทึก: ' . $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin ของระบบเท่านั้นที่จัดการสิทธิ์ได้'], 403);
        }

        $permission = Permission::findOrFail($id);

        $request->validate([
            'name' => 'required|string|unique:permissions,name,' . $id,
            'group' => 'required|string',
            'sub_group' => 'nullable|string',
            'is_menu' => 'boolean',
            'title_th' => 'nullable|string',
            'path' => 'nullable|string',
            'icon' => 'nullable|string',
            'sort_order' => 'nullable|integer',
        ], [
            'name.unique' => 'รหัสสิทธิ์นี้มีอยู่ในระบบแล้ว ไม่สามารถใช้ซ้ำได้ครับ',
            'name.required' => 'กรุณากรอกรหัสสิทธิ์ (ภาษาอังกฤษ)',
            'group.required' => 'กรุณาระบุหมวดหมู่ (Group Name)',
        ]);

        $permission->update([
            'name' => $request->name,
            'group' => $request->group,
            'sub_group' => $request->sub_group,
            'is_menu' => $request->is_menu ?? false,
            'title_th' => $request->title_th,
            'path' => $request->path,
            'icon' => $request->icon,
            'sort_order' => $request->sort_order ?? 0,
        ]);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        return response()->json(['message' => 'อัปเดตสิทธิ์สำเร็จ', 'permission' => $permission]);
    }

    // 🎨 แก้ icon ของ "กลุ่ม" ทั้งกลุ่มในครั้งเดียว — เดิม icon ที่โชว์ในเมนูจริง (ดู UserSessionFormatter::format())
    // มาจาก permission ตัวแรก (เรียงตาม sort_order) ในกลุ่มที่มี icon ไม่ว่าง ทำให้แก้ icon กลุ่มทางอ้อมได้ยาก/เปราะบาง
    // (เปลี่ยน sort_order ทีก็เปลี่ยนว่าใครชนะที) เมธอดนี้ set icon เดียวกันให้ทุก permission ในกลุ่มนั้นไปเลย
    // ตัดปัญหา "ใครชนะ" ทิ้ง — permission เป็นตารางกลางไม่มี company_id จึงมีผลทุกบริษัทเหมือนการแก้ permission ทั่วไป
    public function updateGroupIcon(Request $request)
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin ของระบบเท่านั้นที่จัดการสิทธิ์ได้'], 403);
        }

        $request->validate([
            'group' => 'required|string',
            'icon' => 'required|string',
        ]);

        $updated = Permission::where('group', $request->group)->update(['icon' => $request->icon]);

        if ($updated === 0) {
            return response()->json(['message' => 'ไม่พบกลุ่มนี้ในระบบ'], 404);
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return response()->json(['message' => 'อัปเดต icon ของกลุ่มสำเร็จ']);
    }

    // 🗑️ ลบ permission ทุกตัวใน "กลุ่ม" นั้นพร้อมกันในครั้งเดียว — เดิมมีแต่ลบทีละ permission เท่านั้น
    // (ทำให้ถ้าจะเคลียร์ทั้งกลุ่มต้องกดลบทีละแถว) all-or-nothing: ถ้ามี permission ตัวใดตัวหนึ่งในกลุ่ม
    // ถูกมอบให้ role อยู่จริง บล็อกทั้งกลุ่มทันที ไม่ลบอะไรเลยแม้แต่ตัวเดียว กันไม่ให้ role ที่ใช้งานอยู่
    // เสียสิทธิ์ไปโดยไม่ตั้งใจ
    public function destroyGroup($group)
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin ของระบบเท่านั้นที่จัดการสิทธิ์ได้'], 403);
        }

        $permissions = Permission::where('group', $group)->get();
        if ($permissions->isEmpty()) {
            return response()->json(['message' => 'ไม่พบกลุ่มนี้ในระบบ'], 404);
        }

        $usedPermission = $permissions->first(fn($p) => $p->roles()->count() > 0);
        if ($usedPermission) {
            return response()->json([
                'message' => "ไม่สามารถลบกลุ่มนี้ได้ เพราะสิทธิ์ \"{$usedPermission->title_th}\" ({$usedPermission->name}) ยังถูกมอบให้ role อยู่ กรุณาถอดออกจาก role ที่เกี่ยวข้องก่อน",
            ], 422);
        }

        $ids = $permissions->pluck('id');
        \Illuminate\Support\Facades\DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
        \Illuminate\Support\Facades\DB::table('model_has_permissions')->whereIn('permission_id', $ids)->delete();
        Permission::whereIn('id', $ids)->delete();

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return response()->json(['message' => "ลบกลุ่ม \"{$group}\" ทั้งหมด ({$permissions->count()} สิทธิ์) สำเร็จ"]);
    }

    public function destroy($id)
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin ของระบบเท่านั้นที่จัดการสิทธิ์ได้'], 403);
        }

        // 1. หาข้อมูล Permission ที่ต้องการลบ
        $permission = \Spatie\Permission\Models\Permission::find($id);

        if (!$permission) {
            return response()->json(['message' => 'ไม่พบข้อมูลสิทธิ์การใช้งานนี้'], 404);
        }

        try {
            // 🚀 2. ท่าไม้ตาย (Force Detach): ลบความสัมพันธ์ออกจากทุก Role และทุก User ก่อน
            // เพื่อไม่ให้ติดล็อค Super Admin และไม่ให้เกิด Error ฐานข้อมูล (Foreign Key Constraint)
            \Illuminate\Support\Facades\DB::table('role_has_permissions')->where('permission_id', $id)->delete();
            \Illuminate\Support\Facades\DB::table('model_has_permissions')->where('permission_id', $id)->delete();

            // 3. สั่งลบ Permission ทิ้งแบบถอนรากถอนโคน
            $permission->delete();

            return response()->json(['message' => 'ลบสิทธิ์การใช้งานออกจากระบบสำเร็จ'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'ลบไม่สำเร็จ: ' . $e->getMessage()], 500);
        }
    }

    // public function destroy($id)
    // {
    //     $permission = Permission::findOrFail($id);

    //     if ($permission->roles()->count() > 0 || $permission->users()->count() > 0) {
    //         return response()->json(['message' => 'ไม่สามารถลบได้ เนื่องจากยังมี Role ใช้งานอยู่'], 400);
    //     }

    //     $permission->delete();
    //     app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    //     return response()->json(['message' => 'ลบสิทธิ์สำเร็จ']);
    // }
}
