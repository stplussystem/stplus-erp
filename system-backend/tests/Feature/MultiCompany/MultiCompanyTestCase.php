<?php

namespace Tests\Feature\MultiCompany;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Base class for the multi-company access feature tests. Runs against a dedicated
 * "system_db_test" MariaDB database (see phpunit.xml) — not the dev database, and not
 * SQLite, since this codebase's migration history relies on MySQL/MariaDB-only syntax.
 *
 * Uses DatabaseTransactions (not RefreshDatabase): the schema is migrated into
 * system_db_test once up front (`php artisan test` triggers it automatically the first
 * time RefreshDatabase runs anywhere in the suite); wrapping every test in a transaction
 * that's rolled back afterward is enough for isolation and avoids re-running the full
 * migration chain — including this feature's own non-idempotent ALTER TABLE migration —
 * once per test class.
 */
abstract class MultiCompanyTestCase extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    protected function makeCompany(string $name): Company
    {
        return Company::create(['name' => $name]);
    }

    protected function makeUser(Company $company, array $overrides = []): User
    {
        $user = User::factory()->create(array_merge([
            'company_id' => $company->id,
            'is_active' => true,
        ], $overrides));

        // 🚀 User::booted()'s `created` hook now auto-inserts this row for any new user
        // with a company_id (see app/Models/User.php) — insertOrIgnore stays safe either way.
        \DB::table('company_user')->insertOrIgnore([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'granted_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $user->fresh();
    }

    protected function grantAccess(User $user, Company $company): void
    {
        \DB::table('company_user')->insertOrIgnore([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'granted_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
