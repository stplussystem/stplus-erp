<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use App\Models\Role;
use Spatie\Permission\Models\Permission;

class UserController extends Controller
{
    private function isCurrentUserSuperAdmin()
    {
        return auth()->user()->isCompanyAdmin();
    }

    // GET /api/users/options — รายชื่อผู้ใช้แบบย่อ (id, name) สำหรับ dropdown เลือกผู้รับผิดชอบ (PIC)
    // เปิดให้ผู้ใช้ที่ login แล้วทุกคนเรียกได้ (ไม่ต้องมีสิทธิ์ manage_users) เพราะแค่เลือกเพื่อนร่วมบริษัท ไม่ใช่การจัดการผู้ใช้
    public function options()
    {
        $currentUser = auth()->user();

        $users = User::where('company_id', $currentUser->company_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json(['data' => $users]);
    }

    public function index()
    {
        $currentUser = auth()->user();
        $query = User::with(['roles', 'permissions', 'department']);

        // 🔒 ถ้าไม่ใช่ Platform Admin ให้เห็นเฉพาะคนในบริษัทเดียวกัน
        if (!$currentUser->is_platform_admin) {
            $query->where('company_id', $currentUser->company_id)
                ->where('is_platform_admin', false);

            if (!$this->isCurrentUserSuperAdmin()) {
                $query->whereDoesntHave('roles', function ($q) {
                    $q->where('is_company_admin', true);
                });
            }
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'          => 'required|string|max:255',
            'username'      => 'required|string|max:255|unique:users',
            'email'         => 'required|string|email|max:255|unique:users',
            'password'      => 'required|string|min:8',
            'department_id' => 'nullable|exists:departments,id',
            'signature'     => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ], [
            'username.unique' => 'Username นี้ถูกใช้งานในระบบแล้ว',
            'email.unique'    => 'อีเมลนี้ถูกใช้งานในระบบแล้ว',
            'password.min'    => 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
            'signature.max'   => 'ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB ครับ',
        ]);

        $currentUser = auth()->user();

        if ($request->has('roles') && is_array($request->roles)) {
            $assigningSuper = Role::whereIn('name', $request->roles)->where('is_company_admin', true)->exists();
            if ($assigningSuper && !$currentUser->is_platform_admin && !$this->isCurrentUserSuperAdmin()) {
                return response()->json(['message' => 'คุณไม่มีสิทธิ์กำหนดบทบาท Super Admin'], 403);
            }
        }

        $user = User::create([
            'name'          => $request->name,
            'username'      => $request->username,
            'email'         => $request->email,
            'password'      => Hash::make($request->password),
            'department_id' => $request->department_id,
            'company_id'    => $currentUser->company_id, // 🚀 ฝัง Company ID ให้อัตโนมัติ
        ]);

        if ($request->hasFile('signature')) {
            $path = $request->file('signature')->store('signatures', 'public');
            $user->signature_path = $path;
            $user->save();
        }

        // 🚀 จัดการ Permissions (Direct Permissions) — กรองเอาเฉพาะ Permission ที่มีอยู่ในระบบจริงๆ
        // (เพื่อป้องกัน Error เวลาหน้าบ้านส่งค่าแปลกๆ มา และไม่ให้เกิด permission ใหม่ที่ไม่มี group/title_th/icon อีก
        // เดิมใช้ firstOrCreate สร้าง permission ใหม่แบบไม่ใส่ข้อมูลอะไรเลยถ้าชื่อยังไม่มีในระบบ ทำให้เกิดสิทธิ์กลุ่มว่างเปล่า)
        if ($request->has('permissions') && is_array($request->permissions)) {
            $validPermissions = Permission::whereIn('name', $request->permissions)->pluck('name')->toArray();
            $user->syncPermissions($validPermissions);
        }

        if ($request->has('roles') && is_array($request->roles)) {
            $user->syncRoles($request->roles);
        }

        // 🚀 จัดการ Roles
        if ($request->has('roles') && is_array($request->roles)) {
            // กรองเอาเฉพาะ Role ที่มีอยู่ในระบบจริงๆ
            $validRoles = Role::whereIn('name', $request->roles)->pluck('name')->toArray();
            $user->syncRoles($validRoles);
        }

        // 🚀 จัดการ Permissions (Direct Permissions)
        if ($request->has('permissions') && is_array($request->permissions)) {
            // กรองเอาเฉพาะ Permission ที่มีอยู่ในระบบจริงๆ (เพื่อป้องกัน Error เวลาหน้าบ้านส่งค่าแปลกๆ มา)
            $validPermissions = Permission::whereIn('name', $request->permissions)->pluck('name')->toArray();
            $user->syncPermissions($validPermissions);
        }

        return response()->json([
            'message' => 'สร้างผู้ใช้งานสำเร็จ',
            'user'    => $user->load(['department', 'roles', 'permissions'])
        ]);
    }

