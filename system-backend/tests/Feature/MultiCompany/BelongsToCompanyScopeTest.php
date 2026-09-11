<?php

namespace Tests\Feature\MultiCompany;

use App\Models\Warehouse;
use Spatie\Permission\PermissionRegistrar;

/**
 * Exercises the exact mechanism ResolveActiveCompany relies on: overriding
 * $user->company_id in memory and pointing the Spatie team context at it. If the
 * BelongsToCompany global scope ever stopped reading that overridden value (e.g. a future
 * refactor reads a cached/original company_id instead), this is what would catch it —
 * this is the single biggest cross-tenant data leakage risk the whole feature introduces.
 */
class BelongsToCompanyScopeTest extends MultiCompanyTestCase
{
    private function actAsInCompany($user, $companyId): void
    {
        $this->actingAs($user);
        $user->company_id = $companyId;
        app(PermissionRegistrar::class)->setPermissionsTeamId($companyId);
    }

    public function test_user_only_sees_their_active_companys_warehouses(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $user = $this->makeUser($companyA);
        $this->grantAccess($user, $companyB);

        $this->actAsInCompany($user, $companyA->id);
        Warehouse::create(['name' => 'Warehouse in A', 'company_id' => $companyA->id]);

        $this->actAsInCompany($user, $companyB->id);
        Warehouse::create(['name' => 'Warehouse in B', 'company_id' => $companyB->id]);

        $this->actAsInCompany($user, $companyA->id);
        $names = Warehouse::all()->pluck('name');
        $this->assertEquals(['Warehouse in A'], $names->all());

        $this->actAsInCompany($user, $companyB->id);
        $names = Warehouse::all()->pluck('name');
        $this->assertEquals(['Warehouse in B'], $names->all());
    }

    public function test_creating_a_record_auto_stamps_the_currently_active_company(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $user = $this->makeUser($companyA);
        $this->grantAccess($user, $companyB);

        $this->actAsInCompany($user, $companyB->id);
        // Deliberately omit company_id — BelongsToCompany's creating() hook should stamp
        // it from the currently-active company, not the user's original home company.
        $warehouse = Warehouse::create(['name' => 'Auto-stamped Warehouse']);

        $this->assertEquals($companyB->id, $warehouse->company_id);
    }
}
