<?php

namespace App\Services;

use App\Models\User;

/**
 * Builds the {user, access_token?} payload returned by /login, /me, and /switch-company.
 * Extracted out of AuthController so the switch-company endpoint can reuse the exact same
 * roles/permissions/menus computation instead of duplicating it.
 */
class UserSessionFormatter
{
    public function __construct(private CompanyAccessService $companyAccess)
    {
    }

    public function format(User $user, ?string $token = null): array
    {
        $isSuperAdmin = $user->isCompanyAdmin();

        // เสกพลังสิทธิ์: ถ้าเป็น Platform Admin หรือ Super Admin ให้ดึงสิทธิ์ทั้งหมดในระบบไปเลย!
        if ($user->is_platform_admin || $isSuperAdmin) {
            $allPermissions = \Spatie\Permission\Models\Permission::all();
        } else {
            // พนักงานแผนกธรรมดา ดึงตามสิทธิ์ที่ติ๊กเลือกไว้ในฐานข้อมูล (สโคปตามบริษัทที่ active อยู่ ผ่าน Spatie teams)
            $allPermissions = $user->getAllPermissions();
        }

        $permissionNames = $allPermissions->pluck('name');
        $roleNames = $user->roles->pluck('name');

        $menus = $allPermissions->where('is_menu', true)
            ->sortBy('sort_order')
            ->groupBy('group')
            ->map(function ($items, $group) {
                $groupIcon = $items->whereNotNull('icon')->first()->icon ?? 'FolderKey';
                return [
                    'group' => $group,
                    'icon' => $groupIcon,
                    'items' => $items->map(fn ($item) => [
                        'name' => $item->name,
                        'title' => $item->title_th,
                        'path' => $item->path,
                    ])->values()->toArray(),
                ];
            })->values()->toArray();

        $companies = $this->companyAccess->companiesFor($user);

        $response = [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar' => $user->avatar ?? null,
                'signature_base64' => $user->signature_base64,
                'is_platform_admin' => (bool) $user->is_platform_admin,
                'roles' => $roleNames,
                'permissions' => $permissionNames,
                'menus' => $menus,
                'companies' => $companies->map(fn ($c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'logo' => $c->logo,
                ])->values(),
                'active_company_id' => $user->company_id,
            ],
        ];

        if ($token) {
            $response['access_token'] = $token;
            $response['token_type'] = 'Bearer';
        }

        return $response;
    }
}