    public function update(Request $request, User $user)
    {
        $currentUser = auth()->user();

        // 🔒 กันไม่ให้แก้คนข้ามบริษัท
        if (!$currentUser->is_platform_admin && $user->company_id !== $currentUser->company_id) {
            return response()->json(['message' => 'ไม่อนุญาตให้แก้ไขข้อมูลของบริษัทอื่น'], 403);
        }

        if ($user->is_platform_admin && !$currentUser->is_platform_admin) {
            return response()->json(['message' => 'ไม่มีสิทธิ์แก้ไขข้อมูล Platform Admin'], 403);
        }

        $targetIsSuper = $user->isCompanyAdmin();
        if ($targetIsSuper && !$currentUser->is_platform_admin && !$this->isCurrentUserSuperAdmin()) {
            return response()->json(['message' => 'ไม่มีสิทธิ์แก้ไขข้อมูล Super Admin'], 403);
        }

        $request->validate([
            'name'          => 'required|string|max:255',
            'email'         => 'required|string|email|max:255|unique:users,email,' . $user->id,
            'department_id' => 'nullable|exists:departments,id',
            'signature'     => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ], [
            'email.unique'    => 'อีเมลนี้ถูกใช้งานในระบบแล้ว',
            'signature.max'   => 'ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB ครับ',
        ]);

        $user->update([
            'name'          => $request->name,
            'email'         => $request->email,
            'department_id' => $request->department_id,
        ]);

        if ($request->hasFile('signature')) {
            if ($user->signature_path) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($user->signature_path);
            }
            $path = $request->file('signature')->store('signatures', 'public');
            $user->signature_path = $path;
            $user->save();
        }

        if ($currentUser->id === $user->id) {
            if ($request->has('roles') || $request->has('permissions')) {
                return response()->json(['message' => 'คุณไม่สามารถแก้ไขบทบาทหรือสิทธิ์ของตัวเองได้ กรุณาให้ Admin ท่านอื่นเป็นผู้จัดการให้'], 403);
            }
        } else {
            // 🚀 อัปเดต Roles
            if ($request->has('roles') && is_array($request->roles)) {
                $assigningSuper = Role::whereIn('name', $request->roles)->where('is_company_admin', true)->exists();
                if ($assigningSuper && !$currentUser->is_platform_admin && !$this->isCurrentUserSuperAdmin()) {
                    return response()->json(['message' => 'คุณไม่มีสิทธิ์กำหนดบทบาท Super Admin'], 403);
                }

                $validRoles = Role::whereIn('name', $request->roles)->pluck('name')->toArray();
                $user->syncRoles($validRoles);
            } else if ($request->has('roles') && empty($request->roles)) {
                // ถ้าส่ง array เปล่ามา แปลว่าต้องการลบ Roles ทั้งหมด
                $user->syncRoles([]);
            }

            // 🚀 อัปเดต Permissions (Direct Permissions)
            if ($request->has('permissions') && is_array($request->permissions)) {
                $validPermissions = Permission::whereIn('name', $request->permissions)->pluck('name')->toArray();
                $user->syncPermissions($validPermissions);
            } else if ($request->has('permissions') && empty($request->permissions)) {
                // ถ้าส่ง array เปล่ามา แปลว่าต้องการลบสิทธิ์พิเศษทั้งหมด
                $user->syncPermissions([]);
            }
        }

