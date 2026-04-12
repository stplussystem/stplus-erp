<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    // ดึงรายชื่อ User ทั้งหมดพร้อม Role
    public function index()
    {
        return response()->json(User::with('roles')->get());
    }

    // สร้าง User ใหม่
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users', // 💡 รับค่า username
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
        ]);

        $user = User::create([
            'name' => $request->name,
            'username' => $request->username, // 💡 บันทึก username
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        // 💡 การโยนสิทธิ์ให้ User แบบรายข้อ (Direct Permissions)
        if ($request->has('permissions') && is_array($request->permissions)) {
            // โค้ดนี้จะสร้างสิทธิ์ในฐานข้อมูลให้ทันทีถ้ายังไม่เคยมี (กัน error)
            foreach ($request->permissions as $permName) {
                \Spatie\Permission\Models\Permission::firstOrCreate(['name' => $permName]);
            }
            // ยัดสิทธิ์ใส่ให้สมชาย
            $user->syncPermissions($request->permissions);
        }

        return response()->json(['message' => 'สร้างผู้ใช้งานสำเร็จ', 'user' => $user]);
    }

    // ลบ User
    public function destroy(User $user)
    {
        if ($user->id === 1) {
            return response()->json(['message' => 'ไม่สามารถลบ Super Admin ได้'], 403);
        }
        $user->delete();
        return response()->json(['message' => 'ลบผู้ใช้งานเรียบร้อยแล้ว']);
    }
}
