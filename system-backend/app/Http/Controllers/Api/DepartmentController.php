<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index()
    {
        // ดึงแผนกพร้อมนับจำนวนพนักงานในแผนกนั้นด้วย
        return response()->json(Department::withCount('users')->get());
    }

    public function store(Request $request)
    {
        $request->validate(['name' => 'required|string|unique:departments']);
        $dept = Department::create($request->all());
        return response()->json(['message' => 'เพิ่มแผนกสำเร็จ', 'data' => $dept]);
    }

    public function update(Request $request, Department $department)
    {
        $request->validate(['name' => 'required|string|unique:departments,name,' . $department->id]);
        $department->update($request->all());
        return response()->json(['message' => 'อัปเดตแผนกสำเร็จ', 'data' => $department]);
    }

    public function destroy(Department $department)
    {
        // เช็คก่อนว่ามีพนักงานอยู่ในแผนกไหม ถ้ามีห้ามลบ
        if ($department->users()->count() > 0) {
            return response()->json(['message' => 'ไม่สามารถลบได้ เนื่องจากยังมีพนักงานอยู่ในแผนกนี้'], 422);
        }
        $department->delete();
        return response()->json(['message' => 'ลบแผนกเรียบร้อย']);
    }
}
