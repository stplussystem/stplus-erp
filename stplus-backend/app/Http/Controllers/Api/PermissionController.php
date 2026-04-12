<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    public function index()
    {
        // ส่งออกไปแบบจัดกลุ่มให้หน้าบ้านวาด Checkbox ง่ายๆ
        return response()->json(Permission::all()->groupBy('group'));
    }

    public function store(Request $request)
    {
        // 💡 แก้ไข: ลบ 'label' ออก เพราะหน้าเว็บไม่ได้ส่งมา
        $request->validate([
            'name' => 'required|unique:permissions,name',
            'group' => 'required|string',
        ]);

        $permission = Permission::create([
            'name' => $request->name,
            'group' => $request->group,
            'guard_name' => 'web'
        ]);

        return response()->json(['message' => 'เพิ่มสิทธิ์สำเร็จ', 'permission' => $permission]);
    }
}
