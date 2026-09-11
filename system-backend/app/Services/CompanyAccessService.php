<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyAccessLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

/**
 * Single place that knows the rules for multi-company access: which companies a user
 * may use, and which one a given Sanctum token is currently "active" in. Used by
 * ResolveActiveCompany (per-request resolution), AuthController (login/me payloads),
 * and SwitchCompanyController (explicit switch).
 */
class CompanyAccessService
{
    public function companiesFor(User $user): Collection
    {
        if ($user->is_platform_admin) {
            return Company::query()->select('id', 'name', 'logo')->orderBy('name')->get();
        }

        return $user->companies()->select('companies.id', 'companies.name', 'companies.logo')->orderBy('companies.name')->get();
    }

    public function hasAccess(User $user, int $companyId): bool
    {
        return $user->hasAccessToCompany($companyId);
    }

    /**
     * Resolve the active company for a token, persisting a fallback if none is set yet
     * (or the previously-set one is no longer granted). Returns null only if the user
     * has no access to any company at all.
     *
     * Platform admins are NOT special-cased to always resolve to their home company here
     * — hasAccess() already grants them access to every company unconditionally, so a
     * platform admin's explicit switch (recorded in token_active_company, same as any
     * other user) is honored and persists across requests instead of snapping back to
     * their home company every time.
     */
    public function resolveActiveCompanyId(User $user, ?int $tokenId): ?int
    {
        $active = $tokenId
            ? DB::table('token_active_company')->where('token_id', $tokenId)->value('company_id')
            : null;

        if ($active !== null && $this->hasAccess($user, (int) $active)) {
            return (int) $active;
        }

        $fallback = $this->hasAccess($user, (int) $user->company_id)
            ? (int) $user->company_id
            : DB::table('company_user')->where('user_id', $user->id)->value('company_id');

        // A platform admin's own company_user row is normally present too (seeded from
        // their home company), but fall back to any existing company as a last resort
        // since they have implicit access everywhere regardless of that pivot table.
        if ($fallback === null && $user->is_platform_admin) {
            $fallback = Company::query()->value('id');
        }

        if ($fallback !== null && $tokenId) {
            $this->setActiveCompany($tokenId, (int) $fallback);
        }

        return $fallback !== null ? (int) $fallback : null;
    }

    public function setActiveCompany(int $tokenId, int $companyId): void
    {
        DB::table('token_active_company')->updateOrInsert(
            ['token_id' => $tokenId],
            ['company_id' => $companyId, 'updated_at' => now(), 'created_at' => now()]
        );
    }

    /**
     * Explicit switch requested by the user. Always re-validates against company_user
     * (or is_platform_admin) — never trusts the caller. Returns false if not granted.
     */
    public function switchTo(User $user, int $tokenId, int $companyId): bool
    {
        if (!$this->hasAccess($user, $companyId)) {
            return false;
        }

        $this->setActiveCompany($tokenId, $companyId);

        CompanyAccessLog::create([
            'user_id' => $user->id,
            'company_id' => $companyId,
            'action' => 'switched',
            'actor_id' => $user->id,
            'created_at' => now(),
        ]);

        return true;
    }
}
