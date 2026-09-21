<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Auth\AuthenticationException; // 💡 ดึง Class จัดการ Error ล็อกอินมาใช้

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);
        $middleware->statefulApi();

        // 🚀 เพิ่ม Alias ให้ Laravel 12 รู้จักคำว่า permission และ role
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {

        // 💡 พระเอกของเราอยู่ตรงนี้ครับ! ดัก Error ว่าถ้ายังไม่ได้ล็อกอิน ให้ส่ง 401 กลับไปแทนการแครช
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'เซสชั่นหมดอายุ หรือยังไม่ได้ล็อกอิน กรุณาล็อกอินใหม่อีกครั้ง'
                ], 401);
            }
        });
    })->create();
