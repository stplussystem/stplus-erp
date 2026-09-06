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
