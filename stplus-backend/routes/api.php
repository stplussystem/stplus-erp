<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\MasterDataController;
use App\Http\Controllers\Api\ProductExcelController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\ProductSerialController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\PermissionController;

// ========================================================
// 🟢 โซนปลอดภัย (Public Routes) - ไม่ต้องใช้ Token
// ========================================================
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);

// ========================================================
// 🔴 โซนหวงห้าม (Protected Routes) - ต้องมี Token ถึงจะเข้าได้
// ========================================================
Route::middleware('auth:sanctum')->group(function () {

    // 👤 User Management
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);
    Route::get('/permissions', [PermissionController::class, 'index']);
    Route::post('/permissions', [PermissionController::class, 'store']);

    // ดึงรายการ Role ทั้งหมดไปโชว์ใน Dropdown
    Route::get('/roles', function () {
        return response()->json(\Spatie\Permission\Models\Role::all());
    });

    // 🔔 ระบบแจ้งเตือน (Notifications)
    Route::get('/notifications/unread', [NotificationController::class, 'unread']);
    Route::post('/notifications/mark-read', [NotificationController::class, 'markAllAsRead']);

    // 👤 ระบบ User & Auth
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // --------------------------------------------------------
    // 📦 เส้นทาง Excel (Export/Template/Import) ไว้ด้านบน!
    // --------------------------------------------------------
    Route::get('/products/export', [ProductExcelController::class, 'export']);
    Route::get('/products/template', [ProductExcelController::class, 'template']);
    Route::post('/products/import', [ProductExcelController::class, 'import']);

    // --------------------------------------------------------
    // 🛒 เส้นทางจัดการสินค้า (Resource)
    // --------------------------------------------------------
    Route::apiResource('products', ProductController::class);

    // ⚙️ เส้นทาง Master Data (ตัวเลือกต่างๆ)
    Route::get('/product-options', [MasterDataController::class, 'getProductOptions']);
    Route::post('/master-data', [MasterDataController::class, 'store']);

    // 🔄 เส้นทางสำหรับบันทึก รับเข้า/เบิกออก สต็อก
    Route::post('/stock-movements', [StockMovementController::class, 'store']);
    Route::get('/product-serials/check', [ProductSerialController::class, 'check']);
});
