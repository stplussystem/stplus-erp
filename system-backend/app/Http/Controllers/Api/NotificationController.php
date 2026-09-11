<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    // ดึงการแจ้งเตือนที่ยังไม่ได้อ่าน
    public function unread(Request $request)
    {
        return response()->json($request->user()->unreadNotifications);
    }

    // กดอ่านทั้งหมด
    public function markAllAsRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();
        return response()->json(['message' => 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมด']);
    }

    // ดึงรายการแจ้งเตือนทั้งหมด (อ่านแล้ว+ยังไม่อ่าน) ล่าสุดก่อน
    public function index(Request $request)
    {
        return response()->json(
            $request->user()->notifications()->latest()->limit(50)->get()
        );
    }

    // อ่านทีละรายการ — ต้องเช็คว่าเป็นของ user คนนี้จริงก่อน (ป้องกันอ่านแจ้งเตือนคนอื่น)
    public function markAsRead(Request $request, $id)
    {
        $notification = $request->user()->notifications()->where('id', $id)->first();
        if (!$notification) {
            return response()->json(['message' => 'ไม่พบการแจ้งเตือน'], 404);
        }
        $notification->markAsRead();
        return response()->json(['message' => 'อ่านแล้ว']);
    }
}
