<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\MasterDataController;
use App\Http\Controllers\Api\ProductExcelController;
use App\Http\Controllers\Api\StockMovementController;

// --------------------------------------------------------
// เส้นทาง Excel (Export/Template/Import) ไว้ด้านบน!
// --------------------------------------------------------
Route::get('/products/export', [ProductExcelController::class, 'export']);
Route::get('/products/template', [ProductExcelController::class, 'template']);
Route::post('/products/import', [ProductExcelController::class, 'import']);

// --------------------------------------------------------
// ให้เส้นทาง Resource อยู่ด้านล่างครับ
// --------------------------------------------------------
Route::apiResource('products', ProductController::class);

Route::get('/product-options', [MasterDataController::class, 'getProductOptions']);
Route::post('/master-data', [MasterDataController::class, 'store']);

// เส้นทางสำหรับบันทึก รับเข้า/เบิกออก สต็อก
Route::post('/stock-movements', [StockMovementController::class, 'store']);
