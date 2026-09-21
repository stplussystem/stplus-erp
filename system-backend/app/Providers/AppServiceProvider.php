<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Gate;
use Illuminate\Auth\Middleware\Authenticate;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 💡 2. กฎระดับพระเจ้า: Platform Admin (เจ้าของระบบ, company 1) ทำได้ทุกอย่างข้ามทุกบริษัท (Bypass Permission)
        // เดิมเช็คจากชื่อ role ตรงตัว 'Super Admin' ซึ่งมีแค่บริษัท 1 เท่านั้นที่ตรง ทำให้ tenant อื่นไม่เคยได้ God Mode ทางนี้เลย
        // (แต่ tenant admin ก็ยังทำงานได้ปกติเพราะมี syncPermissions(Permission::all()) ให้ตอนสร้างบริษัทอยู่แล้ว)
        // เปลี่ยนมาใช้ is_platform_admin ตรงๆ ซึ่งเป็น flag ที่ถูกต้องแล้วสำหรับสิทธิ์ข้ามบริษัทโดยเฉพาะ
        Gate::before(function ($user, $ability) {
            return $user->is_platform_admin ? true : null;
        });

        // 💡 ระบบนี้เป็น API-only ไม่มี route ชื่อ 'login' เลย — ถ้าปล่อยให้ Laravel
        // พยายาม redirect ไปหน้า login ตอน token หมดอายุ/ไม่ถูกต้อง จะพังด้วย
        // RouteNotFoundException (Route [login] not defined) แทนที่จะตอบ 401 ปกติ
        // สั่งไม่ให้ redirect เลย ปล่อยให้ AuthenticationException โยนแบบไม่มี URL แนบไป
        Authenticate::redirectUsing(fn () => null);
    }
}
