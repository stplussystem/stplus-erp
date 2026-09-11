<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyAccessLog;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Grants/revokes a user's access to additional companies. Deliberately gated by a
 * hardcoded is_platform_admin check rather than a Spatie permission: granting cross-
 * tenant access requires authority over BOTH companies involved, which a company-level
 * admin never has — so this can't be a permission a company admin could hand out.
 */
class CompanyAccessController extends Controller
{
    public function index(Request $request, User $user)
    {
        $this->authorizePlatformAdmin($request);

        return response()->json([
            'data' => $user->companies()->select('companies.id', 'companies.name', 'companies.logo')->orderBy('companies.name')->get(),
        ]);
    }

    public function store(Request $request, User $user)
    {
        $this->authorizePlatformAdmin($request);

        $validated = $request->validate([
            'company_id' => 'required|integer|exists:companies,id',
        ]);

        $companyId = (int) $validated['company_id'];

        if (!$user->companies()->where('companies.id', $companyId)->exists()) {
            $user->companies()->attach($companyId, ['granted_by' => $request->user()->id]);

            CompanyAccessLog::create([
                'user_id' => $user->id,
                'company_id' => $companyId,
                'action' => 'granted',
                'actor_id' => $request->user()->id,
                'created_at' => now(),
            ]);
        }

        return response()->json([
            'data' => $user->companies()->select('companies.id', 'companies.name', 'companies.logo')->orderBy('companies.name')->get(),
        ], 201);
    }

    public function destroy(Request $request, User $user, Company $company)
    {
        $this->authorizePlatformAdmin($request);

        if ($user->companies()->count() <= 1) {
            return response()->json([
                'message' => 'ไม่สามารถถอดสิทธิ์บริษัทสุดท้ายของผู้ใช้ได้ ผู้ใช้ต้องมีอย่างน้อย 1 บริษัทเสมอ',
            ], 422);
        }

        $user->companies()->detach($company->id);

        CompanyAccessLog::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'action' => 'revoked',
            'actor_id' => $request->user()->id,
            'created_at' => now(),
        ]);

        return response()->json([
            'data' => $user->companies()->select('companies.id', 'companies.name', 'companies.logo')->orderBy('companies.name')->get(),
        ]);
    }

    private function authorizePlatformAdmin(Request $request): void
    {
        abort_unless((bool) $request->user()->is_platform_admin, 403, 'เฉพาะ Super Admin ของระบบเท่านั้นที่มอบสิทธิ์เข้าหลายบริษัทได้');
    }
}
