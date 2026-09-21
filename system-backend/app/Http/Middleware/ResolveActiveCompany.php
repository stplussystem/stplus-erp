<?php

namespace App\Http\Middleware;

use App\Services\CompanyAccessService;
use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;

/**
 * Resolves which company the current Sanctum token is "active" in and overrides
 * $user->company_id with it for the lifetime of this request only (never persisted).
 *
 * Every existing tenant-scoping check in the app — BelongsToCompany's global scope and
 * every controller's manual "$currentUser->company_id" comparison — reads this exact
 * property, so overriding it here is the single choke point that makes the rest of the
 * app correctly scoped to whichever company the user is currently working in, without
 * requiring any change to those existing call sites.
 */
class ResolveActiveCompany
{
    public function __construct(private CompanyAccessService $companyAccess)
    {
    }

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        // 🛡️ บัญชีที่ถูกระงับระหว่างที่ login ค้างอยู่แล้ว (มี token ใช้งานได้อยู่ก่อน) ต้องถูกตัดสิทธิ์ทันทีใน
        // คำขอถัดไป ไม่ใช่รอจน token หมดอายุ/logout เอง — ใช้ 401 (ไม่ใช่ 403 แบบ no_company_access ด้านล่าง)
        // เจตนา เพราะ AppLayout.tsx (fetchAndApplyUserData) มี auto-logout ผูกกับสถานะ 401 อยู่แล้วจากโค้ดเดิม
        // (เดิมทำไว้ดัก token ถูกเพิกถอน) ทำให้ user ถูกเตะออกจากระบบอัตโนมัติในรอบรีเฟรชสิทธิ์ถัดไปโดยไม่ต้อง
        // เขียนกลไก frontend ใหม่เลย
        if (!$user->is_active) {
            return response()->json([
                'message' => 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้พัฒนา Software',
                'error_code' => 'account_suspended',
            ], 401);
        }

        $tokenId = $user->currentAccessToken()?->id;
        $companyId = $this->companyAccess->resolveActiveCompanyId($user, $tokenId);

        if ($companyId === null) {
            return response()->json([
                'message' => 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานบริษัทใดเลย กรุณาติดต่อผู้ดูแลระบบ',
                'error_code' => 'no_company_access',
            ], 403);
        }

        $user->company_id = $companyId;

        app(PermissionRegistrar::class)->setPermissionsTeamId($companyId);

        return $next($request);
    }
}
