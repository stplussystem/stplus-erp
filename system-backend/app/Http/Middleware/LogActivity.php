<?php

namespace App\Http\Middleware;

use App\Models\ActivityLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response;

// 🕵️ บันทึก audit trail อัตโนมัติทุก request ที่แก้ไขข้อมูล (POST/PUT/PATCH/DELETE) ของทุกโมดูล
// โดยไม่ต้องแก้โค้ดใน controller ทีละจุด — ทำงานใน terminate() (หลังส่ง response กลับไปแล้ว) เพื่อไม่ให้
// การเขียน log กระทบความเร็วของ request จริงที่ user เห็นเลยแม้แต่มิลลิวินาทีเดียว
class LogActivity
{
    // เส้นทางที่ไม่ต้องบันทึก log ซ้ำ/ไม่มีประโยชน์พอจะเก็บ
    private const EXCLUDED_PATH_PREFIXES = [
        'api/logout', // มีการบันทึก action 'auth.logout' แบบระบุชัดเจนใน AuthController อยู่แล้ว ไม่ต้องให้ middleware นี้จับซ้ำ
        'api/notifications', // กด "อ่านแล้ว" ถี่มาก ไม่ใช่ "การกระทำ" ที่มีความหมายเชิง audit
    ];

    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        if (!in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            return;
        }

        $user = $request->user();
        if (!$user) {
            return;
        }

        $path = $request->path();
        foreach (self::EXCLUDED_PATH_PREFIXES as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return;
            }
        }

        try {
            $routeName = Route::currentRouteName();
            $action = $routeName ?: ($request->method() . ' ' . $path);

            ActivityLog::create([
                'company_id' => $user->company_id,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_email' => $user->email,
                'method' => $request->method(),
                'path' => $path,
                'action' => $action,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // 🛡️ log ล้มเหลวต้องไม่ทำให้อะไรพังต่อ (response ถูกส่งไปแล้วตั้งแต่ก่อนเข้า terminate() ด้วยซ้ำ)
            Log::warning('บันทึก activity log ไม่สำเร็จ: ' . $e->getMessage());
        }
    }
}
