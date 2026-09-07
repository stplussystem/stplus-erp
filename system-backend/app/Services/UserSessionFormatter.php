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

        // 🛡️ กันเมนูพังทั้งหน้า (Link href=null → runtime error) ถ้ามีคนติ๊ก is_menu=true ไว้แต่ลืมกรอก path
        // ในหน้า /permissions (เคยเกิดจริง เช่น permission "service" ที่สร้างใหม่แล้วไม่ได้กรอก path)
        $menus = $allPermissions->where('is_menu', true)
            ->filter(fn ($item) => !empty($item->path))
            ->sortBy('sort_order')
            ->groupBy('group')
            ->map(function ($items, $group) {
                $groupIcon = $items->whereNotNull('icon')->first()->icon ?? 'FolderKey';
                $toItem = fn ($item) => [
                    'name' => $item->name,
                    'title' => $item->title_th,
                    'path' => $item->path,
                    'icon' => $item->icon,
                ];

                // 🚀 เมนูชั้นที่ 3: permission ที่มี sub_group (เช่นกลุ่ม "รายงาน" ที่แตกเป็น
                // ขาย/จัดซื้อ/คลังสินค้า/... — ดู ReportsMenuSeeder.php) ถูกจัดเป็น sub_groups แยกจาก
                // items แบนปกติ กลุ่มอื่นที่ไม่มีใครตั้ง sub_group เลยจะไม่มี key นี้ส่งไปเลย (คงพฤติกรรม
                // เดิม 100% ให้ frontend ที่ยังไม่รองรับ sub_groups เรนเดอร์เหมือนเดิมทุกอย่าง)
                // "ทั่วไป" ไม่นับเป็น sub_group จริง — เป็นค่าที่ถูกตั้งไว้ก่อนหน้าเพื่อจัดกลุ่มการ์ดสิทธิ์
                // ในหน้า /permissions เท่านั้น (ไม่ได้ตั้งใจให้กลายเป็นเมนูย่อยในแถบข้าง/บน) เช่นกลุ่ม "ขาย"
                // ที่ permission เกือบทั้งหมดมี sub_group="ทั่วไป" ติดมา ทำให้กลายเป็น dropdown ซ้อนโดยไม่มี
                // เหตุผล ทั้งที่กลุ่มนั้นไม่ได้แตกหมวดหมู่ย่อยจริงๆ — เลยตัด "ทั่วไป" ออกจากการพิจารณาตรงนี้
                // ให้ item ที่ติด sub_group="ทั่วไป" กลับไปเป็น item แบนปกติเสมอ
                [$withSubGroup, $withoutSubGroup] = $items->partition(
                    fn ($item) => !empty($item->sub_group) && $item->sub_group !== 'ทั่วไป',
                );

                $result = [
                    'group' => $group,
                    'icon' => $groupIcon,
                    'items' => $withoutSubGroup->map($toItem)->values()->toArray(),
                ];

                if ($withSubGroup->isNotEmpty()) {
                    $result['sub_groups'] = $withSubGroup
                        ->groupBy('sub_group')
                        ->map(function ($subItems, $subGroupName) use ($toItem) {
                            return [
                                'name' => $subGroupName,
                                'icon' => $subItems->whereNotNull('icon')->first()->icon ?? null,
                                'items' => $subItems->map($toItem)->values()->toArray(),
                            ];
                        })->values()->toArray();
                }

                // 🚀 ยุบ sub_group เดี่ยว: กลุ่มที่ไม่มี item แบนเหลือเลย (items ว่าง) แต่ทุก item ถูกตั้ง
                // sub_group เดียวกันหมด (เช่น "จัดซื้อ" ที่ทั้ง 3 permission ถูกตั้ง sub_group="ทั่วไป" ไว้
                // ในฐานข้อมูลเดิม) ไม่ควรบังคับให้กดเมนู 2 ชั้นเพื่อเจอสิ่งที่จริงๆ เป็นแค่รายการแบนธรรมดา
                // — ย้าย items ของ sub_group เดียวนั้นมาแทนที่ items แบนตรงๆ แล้วตัด sub_groups ทิ้ง
                // (กลุ่มที่มีทั้ง item แบนปนอยู่ด้วย เช่น "คลังสินค้า" หรือมีหลาย sub_group เช่น "รายงาน"
                // จะไม่เข้าเงื่อนไขนี้ ไม่กระทบพฤติกรรมปัจจุบันของทั้ง 2 กลุ่มนั้นเลย)
                if (empty($result['items']) && count($result['sub_groups'] ?? []) === 1) {
                    $result['items'] = $result['sub_groups'][0]['items'];
                    unset($result['sub_groups']);
                }

                return $result;
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
