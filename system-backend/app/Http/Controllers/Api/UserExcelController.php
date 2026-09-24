<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Exports\UsersExport;
use App\Imports\UsersImport;
use App\Models\User;
use Maatwebsite\Excel\Facades\Excel;

class UserExcelController extends Controller
{
    // โหลด Template เปล่า
    public function exportTemplate()
    {
        return Excel::download(new UsersExport(true), 'user_template.xlsx');
    }

    // โหลดข้อมูลผู้ใช้งานทั้งหมด
    public function export(Request $request)
    {
        $users = User::with(['department', 'roles'])->latest()->get();
        $fileName = 'users_data_' . now()->format('YmdHi') . '.xlsx';

        return Excel::download(new UsersExport(false, $users), $fileName);
    }

    // นำเข้าข้อมูล
    public function import(Request $request)
    {
        $request->validate(['file' => 'required|mimes:xlsx,xls,csv']);

        try {
            // 🐛 [2026-09-24] ครอบทั้งไฟล์ด้วย transaction เดียว — เดิมแถวที่ผ่านแล้วถูกบันทึกจริงไปก่อนที่แถวหลังจะพัง (ค้างครึ่งไฟล์)
            \Illuminate\Support\Facades\DB::transaction(function () use ($request) {
                Excel::import(new UsersImport, $request->file('file'));
            });
            return response()->json(['message' => 'นำเข้าข้อมูลผู้ใช้งานสำเร็จเรียบร้อย!']);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }
}
