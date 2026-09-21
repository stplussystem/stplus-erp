<?php

namespace Tests\Feature\MultiCompany;

class SwitchCompanyEndpointTest extends MultiCompanyTestCase
{
    private function tokenFor($user): string
    {
        return $user->createToken('test_token')->plainTextToken;
    }

    public function test_switch_company_succeeds_for_a_granted_company(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $user = $this->makeUser($companyA);
        $this->grantAccess($user, $companyB);

        $token = $this->tokenFor($user);

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/switch-company', ['company_id' => $companyB->id]);

        $response->assertStatus(200);
        $response->assertJsonPath('user.active_company_id', $companyB->id);
    }

    public function test_switch_company_rejects_a_company_the_user_was_never_granted(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        // Note: no grantAccess() call — user only has their home company (A).
        $user = $this->makeUser($companyA);

        $token = $this->tokenFor($user);

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/switch-company', ['company_id' => $companyB->id]);

        $response->assertStatus(403);
    }

    public function test_switch_company_rejects_a_nonexistent_company_id(): void
    {
        $companyA = $this->makeCompany('Company A');
        $user = $this->makeUser($companyA);

        $token = $this->tokenFor($user);

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/switch-company', ['company_id' => 999999]);

        $response->assertStatus(422);
    }

    /**
     * Regression lock: an earlier draft of resolveActiveCompanyId() re-resolved from the
     * user's home company on every request instead of honoring what was already recorded
     * for the token, so a switch would silently revert on the very next request.
     */
    public function test_switch_persists_across_separate_requests(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $user = $this->makeUser($companyA);
        $this->grantAccess($user, $companyB);
        $token = $this->tokenFor($user);

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/switch-company', ['company_id' => $companyB->id])
            ->assertStatus(200);

        $me = $this->withHeader('Authorization', "Bearer $token")->getJson('/api/me');

        $me->assertStatus(200);
        $me->assertJsonPath('user.active_company_id', $companyB->id);
    }

    /**
     * Regression lock: platform admins were special-cased to always resolve back to their
     * home company, so switching companies had no lasting effect for them specifically.
     */
    public function test_platform_admin_switch_also_persists_across_separate_requests(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $admin = $this->makeUser($companyA, ['is_platform_admin' => true]);
        $token = $this->tokenFor($admin);

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/switch-company', ['company_id' => $companyB->id])
            ->assertStatus(200);

        $me = $this->withHeader('Authorization', "Bearer $token")->getJson('/api/me');

        $me->assertStatus(200);
        $me->assertJsonPath('user.active_company_id', $companyB->id);
    }

    /**
     * Regression lock, at the service layer: active company is tracked per Sanctum token,
     * not per user, so switching in one tab/device must never affect another already-open
     * session for the same user. Exercised at the service layer rather than via two
     * sequential HTTP test calls — Laravel's sanctum guard caches the resolved user across
     * postJson()/getJson() calls made within a single test method (unlike real separate
     * HTTP requests, which each authenticate fresh), so a second HTTP call here wouldn't
     * actually prove per-token isolation; this does, against the same real code path.
     */
    public function test_switching_one_token_does_not_affect_another_token_of_the_same_user(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $user = $this->makeUser($companyA);
        $this->grantAccess($user, $companyB);

        $tokenTabOneId = $user->createToken('tab_one')->accessToken->id;
        $tokenTabTwoId = $user->createToken('tab_two')->accessToken->id;

        $service = app(\App\Services\CompanyAccessService::class);
        $this->assertTrue($service->switchTo($user, $tokenTabOneId, $companyB->id));

        $resolvedForTabTwo = $service->resolveActiveCompanyId($user, $tokenTabTwoId);

        $this->assertSame($companyA->id, $resolvedForTabTwo);
    }
}
