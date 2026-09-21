<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CompanyAccessService;
use App\Services\UserSessionFormatter;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;

class SwitchCompanyController extends Controller
{
    public function switch(
        Request $request,
        CompanyAccessService $companyAccess,
        UserSessionFormatter $formatter
    ) {
        $request->validate([
            'company_id' => 'required|integer|exists:companies,id',
        ]);

        $user = $request->user();
        $tokenId = $user->currentAccessToken()?->id;

        if (!$tokenId) {
            return response()->json(['message' => 'ไม่พบ session ปัจจุบัน'], 401);
        }

        // Always re-validated against company_user (or is_platform_admin) inside the
        // service — the client-supplied company_id is never trusted on its own.
        $switched = $companyAccess->switchTo($user, $tokenId, (int) $request->company_id);

        if (!$switched) {
            return response()->json([
                'message' => 'คุณไม่มีสิทธิ์เข้าใช้งานบริษัทนี้',
            ], 403);
        }

        // ResolveActiveCompany already ran for this request with the OLD active company
        // (this route sits behind auth:sanctum like every other), so re-point everything
        // at the NEW one before formatting the response.
        $newCompanyId = (int) $request->company_id;
        $user->company_id = $newCompanyId;
        app(PermissionRegistrar::class)->setPermissionsTeamId($newCompanyId);
        $user->unsetRelation('roles');

        return response()->json($formatter->format($user));
    }
}