        return response()->json([
            'message' => 'อัปเดตข้อมูลสำเร็จ',
            'user'    => $user->load(['department', 'roles', 'permissions'])
        ]);
    }

    public function resetUserPassword(Request $request, User $user)
    {
        $currentUser = auth()->user();

        if (!$currentUser->is_platform_admin && $user->company_id !== $currentUser->company_id) {
            return response()->json(['message' => 'ไม่อนุญาตให้แก้ไขข้อมูลของบริษัทอื่น'], 403);
        }

        if ($user->is_platform_admin && !$currentUser->is_platform_admin) {
            return response()->json(['message' => 'ไม่มีสิทธิ์เปลี่ยนรหัสผ่าน Platform Admin'], 403);
        }

        $targetIsSuper = $user->isCompanyAdmin();
        if ($targetIsSuper && !$currentUser->is_platform_admin && !$this->isCurrentUserSuperAdmin()) {
            return response()->json(['message' => 'ไม่มีสิทธิ์เปลี่ยนรหัสผ่าน Super Admin'], 403);
        }

        $request->validate([
            'password' => 'required|min:8|confirmed',
        ], [
            'password.min'       => 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
            'password.confirmed' => 'การยืนยันรหัสผ่านไม่ตรงกัน',
        ]);

        $user->password = Hash::make($request->password);
        $user->save();

        return response()->json(['message' => 'รีเซ็ตรหัสผ่านเรียบร้อย']);
    }

    public function destroy(User $user)
    {
        $currentUser = auth()->user();

        if (!$currentUser->is_platform_admin && $user->company_id !== $currentUser->company_id) {
            return response()->json(['message' => 'ไม่อนุญาตให้ลบข้อมูลของบริษัทอื่น'], 403);
        }

        if ($currentUser->id === $user->id) {
            return response()->json(['message' => 'คุณไม่สามารถลบบัญชีของตัวเองที่กำลังใช้งานอยู่ได้!'], 403);
        }

        if ($user->is_platform_admin) {
            return response()->json(['message' => 'ไม่อนุญาตให้ลบ Platform Admin (ผู้ดูแลระบบสูงสุด) ออกจากระบบ'], 403);
        }

        $isSuperAdmin = $user->isCompanyAdmin();

        if ($isSuperAdmin && !$currentUser->is_platform_admin) {
            return response()->json(['message' => 'ไม่อนุญาตให้ลบบัญชี Super Admin ออกจากระบบ (ทำได้แค่ระงับการใช้งานเท่านั้น)'], 403);
        }

        $user->delete();
        return response()->json(['message' => 'ย้ายผู้ใช้งานไปที่ถังขยะเรียบร้อยแล้ว']);
    }

    public function toggleStatus(User $user)
    {
        $currentUser = auth()->user();

        if (!$currentUser->is_platform_admin && $user->company_id !== $currentUser->company_id) {
            return response()->json(['message' => 'ไม่อนุญาตให้แก้ไขข้อมูลของบริษัทอื่น'], 403);
        }

        if ($currentUser->id === $user->id) {
            return response()->json(['message' => 'คุณไม่สามารถระงับการใช้งานบัญชีของตัวเองได้!'], 403);
        }

        if ($user->is_platform_admin && !$currentUser->is_platform_admin) {
            return response()->json(['message' => 'ไม่อนุญาตให้ระงับการใช้งาน Platform Admin'], 403);
        }

        $targetIsSuper = $user->isCompanyAdmin();
        if ($targetIsSuper && !$currentUser->is_platform_admin && !$this->isCurrentUserSuperAdmin()) {
            return response()->json(['message' => 'ไม่มีสิทธิ์ระงับการใช้งานบัญชี Super Admin'], 403);
        }

        $user->is_active = !$user->is_active;
        $user->save();

        $statusName = $user->is_active ? 'เปิดการใช้งาน' : 'ระงับการใช้งาน';

        return response()->json([
            'message' => "{$statusName} บัญชีนี้เรียบร้อยแล้ว",
            'is_active' => $user->is_active
        ]);
    }

    public function trashed()
    {
        $currentUser = auth()->user();
        $query = User::onlyTrashed()->with('department');

        if (!$currentUser->is_platform_admin) {
            $query->where('company_id', $currentUser->company_id)
                ->where('is_platform_admin', false);
            if (!$this->isCurrentUserSuperAdmin()) {
                $query->whereDoesntHave('roles', function ($q) {
                    $q->where('is_company_admin', true);
                });
            }
        }

        return response()->json($query->get());
    }

    public function restore($id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $currentUser = auth()->user();

        if (!$currentUser->is_platform_admin && $user->company_id !== $currentUser->company_id) {
            return response()->json(['message' => 'ไม่อนุญาตให้แก้ไขข้อมูลของบริษัทอื่น'], 403);
        }

        $user->restore();

        return response()->json(['message' => 'กู้คืนบัญชีผู้ใช้งานเรียบร้อยแล้ว']);
    }

    public function forceDelete($id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $currentUser = auth()->user();

        if (!$currentUser->is_platform_admin && $user->company_id !== $currentUser->company_id) {
            return response()->json(['message' => 'ไม่อนุญาตให้ลบข้อมูลของบริษัทอื่น'], 403);
        }

        $rawAvatar = $user->getRawOriginal('avatar');
        if ($rawAvatar) {
            $oldPath = preg_replace('/^.*\/storage\//', '', $rawAvatar);
            if (Storage::disk('public')->exists($oldPath)) {
                Storage::disk('public')->delete($oldPath);
            }
        }

        $user->forceDelete();
        return response()->json(['message' => 'ลบผู้ใช้งานแบบถาวรเรียบร้อยแล้ว']);
    }

    public function restoreBatch(Request $request)
    {
        $request->validate(['ids' => 'required|array']);

        $currentUser = auth()->user();
        $query = User::onlyTrashed()->whereIn('id', $request->ids);

        if (!$currentUser->is_platform_admin) {
            $query->where('company_id', $currentUser->company_id);
        }

        $query->restore();

        return response()->json(['message' => 'กู้คืนบัญชีที่เลือกเรียบร้อยแล้ว']);
    }

    public function forceDeleteBatch(Request $request)
    {
        $request->validate(['ids' => 'required|array']);

        $currentUser = auth()->user();
        $query = User::onlyTrashed()->whereIn('id', $request->ids);

        if (!$currentUser->is_platform_admin) {
            $query->where('company_id', $currentUser->company_id);
        }

        $users = $query->get();
        foreach ($users as $user) {
            $rawAvatar = $user->getRawOriginal('avatar');
            if ($rawAvatar) {
                $oldPath = preg_replace('/^.*\/storage\//', '', $rawAvatar);
                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                }
            }
        }

        $query->forceDelete();
        return response()->json(['message' => 'ลบข้อมูลแบบถาวรเรียบร้อยแล้ว']);
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'password' => 'required|min:8|confirmed',
        ], [
            'password.min'       => 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
            'password.confirmed' => 'การยืนยันรหัสผ่านไม่ตรงกัน',
        ]);

        $user = auth()->user();
        $user->password = Hash::make($request->password);
        $user->save();

        return response()->json(['message' => 'เปลี่ยนรหัสผ่านเรียบร้อย']);
    }

    public function updateProfile(Request $request)
    {
        $request->validate(
            [
                'name'   => 'required|string|max:255',
                'phone'  => 'nullable|string|max:20',
                'avatar' => 'nullable|image|mimes:jpeg,png,jpg|max:1024',
                'signature' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
            ],
            [
                'avatar.max'   => 'ขนาดไฟล์รูปรวมต้องไม่เกิน 1MB ครับ',
                'avatar.image' => 'กรุณาอัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น',
                'avatar.mimes' => 'รองรับเฉพาะไฟล์ .jpg, .jpeg, .png เท่านั้น'
            ],
            [
                'signature.max'   => 'ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB ครับ',
                'signature.image' => 'กรุณาอัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น',
                'signature.mimes' => 'รองรับเฉพาะไฟล์ .jpg, .jpeg, .png, .gif เท่านั้น'
            ]
        );

        $user = auth()->user();
        $user->name = $request->name;
        $user->phone = $request->phone;

        if ($request->has('remove_avatar') && $request->remove_avatar == '1') {
            $rawAvatar = $user->getRawOriginal('avatar');
            if ($rawAvatar) {
                $oldPath = preg_replace('/^.*\/storage\//', '', $rawAvatar);
                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                }
                $user->avatar = null;
            }
        }

        if ($request->hasFile('avatar')) {
            $rawAvatar = $user->getRawOriginal('avatar');
            if ($rawAvatar) {
                $oldPath = preg_replace('/^.*\/storage\//', '', $rawAvatar);
                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                }
            }

            $file = $request->file('avatar');
            $filename = time() . '_user_' . $user->id . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('avatars', $filename, 'public');

            $user->avatar = $path;
        }

        if ($request->hasFile('signature')) {
            if ($user->signature_path) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($user->signature_path);
            }
            $path = $request->file('signature')->store('signatures', 'public');
            $user->signature_path = $path;
        }

        $user->save();

        return response()->json([
            'message' => 'บันทึกข้อมูลเรียบร้อย',
            'user'    => $user->load('department')
        ]);
    }
}
