<?php

namespace Tests\Feature\MultiCompany;

use Illuminate\Support\Facades\Hash;

class LoginCompanyPayloadTest extends MultiCompanyTestCase
{
    public function test_login_response_includes_single_company_and_no_forced_switch(): void
    {
        $company = $this->makeCompany('Only Company');
        $user = $this->makeUser($company, [
            'username' => 'single_company_user',
            'password' => Hash::make('secret-password'),
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'single_company_user',
            'password' => 'secret-password',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('user.active_company_id', $company->id);
        $response->assertJsonCount(1, 'user.companies');
    }

    public function test_login_response_lists_every_granted_company(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $user = $this->makeUser($companyA, [
            'username' => 'multi_company_user',
            'password' => Hash::make('secret-password'),
        ]);
        $this->grantAccess($user, $companyB);

        $response = $this->postJson('/api/login', [
            'login' => 'multi_company_user',
            'password' => 'secret-password',
        ]);

        $response->assertStatus(200);
        $response->assertJsonCount(2, 'user.companies');
        $ids = collect($response->json('user.companies'))->pluck('id')->sort()->values();
        $this->assertEquals([$companyA->id, $companyB->id], $ids->sort()->values()->all());
    }

    public function test_login_rejects_wrong_password(): void
    {
        $company = $this->makeCompany('Only Company');
        $this->makeUser($company, [
            'username' => 'wrong_pw_user',
            'password' => Hash::make('secret-password'),
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'wrong_pw_user',
            'password' => 'not-the-right-password',
        ]);

        $response->assertStatus(401);
    }
}
