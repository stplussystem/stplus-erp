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
}
