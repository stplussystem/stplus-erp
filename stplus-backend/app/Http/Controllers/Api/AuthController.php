<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use App\Notifications\PasswordResetNotification;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        // 💡 1. เปลี่ยนจาก 'email' เป็น 'login' เพื่อรับค่าอะไรก็ได้
        $request->validate([
            'login' => 'required',
            'password' => 'required',
        ]);

        // 💡 2. ค้นหาแบบ 2 เงื่อนไข (ชื่อ หรือ อีเมล)
        $user = User::where('email', $request->login)
                    ->orWhere('name', $request->login)
                    ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'ชื่อผู้ใช้งาน อีเมล หรือรหัสผ่านไม่ถูกต้อง'
            ], 401);
        }

        $user->tokens()->delete();
        $token = $user->createToken('stplus_auth_token')->plainTextToken;
        $permissions = $user->getAllPermissions()->pluck('name');

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'permissions' => $permissions
            ]
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'ออกจากระบบเรียบร้อยแล้ว']);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $permissions = $user->getAllPermissions()->pluck('name');

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'permissions' => $permissions
            ]
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['login' => 'required']);

        // ==========================================
        // 1. ส่งแจ้งเตือนเข้า Discord Webhook
        // ==========================================
        $discordUrl = env('DISCORD_WEBHOOK_URL');
        if($discordUrl) {
            $message = "🚨 **แจ้งลืมรหัสผ่าน (ST PLUS ERP)**\nพนักงาน/ผู้ใช้: `{$request->login}`\nกรุณาตรวจสอบและรีเซ็ตรหัสผ่านในระบบหลังบ้านให้ด้วยครับ";
            Http::post($discordUrl, ['content' => $message]);
        }

        // ==========================================
        // 2. แจ้งเตือนกระดิ่ง (In-System) ให้เฉพาะ Admin
        // ==========================================
        // 💡 เปลี่ยนวิธีค้นหาแอดมินแบบเจาะจงข้ามตาราง (แก้ปัญหา Spatie หา Role ไม่เจอ)
        $admins = User::whereHas('roles', function($query) {
            $query->where('name', 'Super Admin');
        })->get();

        // 💡 ท่าไม้ตาย เซฟตี้เน็ต: ถ้าหาใครไม่เจอเลย ให้ดึง User คนแรกสุดของระบบมารับจบ!
        if ($admins->isEmpty()) {
            $admins = User::where('id', 1)->get();
        }

        // ยืนยันการส่งข้อความ
        if ($admins->count() > 0) {
            Notification::send($admins, new PasswordResetNotification($request->login));
        }

        return response()->json(['message' => 'ส่งคำขอรีเซ็ตรหัสผ่านเรียบร้อยแล้ว']);
    }
}
