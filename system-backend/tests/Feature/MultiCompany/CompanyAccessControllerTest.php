<?php

namespace Tests\Feature\MultiCompany;

class CompanyAccessControllerTest extends MultiCompanyTestCase
{
    private function tokenFor($user): string
    {
        return $user->createToken('test_token')->plainTextToken;
    }

    public function test_platform_admin_can_grant_company_access(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $admin = $this->makeUser($companyA, ['is_platform_admin' => true]);
        $target = $this->makeUser($companyA);

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->tokenFor($admin))
            ->postJson("/api/users/{$target->id}/companies", ['company_id' => $companyB->id]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('company_user', [
            'user_id' => $target->id,
            'company_id' => $companyB->id,
        ]);
        $this->assertDatabaseHas('company_access_logs', [
            'user_id' => $target->id,
            'company_id' => $companyB->id,
            'action' => 'granted',
            'actor_id' => $admin->id,
        ]);
    }

    public function test_non_platform_admin_cannot_grant_company_access(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $notAdmin = $this->makeUser($companyA);
        $target = $this->makeUser($companyA);

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->tokenFor($notAdmin))
            ->postJson("/api/users/{$target->id}/companies", ['company_id' => $companyB->id]);

        $response->assertStatus(403);
        $this->assertDatabaseMissing('company_user', [
            'user_id' => $target->id,
            'company_id' => $companyB->id,
        ]);
    }

    public function test_non_platform_admin_cannot_list_or_revoke_company_access(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $notAdmin = $this->makeUser($companyA);
        $target = $this->makeUser($companyA);
        $this->grantAccess($target, $companyB);
        $token = 'Bearer ' . $this->tokenFor($notAdmin);

        $this->withHeader('Authorization', $token)
            ->getJson("/api/users/{$target->id}/companies")
            ->assertStatus(403);

        $this->withHeader('Authorization', $token)
            ->deleteJson("/api/users/{$target->id}/companies/{$companyB->id}")
            ->assertStatus(403);
    }

    public function test_platform_admin_can_revoke_a_non_last_company(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $admin = $this->makeUser($companyA, ['is_platform_admin' => true]);
        $target = $this->makeUser($companyA);
        $this->grantAccess($target, $companyB);

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->tokenFor($admin))
            ->deleteJson("/api/users/{$target->id}/companies/{$companyB->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('company_user', [
            'user_id' => $target->id,
            'company_id' => $companyB->id,
        ]);
        $this->assertDatabaseHas('company_access_logs', [
            'user_id' => $target->id,
            'company_id' => $companyB->id,
            'action' => 'revoked',
        ]);
    }

    public function test_cannot_revoke_the_users_last_remaining_company(): void
    {
        $companyA = $this->makeCompany('Company A');
        $admin = $this->makeUser($companyA, ['is_platform_admin' => true]);
        $target = $this->makeUser($companyA); // only ever granted company A

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->tokenFor($admin))
            ->deleteJson("/api/users/{$target->id}/companies/{$companyA->id}");

        $response->assertStatus(422);
        $this->assertDatabaseHas('company_user', [
            'user_id' => $target->id,
            'company_id' => $companyA->id,
        ]);
    }
}
