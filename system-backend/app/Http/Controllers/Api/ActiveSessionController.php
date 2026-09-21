<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * 🆕 [2026-09-21] หน้า "ผู้ใช้ที่ล็อกอินอยู่" — ดูว่าใครมี session (Sanctum token) ค้างอยู่ และบังคับออกจากระบบทีละคน/ทั้งหมด
 * ใช้เตรียมก่อนกู้คืนข้อมูล (ดู BackupController) เพื่อไม่ให้มีคนใช้งานอยู่ระหว่างที่ข้อมูลถูกแทนที่
 *
 * จำกัดเฉพาะ Platform Admin เพราะเห็น/ตัด session ของผู้ใช้ทุกบริษัท (pattern เดียวกับ BackupController)
 *
 * Token ของระบบนี้ไม่มีวันหมดอายุ (sanctum.expiration = null) "กำลังออนไลน์" จึงประมาณจาก last_used_at:
 * หน้าเว็บที่เปิดค้างไว้ยิง /notifications/unread เป็นระยะ ทำให้ last_used_at อัปเดตต่อเนื่อง (Sanctum อัปเดตอย่างช้านาทีละครั้ง)
 */
class ActiveSessionController extends Controller
{
    // ใช้งานภายในกี่นาทีถึงนับว่า "ออนไลน์"
    private const ONLINE_WITHIN_MINUTES = 5;

    private function authorizePlatformAdmin(Request $request): void
    {
        abort_unless((bool) $request->user()->is_platform_admin, 403, 'เฉพาะ Super Admin ของระบบเท่านั้นที่ดู/บังคับออกจากระบบได้');
    }

    // GET /api/active-sessions
    public function index(Request $request)
    {
        $this->authorizePlatformAdmin($request);

        $currentTokenId = $request->user()->currentAccessToken()?->id;

        $tokens = PersonalAccessToken::where('tokenable_type', User::class)->get();
        $byUser = $tokens->groupBy('tokenable_id');

        $users = User::withoutGlobalScopes()
            ->with('company:id,name')
            ->whereIn('id', $byUser->keys())
            ->get()
            ->keyBy('id');

        $rows = [];
        foreach ($byUser as $userId => $userTokens) {
            $user = $users[$userId] ?? null;
            if (!$user) continue;   // token ของ user ที่ถูกลบไปแล้ว

            $isSelf = (int) $userId === (int) $request->user()->id;
            // session ปัจจุบันของแอดมินเองห้ามถูกตัด (ไม่งั้นหลุดจากหน้านี้ก่อนกู้คืน) จึงนับเฉพาะ token อื่น
            $forceable = $isSelf ? $userTokens->where('id', '!=', $currentTokenId) : $userTokens;

            $lastUsed = $userTokens->max('last_used_at') ?? $userTokens->max('created_at');
            $lastUsed = $lastUsed ? Carbon::parse($lastUsed) : null;

            $rows[] = [
                'user_id' => (int) $userId,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'company' => $user->company ? ['id' => $user->company->id, 'name' => $user->company->name] : null,
                'is_active' => (bool) $user->is_active,
                'is_self' => $isSelf,
                'session_count' => $userTokens->count(),
                'forceable_count' => $forceable->count(),
                'last_activity_at' => $lastUsed?->toIso8601String(),
                'is_online' => $lastUsed && $lastUsed->gte(now()->subMinutes(self::ONLINE_WITHIN_MINUTES)),
            ];
        }

        usort($rows, fn ($a, $b) => strcmp($b['last_activity_at'] ?? '', $a['last_activity_at'] ?? ''));

        return response()->json([
            'data' => $rows,
            'online_within_minutes' => self::ONLINE_WITHIN_MINUTES,
        ]);
    }

    // POST /api/active-sessions/force-logout  { user_ids: [1,2,...] }
    public function forceLogout(Request $request)
    {
        $this->authorizePlatformAdmin($request);

        $data = $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'integer',
        ]);

        $currentTokenId = $request->user()->currentAccessToken()?->id;

        $query = PersonalAccessToken::where('tokenable_type', User::class)
            ->whereIn('tokenable_id', $data['user_ids']);
        if ($currentTokenId) {
            $query->where('id', '!=', $currentTokenId);   // ไม่ตัด session ที่กำลังใช้งานหน้านี้
        }

        $affectedUserIds = (clone $query)->pluck('tokenable_id')->unique()->values();
        $names = User::withoutGlobalScopes()->whereIn('id', $affectedUserIds)->pluck('name')->all();
        $deleted = $query->delete();

        $user = $request->user();
        ActivityLog::create([
            'company_id' => $user->company_id,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'user_email' => $user->email,
            'method' => $request->method(),
            'path' => $request->path(),
            'action' => "บังคับออกจากระบบ {$affectedUserIds->count()} ผู้ใช้ ({$deleted} session): " . implode(', ', $names),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => $deleted > 0
                ? "บังคับออกจากระบบแล้ว {$affectedUserIds->count()} ผู้ใช้ ({$deleted} session)"
                : 'ไม่มี session ที่ต้องตัด',
            'users' => $affectedUserIds->count(),
            'sessions' => $deleted,
        ]);
    }
}
