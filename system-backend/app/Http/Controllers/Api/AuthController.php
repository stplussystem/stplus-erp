<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\CompanyAccessService;
use App\Services\UserSessionFormatter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use App\Notifications\PasswordResetNotification;

class AuthController extends Controller
{
    public function __construct(
        private CompanyAccessService $companyAccess,
        private UserSessionFormatter $formatter
    ) {
    }

    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required|string',
        ]);

        $loginField = filter_var($request->login, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';

        if (!\Illuminate\Support\Facades\Auth::attempt([$loginField => $request->login, 'password' => $request->password])) {
            // 🕵️ ไม่มี user จริงให้ผูก เก็บแค่ค่าที่พิมพ์เข้ามาไว้ใน user_name เพื่อดูรูปแบบการเดารหัสผ่าน/บัญชีย้อนหลังได้
            ActivityLog::create([
                'company_id' => null,
                'user_id' => null,
                'user_name' => $request->login,
                'user_email' => null,
                'method' => 'POST',
                'path' => 'api/login',
                'action' => 'เข้าสู่ระบบไม่สำเร็จ (ชื่อผู้ใช้งาน/รหัสผ่านไม่ถูกต้อง)',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
            return response()->json([
                'message' => 'ชื่อผู้ใช้งาน อีเมล หรือรหัสผ่านไม่ถูกต้อง'
            ], 401);
        }

        $user = $request->user();

        // 🛡️ บริษัทที่ยังไม่ได้รับอนุมัติจาก Platform Admin (โหมด "รออนุมัติ" — ดู
        // RegisterCompanyController::register()/SystemSetting 'require_company_approval') ห้าม login
        // ได้เลยจนกว่าจะอนุมัติ — is_platform_admin ไม่ผูกกับบริษัทไหนเป็นพิเศษ (company_id=1/HQ ที่
        // is_approved=true อยู่แล้วโดย default) จึงไม่ติดเงื่อนไขนี้อยู่แล้วตามธรรมชาติ ไม่ต้อง exempt เพิ่ม
        if ($user->company && !$user->company->is_approved) {
            ActivityLog::create([
                'company_id' => $user->company_id,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_email' => $user->email,
                'method' => 'POST',
                'path' => 'api/login',
                'action' => 'เข้าสู่ระบบไม่สำเร็จ (บริษัทยังรออนุมัติจาก Platform Admin)',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
            return response()->json([
                'message' => 'บริษัทของท่านยังไม่ได้รับการอนุมัติจาก Platform Admin กรุณารอการติดต่อกลับ',
            ], 403);
        }

        // 🛡️ บัญชีที่ถูกระงับ (is_active=false) ห้ามล็อกอินได้เด็ดขาด — เดิมไม่มีการเช็คจุดนี้เลยทั้งระบบ
        // ทำให้ user ที่ถูก admin กด "ระงับการใช้งาน" ยัง login และใช้งานได้ตามปกติ (ดู ResolveActiveCompany
        // middleware ที่เช็คซ้ำอีกชั้นสำหรับ session ที่ login ค้างอยู่ก่อนโดนระงับด้วย — จุดนี้กันแค่ login ใหม่)
        if (!$user->is_active) {
            ActivityLog::create([
                'company_id' => $user->company_id,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_email' => $user->email,
                'method' => 'POST',
                'path' => 'api/login',
                'action' => 'เข้าสู่ระบบไม่สำเร็จ (บัญชีถูกระงับการใช้งาน)',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
            return response()->json([
                'message' => 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้พัฒนา Software',
            ], 403);
        }

        // 🚀 อนุญาตให้ล็อกอินได้พร้อมกันหลายอุปกรณ์/แท็บ (เดิมลบ token เก่าทั้งหมดทุกครั้งที่ล็อกอิน
        // ทำให้ล็อกอินจากที่ไหนก็เตะ session อื่นของบัญชีเดียวกันออกทันที) — กันตาราง token โตไม่จำกัด
        // จากคนที่ล็อกอินซ้ำๆ ไม่เคย logout โดยเก็บไว้แค่ 9 ตัวล่าสุด (รวมตัวใหม่ที่กำลังจะสร้าง = 10)
        $existingTokenIds = $user->tokens()->orderByDesc('created_at')->pluck('id');
        if ($existingTokenIds->count() >= 10) {
            $user->tokens()->whereIn('id', $existingTokenIds->slice(9))->delete();
        }

        $newToken = $user->createToken('stplus_auth_token');
        $token = $newToken->plainTextToken;

        // Establish which company this brand-new token starts in (home company, or
        // whichever is still granted) so the login response already carries the right
        // active_company_id / roles / permissions — no extra round trip needed.
        $activeCompanyId = $this->companyAccess->resolveActiveCompanyId($user, $newToken->accessToken->id);
        if ($activeCompanyId === null) {
            $newToken->accessToken->delete();
            return response()->json([
                'message' => 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานบริษัทใดเลย กรุณาติดต่อผู้ดูแลระบบ',
            ], 403);
        }
        $user->company_id = $activeCompanyId;
        app(\Spatie\Permission\PermissionRegistrar::class)->setPermissionsTeamId($activeCompanyId);

        ActivityLog::create([
            'company_id' => $activeCompanyId,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'user_email' => $user->email,
            'method' => 'POST',
            'path' => 'api/login',
            'action' => 'เข้าสู่ระบบ',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json($this->formatter->format($user, $token));
    }

    public function me(Request $request)
    {
        // ResolveActiveCompany middleware has already resolved $request->user()->company_id
        // to the active company for this token by the time this runs.
        return response()->json($this->formatter->format($request->user()));
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        // 🕵️ ต้องบันทึกก่อนลบ token เพราะหลังจากนี้ auth context ของ request นี้จะใช้ไม่ได้แล้ว
        ActivityLog::create([
            'company_id' => $user->company_id,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'user_email' => $user->email,
            'method' => 'POST',
            'path' => 'api/logout',
            'action' => 'ออกจากระบบ',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        $user->currentAccessToken()->delete();
        return response()->json(['message' => 'ออกจากระบบเรียบร้อยแล้ว']);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['login' => 'required']);

        $discordUrl = env('DISCORD_WEBHOOK_URL');
        if ($discordUrl) {
            // 🛡️ Discord เป็นแค่ช่องทางแจ้งเตือนเสริม ไม่ควรทำให้ทั้ง flow ลืมรหัสผ่านล่มถ้า webhook เข้าไม่ถึง/timeout
            // เดิมไม่มี try/catch หรือ timeout เลย ทำให้ exception หลุดออกไปก่อนถึงโค้ดแจ้งเตือนแอดมินในระบบด้านล่าง
            try {
                $message = "🚨 **แจ้งลืมรหัสผ่าน (ST PLUS ERP)**\nพนักงาน/ผู้ใช้: `{$request->login}`\nกรุณาตรวจสอบและรีเซ็ตรหัสผ่านในระบบหลังบ้านให้ด้วยครับ";
                Http::timeout(5)->post($discordUrl, ['content' => $message]);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('แจ้งเตือน Discord ลืมรหัสผ่านไม่สำเร็จ: ' . $e->getMessage());
            }
        }

        // 🚀 หา user ที่ขอรีเซ็ตก่อน เพื่อแจ้งเตือนแอดมิน "บริษัทเดียวกัน" กับเขา (เดิมแจ้งแต่แอดมินบริษัท 1 ไม่ว่า user จะเป็นของบริษัทไหน)
        $requester = User::where('username', $request->login)->orWhere('email', $request->login)->first();

        $admins = User::whereHas('roles', function ($query) {
            $query->where('is_company_admin', true);
        })
            ->when($requester, fn($q) => $q->where('company_id', $requester->company_id))
            ->get();

        if ($admins->isEmpty()) {
            $admins = User::where('id', 1)->get();
        }

        if ($admins->count() > 0) {
            Notification::send($admins, new PasswordResetNotification($request->login));
        }

        return response()->json(['message' => 'ส่งคำขอรีเซ็ตรหัสผ่านเรียบร้อยแล้ว']);
    }
}
