<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $currentUser = auth()->user();
        $currentUser->loadMissing('roles');

        $currentIsSuper = $currentUser->isCompanyAdmin();

        // Query ดึงข้อมูล Role
        $query = Role::leftJoin('companies', 'roles.company_id', '=', 'companies.id')
            ->select('roles.*', 'companies.name as company_name');

        // 🚀 แก้ไขลอจิกการมองเห็นตรงนี้ครับ!
        if (!$currentUser->is_platform_admin) {
            // 1. แอดมินธรรมดา ล็อคดูได้แค่ของบริษัทตัวเองเท่านั้น
            $query->where('roles.company_id', $currentUser->company_id);
        } else {
            // 2. พระเจ้า (Platform Admin)
            if ($request->has('company_id') && $request->company_id !== 'all') {
                // ถ้าหน้าเว็บสั่งขอส่องบริษัทอื่น ให้ดูได้
                $query->where('roles.company_id', $request->company_id);
            } else {
                // 🌟 จุดที่แก้: ถ้าไม่ได้เจาะจง ให้ Default โชว์แค่บริษัทตัวเองไปก่อน! จะได้ไม่เบิ้ล
                $query->where('roles.company_id', $currentUser->company_id);
            }
        }

        if (!$currentUser->is_platform_admin && !$currentIsSuper) {
            $query->where('roles.is_company_admin', false);
        }

        $roles = $query->with('permissions')->get();
        return response()->json($roles);
    }

    public function store(Request $request)
    {
        $request->validate([
            // 🚀 เช็คชื่อซ้ำแค่ในบริษัทเดียวกันเท่านั้น
            'name' => 'required|string|unique:roles,name,NULL,id,company_id,' . auth()->user()->company_id,
            'permissions' => 'nullable|array'
        ]);

        // 🛡️ ห้ามมอบ permission ที่ตัวเองไม่มีให้ role ใหม่ — เดิมไม่มีการเช็คเลย ใครมีแค่สิทธิ์ manage_roles
        // ก็สร้าง role ที่รวมทุก permission อ่อนไหวในระบบได้ ทั้งที่ตัวเองไม่มีสิทธิ์เหล่านั้นด้วยซ้ำ
        if ($request->has('permissions') && !$this->currentUserCanGrantAll($request->permissions)) {
            return response()->json(['message' => 'คุณไม่สามารถมอบสิทธิ์ที่ตัวเองไม่มีให้ role ได้'], 403);
        }

        // 🚀 บันทึก company_id ของคนที่สร้างไปด้วย
        $role = Role::create([
            'name' => $request->name,
            'guard_name' => 'web',
            'company_id' => auth()->user()->company_id
        ]);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->permissions);
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return response()->json(['message' => 'สร้างกลุ่มตำแหน่งสำเร็จ', 'role' => $role->load('permissions')]);
    }

    public function update(Request $request, $id)
    {
        $role = Role::findOrFail($id);
        $currentUser = auth()->user();

        // 🔒 กันไม่ให้แก้ Role ข้ามบริษัท (ยกเว้น Platform Admin)
        if (!$currentUser->is_platform_admin && $role->company_id !== $currentUser->company_id) {
            return response()->json(['message' => 'ไม่อนุญาตให้แก้ไขข้อมูลของบริษัทอื่น'], 403);
        }

        if ($role->is_company_admin) {
            return response()->json(['message' => 'ไม่อนุญาตให้แก้ไขสิทธิ์ของกลุ่ม Super Admin'], 403);
        }

        $request->validate([
            // 🚀 เช็คชื่อซ้ำแค่ในบริษัทเดียวกันเท่านั้น
            'name' => 'required|string|unique:roles,name,' . $id . ',id,company_id,' . $role->company_id,
            'permissions' => 'nullable|array'
        ]);

        // 🛡️ เช็คเดียวกับ store() — ห้ามมอบ permission ที่ตัวเองไม่มีให้ role ที่แก้ไข
        if ($request->has('permissions') && !$this->currentUserCanGrantAll($request->permissions)) {
            return response()->json(['message' => 'คุณไม่สามารถมอบสิทธิ์ที่ตัวเองไม่มีให้ role ได้'], 403);
        }

        $role->update(['name' => $request->name]);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->permissions);
        } else {
            $role->syncPermissions([]);
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return response()->json(['message' => 'อัปเดตกลุ่มตำแหน่งสำเร็จ', 'role' => $role->load('permissions')]);
    }

    // 🛡️ true ถ้าผู้ใช้ปัจจุบันถือ permission ทุกตัวที่ระบุอยู่แล้ว (หรือเป็น platform admin / company admin ที่มีทุกสิทธิ์อยู่แล้ว)
    private function currentUserCanGrantAll(array $permissionNames): bool
    {
        $currentUser = auth()->user();
        if ($currentUser->is_platform_admin || $currentUser->isCompanyAdmin()) {
            return true;
        }

        foreach ($permissionNames as $permissionName) {
            if (!$currentUser->can($permissionName)) {
                return false;
            }
        }

        return true;
    }

    public function destroy($id)
    {
        $role = Role::findOrFail($id);
        $currentUser = auth()->user();

        // 🔒 กันไม่ให้ลบ Role ข้ามบริษัท
        if (!$currentUser->is_platform_admin && $role->company_id !== $currentUser->company_id) {
            return response()->json(['message' => 'ไม่อนุญาตให้ลบข้อมูลของบริษัทอื่น'], 403);
        }

        if ($role->is_company_admin) {
            return response()->json(['message' => 'ไม่อนุญาตให้ลบกลุ่มตำแหน่ง Super Admin'], 403);
        }

        if ($role->users()->count() > 0) {
            return response()->json(['message' => 'ไม่สามารถลบได้ เนื่องจากมีผู้ใช้งานอยู่ในตำแหน่งนี้'], 400);
        }

        $role->delete();
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return response()->json(['message' => 'ลบกลุ่มตำแหน่งสำเร็จ']);
    }
}
