<?php

use Illuminate\Http\Request;
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
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\ContactExcelController;
use App\Http\Controllers\Api\WarehouseController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\RegisterCompanyController;
use App\Http\Controllers\Api\UserExcelController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\ContractorWorkOrderController;
use App\Http\Controllers\Api\GovernmentContractController;
use App\Http\Controllers\Api\GoodsReceiptController;
use App\Http\Controllers\Api\SaleDocumentController;
use App\Http\Controllers\Api\RepairTicketController;
use App\Http\Controllers\Api\InstallationRecordController;
use App\Http\Controllers\Api\InstallationEquipmentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\RentalJobController;
use App\Http\Controllers\Api\StockCheckController;
use App\Http\Controllers\Api\SwitchCompanyController;
use App\Http\Controllers\Api\CompanyAccessController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Middleware\ResolveActiveCompany;
use App\Http\Middleware\LogActivity;

// ========================================================
// 🟢 โซนปลอดภัย (Public Routes) - ไม่ต้องใช้ Token
// ========================================================
// 🛡️ จำกัดจำนวนครั้ง login ผิดต่อ IP กันการเดารหัสผ่านซ้ำๆ (brute-force/credential-stuffing) — เดิมไม่มีการจำกัดเลย
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/register-company', [RegisterCompanyController::class, 'register']);

// ========================================================
// 🔴 โซนหวงห้าม (Protected Routes) - ต้องมี Token ถึงจะเข้าได้
// ========================================================
Route::middleware(['auth:sanctum', ResolveActiveCompany::class, LogActivity::class])->group(function () {

    // --------------------------------------------------------
    // 👤 ข้อมูลโปรไฟล์ส่วนตัว
    // --------------------------------------------------------
    Route::get('/user', function (Request $request) {
        return $request->user()->load('roles', 'permissions');
    });
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/user/change-password', [UserController::class, 'changePassword']);
    Route::post('/user/profile-update', [UserController::class, 'updateProfile']);
    Route::post('/switch-company', [SwitchCompanyController::class, 'switch']);

    // --------------------------------------------------------
    // 🏢 สิทธิ์เข้าใช้งานหลายบริษัท (Multi-Company Access) — Super Admin เท่านั้น
    // --------------------------------------------------------
    Route::get('/users/{user}/companies', [CompanyAccessController::class, 'index']);
    Route::post('/users/{user}/companies', [CompanyAccessController::class, 'store']);
    Route::delete('/users/{user}/companies/{company}', [CompanyAccessController::class, 'destroy']);

    // --------------------------------------------------------
    // 📊 แดชบอร์ด (Dashboard)
    // --------------------------------------------------------
    Route::get('/dashboard/stats', [DashboardController::class, 'index'])->middleware('permission:view_dashboard');

    // --------------------------------------------------------
    // 👥 จัดการผู้ใช้งาน (User Management)
    // --------------------------------------------------------
    Route::get('/users/options', [UserController::class, 'options']);
    Route::get('/users/trashed', [UserController::class, 'trashed'])->middleware('permission:manage_users');
    Route::post('/users/{id}/restore', [UserController::class, 'restore'])->middleware('permission:manage_users');
    Route::delete('/users/{id}/force', [UserController::class, 'forceDelete'])->middleware('permission:manage_users');
    Route::post('/users/restore-batch', [UserController::class, 'restoreBatch'])->middleware('permission:manage_users');
    Route::post('/users/force-batch', [UserController::class, 'forceDeleteBatch'])->middleware('permission:manage_users');
    Route::post('/users/{user}/reset-password', [UserController::class, 'resetUserPassword'])->middleware('permission:manage_users');
    Route::patch('/users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->middleware('permission:manage_users');
    Route::get('/users/excel/template', [UserExcelController::class, 'exportTemplate'])->middleware('permission:manage_users');
    Route::get('/users/excel/export', [UserExcelController::class, 'export'])->middleware('permission:manage_users');
    Route::post('/users/excel/import', [UserExcelController::class, 'import'])->middleware('permission:manage_users');

    Route::get('/users', [UserController::class, 'index'])->middleware('permission:manage_users');
    Route::post('/users', [UserController::class, 'store'])->middleware('permission:manage_users');
    Route::get('/users/{user}', [UserController::class, 'show'])->middleware('permission:manage_users');
    Route::put('/users/{user}', [UserController::class, 'update'])->middleware('permission:manage_users');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('permission:manage_users');

    // --------------------------------------------------------
    // 🛡️ จัดการสิทธิ์, แผนก และ บริษัท
    // --------------------------------------------------------
    // 📖 index (list) เปิดให้ user ที่ถือ manage_roles เข้าถึงได้ด้วย เพราะหน้า "สร้าง/แก้ไข role" ต้อง
    // โหลดรายการ permission มาให้ติ๊กเลือกประกอบ role — ไม่งั้น user ที่มีแค่ manage_roles (ไม่มี manage_permissions)
    // จะเจอ 403 ตอนโหลดหน้าสร้าง role ทันที ทั้งที่ตัวเองไม่จำเป็นต้องเข้าหน้าจัดการสิทธิ์เต็มรูปแบบเลย
    // ส่วน store/update/destroy ยังคง manage_permissions เท่านั้นเหมือนเดิมทุกประการ (ตัวคอนโทรลเลอร์เองก็เช็ค
    // is_platform_admin ซ้ำอีกชั้นอยู่แล้วด้วย)
    Route::get('/permissions', [PermissionController::class, 'index'])->middleware('permission:manage_permissions|manage_roles');
    Route::post('/permissions', [PermissionController::class, 'store'])->middleware('permission:manage_permissions');
    Route::patch('/permissions/group-icon', [PermissionController::class, 'updateGroupIcon'])->middleware('permission:manage_permissions');
    Route::delete('/permissions/group/{group}', [PermissionController::class, 'destroyGroup'])->middleware('permission:manage_permissions');
    Route::put('/permissions/{permission}', [PermissionController::class, 'update'])->middleware('permission:manage_permissions');
    Route::patch('/permissions/{permission}/toggle-active', [PermissionController::class, 'toggleActive'])->middleware('permission:manage_permissions');
    Route::delete('/permissions/{permission}', [PermissionController::class, 'destroy'])->middleware('permission:manage_permissions');
    Route::get('/settings/auto-sync-permissions', [PermissionController::class, 'getAutoSyncSetting']);
    Route::put('/settings/auto-sync-permissions', [PermissionController::class, 'updateAutoSyncSetting']);

    // --------------------------------------------------------
    // 🕵️ Activity Log — ประวัติการใช้งานระบบ (ใครทำอะไร เมื่อไหร่ จาก IP ไหน)
    // --------------------------------------------------------
    Route::get('/logs', [ActivityLogController::class, 'index'])->middleware('permission:view_activity_log');
    Route::apiResource('roles', RoleController::class)->middleware('permission:manage_roles');
    Route::apiResource('departments', DepartmentController::class)->middleware('permission:manage_company');
    Route::get('/companies', [CompanyController::class, 'index'])->middleware('permission:manage_company');
    Route::get('/company', [CompanyController::class, 'show']);
    Route::post('/company', [CompanyController::class, 'update'])->middleware('permission:manage_company');
    // 🖨️ {group} แยกรูปพื้นหลังอ้างอิงตามแท็บ (shared/delivery_note) — เส้นทางไม่มี {group} ยังใช้ได้ (default 'shared') เพื่อ backward-compat
    Route::post('/company/letter-layout-background/{group}/{paperSize}', [CompanyController::class, 'uploadLetterLayoutBackground'])->middleware('permission:manage_company');
    Route::post('/company/letter-layout-background/{group}', [CompanyController::class, 'uploadLetterLayoutBackground'])->middleware('permission:manage_company');
    Route::post('/company/letter-layout-background', [CompanyController::class, 'uploadLetterLayoutBackground'])->middleware('permission:manage_company');
    Route::post('/company/quotation-header-background', [CompanyController::class, 'uploadQuotationHeaderBackground'])->middleware('permission:manage_company');
    // 🖨️ {paperSize} รองรับ A4/Letter/Half Letter แยกรูปพื้นหลังกันคนละชุด — เส้นทางไม่มี {paperSize} ยังใช้ได้ (default 'Letter') เพื่อ backward-compat
    Route::post('/company/print-layout-background/{group}/{paperSize}', [CompanyController::class, 'uploadPrintLayoutBackground'])->middleware('permission:manage_company');
    Route::post('/company/print-layout-background/{group}', [CompanyController::class, 'uploadPrintLayoutBackground'])->middleware('permission:manage_company');
    Route::post('/company/a4-watermark-background', [CompanyController::class, 'uploadA4WatermarkBackground'])->middleware('permission:manage_company');

    // --------------------------------------------------------
    // 🔔 ระบบแจ้งเตือน (Notifications)
    // --------------------------------------------------------
    Route::get('/notifications/unread', [NotificationController::class, 'unread']);
    Route::post('/notifications/mark-read', [NotificationController::class, 'markAllAsRead']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);

    // ========================================================
    // 📦 โซนบริหารคลังสินค้าและผลิตภัณฑ์ (Inventory & Product)
    // ========================================================
    Route::get('/products/excel/export', [ProductExcelController::class, 'export'])->middleware('permission:view_products');
    Route::get('/products/excel/template', [ProductExcelController::class, 'exportTemplate'])->middleware('permission:view_products');
    Route::post('/products/excel/import-master', [ProductExcelController::class, 'importMaster'])->middleware('permission:manage_products');
    Route::post('/products/excel/import-adjust', [ProductExcelController::class, 'importAdjust'])->middleware('permission:bt_InventoryAdjustment');
    Route::get('/products/{id}/available-serials', [ProductController::class, 'availableSerials'])->middleware('permission:view_products');
    Route::get('/products/{id}/reservation-details', [ProductController::class, 'reservationDetails']);
    Route::get('/products/{id}/related', [ProductController::class, 'relatedProducts'])->middleware('permission:view_products');
    Route::put('/products/{id}/related', [ProductController::class, 'syncRelatedProducts'])->middleware('permission:manage_products');
    Route::patch('/products/{product}/toggle-active', [ProductController::class, 'toggleActive'])->middleware('permission:manage_products');
    Route::get('/products/{id}/purchase-history', [PurchaseOrderController::class, 'productPurchaseHistory'])->middleware('permission:view_purchase');
    Route::get('/products/{id}/sales-history', [SaleDocumentController::class, 'productSalesHistory'])->middleware('permission:view_tax_invoice');

    Route::get('/products', [ProductController::class, 'index'])->middleware('permission:view_products');
    Route::post('/products', [ProductController::class, 'store'])->middleware('permission:manage_products');
    Route::get('/products/{product}', [ProductController::class, 'show'])->middleware('permission:view_products');
    Route::put('/products/{product}', [ProductController::class, 'update'])->middleware('permission:manage_products');
    Route::delete('/products/{product}', [ProductController::class, 'destroy'])->middleware('permission:manage_products');

    Route::get('/product-options', [MasterDataController::class, 'getProductOptions'])->middleware('permission:view_products');
    Route::post('/master-data', [MasterDataController::class, 'store'])->middleware('permission:manage_products');

    // ความเคลื่อนไความคลังสินค้า
    Route::get('/stock-movements', [StockMovementController::class, 'index'])->middleware('permission:view_movements');
    Route::get('/stock-movements/export', [StockMovementController::class, 'exportMovements'])->middleware('permission:view_movements');
    Route::get('/stock-movements/{id}', [StockMovementController::class, 'show'])->middleware('permission:view_movements');
    Route::post('/stock-movements', [StockMovementController::class, 'store'])->middleware('permission:menu_stock_in|menu_stock_out');
    Route::post('/stock-movements/batch', [StockMovementController::class, 'storeBatch'])->middleware('permission:menu_stock_in|menu_stock_out');
    Route::get('/product-serials/check', [ProductSerialController::class, 'check'])->middleware('permission:menu_stock_in|menu_stock_out');

    // จัดการสถานที่คลังสินค้า
    Route::get('/warehouses', [WarehouseController::class, 'index'])->middleware('permission:view_products');
    Route::post('/warehouses', [WarehouseController::class, 'store'])->middleware('permission:manage_warehouses');
    Route::get('/warehouses/{warehouse}', [WarehouseController::class, 'show'])->middleware('permission:view_products');
    Route::put('/warehouses/{warehouse}', [WarehouseController::class, 'update'])->middleware('permission:manage_warehouses');
    Route::delete('/warehouses/{warehouse}', [WarehouseController::class, 'destroy'])->middleware('permission:manage_warehouses');

    // ========================================================
    // 🛠️ ทะเบียนสินทรัพย์ถาวรของบริษัท (Fixed Assets — MVP)
    // ========================================================
    Route::get('/assets', [AssetController::class, 'index'])->middleware('permission:manage_assets');
    Route::post('/assets', [AssetController::class, 'store'])->middleware('permission:manage_assets');
    Route::put('/assets/{asset}', [AssetController::class, 'update'])->middleware('permission:manage_assets');
    Route::delete('/assets/{asset}', [AssetController::class, 'destroy'])->middleware('permission:manage_assets');

    // ========================================================
    // 📞 จัดการรายชื่อผู้ติดต่อ (Contacts)
    // ========================================================
    Route::get('/contacts/export', [ContactExcelController::class, 'export'])->middleware('permission:export_contacts');
    Route::get('/contacts/export-template', [ContactExcelController::class, 'exportTemplate'])->middleware('permission:export_contacts');
    Route::post('/contacts/import', [ContactExcelController::class, 'import'])->middleware('permission:import_contacts');
    Route::patch('/contacts/{contact}/toggle-status', [ContactController::class, 'toggleStatus'])->middleware('permission:edit_contacts');
    Route::get('/contacts', [ContactController::class, 'index'])->middleware('permission:view_contacts');
    Route::post('/contacts', [ContactController::class, 'store'])->middleware('permission:create_contacts');
    // Quick-create แบบย่อ สำหรับหน้ารับแจ้งซ่อมเท่านั้น (ตั้งใจใช้สิทธิ์ create_repairs ไม่ใช่ create_contacts เพื่อไม่เปิด permission ใหม่โดยไม่จำเป็น)
    Route::post('/contacts/quick-create', [ContactController::class, 'quickCreate'])->middleware('permission:create_repairs');
    Route::get('/contacts/{contact}', [ContactController::class, 'show'])->middleware('permission:view_contacts');
    Route::put('/contacts/{contact}', [ContactController::class, 'update'])->middleware('permission:edit_contacts');
    Route::delete('/contacts/{contact}', [ContactController::class, 'destroy'])->middleware('permission:delete_contacts');

    // ========================================================
    // 🛒 ระบบใบสั่งซื้อ (Purchase Orders)
    // ========================================================
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index'])->middleware('permission:view_purchase');
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store'])->middleware('permission:bt_create_purchase');
    Route::get('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->middleware('permission:view_purchase');
    Route::put('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update'])->middleware('permission:bt_edit_purchase');
    Route::delete('/purchase-orders/{id}', [PurchaseOrderController::class, 'destroy'])->middleware('permission:bt_delete_purchase');
    Route::get('/purchase-orders/{id}/pending-items', [PurchaseOrderController::class, 'getPendingItems'])->middleware('permission:view_purchase');

    Route::patch('/purchase-orders/{id}/approve', [PurchaseOrderController::class, 'approve'])->middleware('permission:bt_approve_purchase');
    Route::patch('/purchase-orders/{id}/cancel', [PurchaseOrderController::class, 'cancel'])->middleware('permission:bt_edit_purchase');
    Route::patch('/purchase-orders/{id}/force-close', [PurchaseOrderController::class, 'forceClose'])->middleware('permission:bt_edit_purchase');

    // ========================================================
    // 🛠️ ใบสั่งซื้อ/ใบสั่งจ้าง ผู้รับเหมา (Contractor Work Orders) — แยกจาก Purchase Order โดยสิ้นเชิง
    // ไม่ผูก middleware permission ระดับ route เพราะ ContractorWorkOrderController::hasPermission() เช็คเองภายใน (เหมือน SaleDocumentController)
    // ========================================================
    Route::get('/contractor-work-orders', [ContractorWorkOrderController::class, 'index']);
    Route::post('/contractor-work-orders', [ContractorWorkOrderController::class, 'store']);
    Route::get('/contractor-work-orders/{id}', [ContractorWorkOrderController::class, 'show']);
    Route::put('/contractor-work-orders/{id}', [ContractorWorkOrderController::class, 'update']);
    Route::delete('/contractor-work-orders/{id}', [ContractorWorkOrderController::class, 'destroy']);
    Route::patch('/contractor-work-orders/{id}/approve', [ContractorWorkOrderController::class, 'approve']);
    Route::patch('/contractor-work-orders/{id}/cancel', [ContractorWorkOrderController::class, 'cancel']);

    // ========================================================
    // 📋 ใบคุมสัญญาราชการ (Government Contracts) — ทะเบียนติดตาม ไม่มี approve/cancel
    // ========================================================
    Route::get('/government-contracts', [GovernmentContractController::class, 'index']);
    Route::post('/government-contracts', [GovernmentContractController::class, 'store']);
    Route::get('/government-contracts/{id}', [GovernmentContractController::class, 'show']);
    Route::put('/government-contracts/{id}', [GovernmentContractController::class, 'update']);
    Route::delete('/government-contracts/{id}', [GovernmentContractController::class, 'destroy']);

    // 🏗️ โครงการ (Project) — หน้า Project Hub ผูกเอกสารขาย/PO เข้ากับโครงการ
    Route::get('/projects', [ProjectController::class, 'index'])->middleware('permission:view_projects');
    Route::get('/projects/{id}', [ProjectController::class, 'show'])->middleware('permission:view_projects');
    Route::get('/projects/{id}/summary', [ProjectController::class, 'summary'])->middleware('permission:view_projects');
    Route::get('/projects/{id}/installable-items', [InstallationRecordController::class, 'installableItems'])->middleware('permission:view_installations');
    Route::get('/projects/{id}/cost-summary', [ProjectController::class, 'costSummary'])->middleware('permission:view_projects');
    Route::get('/projects/{id}/installation-equipment-items', [InstallationEquipmentController::class, 'index'])->middleware('permission:view_installations');
    Route::post('/projects', [ProjectController::class, 'store'])->middleware('permission:create_projects');
    Route::put('/projects/{id}', [ProjectController::class, 'update'])->middleware('permission:edit_projects');
    Route::delete('/projects/{id}', [ProjectController::class, 'destroy'])->middleware('permission:delete_projects');

    // 🎪 งานเช่า (Rental Jobs) — คล้ายโครงการ แต่เป็นโมดูลเทียบเท่า (peer) ไม่ใช่โมดูลย่อยของโครงการ
    // ⚠️ route แบบ static (job-type-options) ต้องมาก่อน /rental-jobs/{id} เสมอ
    Route::get('/rental-jobs', [RentalJobController::class, 'index'])->middleware('permission:view_rental_jobs');
    Route::get('/rental-jobs/job-type-options', [RentalJobController::class, 'jobTypeOptions'])->middleware('permission:view_rental_jobs');
    Route::get('/rental-jobs/{id}', [RentalJobController::class, 'show'])->middleware('permission:view_rental_jobs');
    Route::get('/rental-jobs/{id}/summary', [RentalJobController::class, 'summary'])->middleware('permission:view_rental_jobs');
    Route::post('/rental-jobs', [RentalJobController::class, 'store'])->middleware('permission:create_rental_jobs');
    Route::put('/rental-jobs/{id}', [RentalJobController::class, 'update'])->middleware('permission:edit_rental_jobs');
    Route::delete('/rental-jobs/{id}', [RentalJobController::class, 'destroy'])->middleware('permission:delete_rental_jobs');

    Route::post('/stock-balances/check', [StockCheckController::class, 'check'])->middleware('permission:view_products');

    // ========================================================
    // 📄 ระบบเอกสารขาย (Sale Documents)
    // ========================================================
    // 🚀 สิทธิ์แยกตามประเภทเอกสาร (view_{type}/create_{type}/edit_{type}/delete_{type}/approve_{type})
    // เช็คใน SaleDocumentController::hasPermission() แทน เพราะ route ระดับนี้ยังไม่รู้ประเภทเอกสาร (โดยเฉพาะ route ที่มีแค่ {id})
    Route::get('/sale-documents', [SaleDocumentController::class, 'index']);
    Route::post('/sale-documents', [SaleDocumentController::class, 'store']);
    // ⚠️ ต้องมาก่อน /sale-documents/{id} เสมอ ไม่งั้น Laravel จะจับ "lookup"/"outstanding-balances" เป็นค่า {id}
    Route::get('/sale-documents/lookup', [SaleDocumentController::class, 'lookup'])->middleware('permission:view_repairs');
    Route::get('/sale-documents/outstanding-balances', [SaleDocumentController::class, 'outstandingBalances']);
    Route::post('/sale-documents/custom-quotations/upload-logo', [SaleDocumentController::class, 'uploadCustomLogo']);
    Route::post('/sale-documents/custom-cash-sales/upload-logo', [SaleDocumentController::class, 'uploadCustomCashLogo']);
    Route::post('/sale-documents/{id}/revise', [SaleDocumentController::class, 'revise']);
    Route::get('/sale-documents/{id}/rented-serials', [SaleDocumentController::class, 'rentedSerials']);
    Route::get('/sale-documents/{id}/sold-serials', [SaleDocumentController::class, 'soldSerials']);
    Route::get('/sale-documents/{id}', [SaleDocumentController::class, 'show']);
    Route::put('/sale-documents/{id}', [SaleDocumentController::class, 'update']);
    Route::delete('/sale-documents/{id}', [SaleDocumentController::class, 'destroy']);
    Route::patch('/sale-documents/{id}/approve', [SaleDocumentController::class, 'approve']);
    Route::patch('/sale-documents/{id}/cancel', [SaleDocumentController::class, 'cancel']);

    // 🔧 งานซ่อม (Repair Tickets)
    Route::get('/repairs', [RepairTicketController::class, 'index'])->middleware('permission:view_repairs');
    Route::get('/repairs/{id}', [RepairTicketController::class, 'show'])->middleware('permission:view_repairs');
    Route::post('/repairs', [RepairTicketController::class, 'store'])->middleware('permission:create_repairs');
    Route::put('/repairs/{id}', [RepairTicketController::class, 'update'])->middleware('permission:edit_repairs');
    Route::patch('/repairs/{id}/status', [RepairTicketController::class, 'transitionStatus'])->middleware('permission:transition_repairs');
    Route::post('/repairs/{id}/generate-billing', [RepairTicketController::class, 'generateBilling'])->middleware('permission:bill_repairs');
    Route::delete('/repairs/{id}', [RepairTicketController::class, 'destroy'])->middleware('permission:delete_repairs');

    // 🏗️ งานติดตั้ง (Installation Records)
    Route::get('/installations', [InstallationRecordController::class, 'index'])->middleware('permission:view_installations');
    Route::get('/installations/{id}', [InstallationRecordController::class, 'show'])->middleware('permission:view_installations');
    Route::post('/installations', [InstallationRecordController::class, 'store'])->middleware('permission:create_installations');
    Route::put('/installations/{id}', [InstallationRecordController::class, 'update'])->middleware('permission:edit_installations');
    Route::patch('/installations/{id}/status', [InstallationRecordController::class, 'transitionStatus'])->middleware('permission:transition_installations');
    Route::delete('/installations/{id}', [InstallationRecordController::class, 'destroy'])->middleware('permission:delete_installations');

    // 🧰 อุปกรณ์ที่เลือกไว้จะนำไปติดตั้ง (อ้างอิงเท่านั้น ไม่ตัดสต๊อก) — ดู InstallationEquipmentController
    Route::post('/installation-equipment-items', [InstallationEquipmentController::class, 'store'])->middleware('permission:create_installations');
    Route::delete('/installation-equipment-items/{id}', [InstallationEquipmentController::class, 'destroy'])->middleware('permission:edit_installations');

    // 📊 รายงาน (Reports)
    Route::get('/reports/serial-history/{serialNumber}', [ReportController::class, 'serialHistory'])->middleware('permission:view_reports');
    Route::get('/reports/repairs-summary', [ReportController::class, 'repairsSummary'])->middleware('permission:view_reports_repairs');
    Route::get('/reports/repairs-summary/export', [ReportController::class, 'exportRepairsSummary'])->middleware('permission:view_reports_repairs');
    Route::get('/reports/frequently-repaired-products', [ReportController::class, 'frequentlyRepairedProducts'])->middleware('permission:view_reports_repairs');
    Route::get('/reports/frequently-repaired-products/export', [ReportController::class, 'exportFrequentlyRepairedProducts'])->middleware('permission:view_reports_repairs');

    Route::get('/reports/sales-summary', [ReportController::class, 'salesSummary'])->middleware('permission:view_reports_sales');
    Route::get('/reports/sales', [ReportController::class, 'salesDetail'])->middleware('permission:view_reports_sales');
    Route::get('/reports/sales/export', [ReportController::class, 'exportSalesDetail'])->middleware('permission:view_reports_sales');
    Route::get('/reports/ar-aging', [ReportController::class, 'arAging'])->middleware('permission:view_reports_sales');
    Route::get('/reports/ar-aging/export', [ReportController::class, 'exportArAging'])->middleware('permission:view_reports_sales');
    Route::get('/reports/sales-trend', [ReportController::class, 'salesTrend'])->middleware('permission:view_reports_sales');
    Route::get('/reports/sales-trend/export', [ReportController::class, 'exportSalesTrend'])->middleware('permission:view_reports_sales');
    Route::get('/reports/quotation-conversion', [ReportController::class, 'quotationConversion'])->middleware('permission:view_reports_sales');
    Route::get('/reports/sales-by-salesperson', [ReportController::class, 'salesBySalesperson'])->middleware('permission:view_reports_sales');
    Route::get('/reports/sales-by-salesperson/export', [ReportController::class, 'exportSalesBySalesperson'])->middleware('permission:view_reports_sales');
    Route::get('/reports/sales-margin', [ReportController::class, 'salesMargin'])->middleware('permission:view_reports_sales');
    Route::get('/reports/sales-margin/export', [ReportController::class, 'exportSalesMargin'])->middleware('permission:view_reports_sales');
    Route::get('/reports/purchases', [ReportController::class, 'purchases'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/purchases/export', [ReportController::class, 'exportPurchases'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/purchase-summary', [ReportController::class, 'purchaseSummary'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/top-suppliers', [ReportController::class, 'topSuppliers'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/top-suppliers/export', [ReportController::class, 'exportTopSuppliers'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/po-backorder', [ReportController::class, 'poBackorder'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/po-backorder/export', [ReportController::class, 'exportPoBackorder'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/supplier-price-comparison', [ReportController::class, 'supplierPriceComparison'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/supplier-price-comparison/export', [ReportController::class, 'exportSupplierPriceComparison'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/ap-aging', [ReportController::class, 'apAging'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/ap-aging/export', [ReportController::class, 'exportApAging'])->middleware('permission:view_reports_purchases');
    Route::get('/reports/installations-summary', [ReportController::class, 'installationsSummary'])->middleware('permission:view_reports_installations');
    Route::get('/reports/installations-summary/export', [ReportController::class, 'exportInstallationsSummary'])->middleware('permission:view_reports_installations');
    Route::get('/reports/top-customers', [ReportController::class, 'topCustomers'])->middleware('permission:view_reports_top_customers');
    Route::get('/reports/top-customers/export', [ReportController::class, 'exportTopCustomers'])->middleware('permission:view_reports_top_customers');
    Route::get('/reports/inventory-valuation', [ReportController::class, 'inventoryValuation'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/inventory-valuation/export', [ReportController::class, 'exportInventoryValuation'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/low-stock', [ReportController::class, 'lowStock'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/low-stock/export', [ReportController::class, 'exportLowStock'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/stock-movement-ledger', [ReportController::class, 'stockMovementLedger'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/stock-movement-ledger/export', [ReportController::class, 'exportStockMovementLedger'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/stock-by-warehouse', [ReportController::class, 'stockByWarehouse'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/stock-by-warehouse/export', [ReportController::class, 'exportStockByWarehouse'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/slow-moving-stock', [ReportController::class, 'slowMovingStock'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/slow-moving-stock/export', [ReportController::class, 'exportSlowMovingStock'])->middleware('permission:view_reports_inventory');
    Route::get('/reports/warranty-expiry', [ReportController::class, 'warrantyExpiry'])->middleware('permission:view_reports_repairs');
    Route::get('/reports/warranty-expiry/export', [ReportController::class, 'exportWarrantyExpiry'])->middleware('permission:view_reports_repairs');
    Route::get('/reports/repair-turnaround', [ReportController::class, 'repairTurnaround'])->middleware('permission:view_reports_repairs');
    Route::get('/reports/repair-turnaround/export', [ReportController::class, 'exportRepairTurnaround'])->middleware('permission:view_reports_repairs');
    Route::get('/reports/repair-cost-trend', [ReportController::class, 'repairCostTrend'])->middleware('permission:view_reports_repairs');
    Route::get('/reports/asset-maintenance-due', [ReportController::class, 'assetMaintenanceDue'])->middleware('permission:manage_assets');
    Route::get('/reports/project-profitability', [ReportController::class, 'projectProfitability'])->middleware('permission:view_projects');
    Route::get('/reports/project-profitability/export', [ReportController::class, 'exportProjectProfitability'])->middleware('permission:view_projects');
    Route::get('/reports/rental-jobs', [ReportController::class, 'rentalJobsReport'])->middleware('permission:view_rental_jobs');
    Route::get('/reports/rental-jobs/export', [ReportController::class, 'exportRentalJobs'])->middleware('permission:view_rental_jobs');
    Route::get('/reports/overdue-rentals', [ReportController::class, 'overdueRentals'])->middleware('permission:view_rental_jobs');
    Route::get('/reports/overdue-rentals/export', [ReportController::class, 'exportOverdueRentals'])->middleware('permission:view_rental_jobs');
    Route::get('/reports/installations-by-project', [ReportController::class, 'installationsByProject'])->middleware('permission:view_reports_installations');
    Route::get('/reports/company-margin-trend', [ReportController::class, 'companyMarginTrend'])->middleware('permission:view_reports_executive');
    Route::get('/reports/company-margin-trend/export', [ReportController::class, 'exportCompanyMarginTrend'])->middleware('permission:view_reports_executive');
    Route::get('/reports/cash-position', [ReportController::class, 'cashPosition'])->middleware('permission:view_reports_executive');
    Route::get('/reports/cash-position/export', [ReportController::class, 'exportCashPosition'])->middleware('permission:view_reports_executive');
    Route::get('/reports/ar-ap-comparison', [ReportController::class, 'arApComparison'])->middleware('permission:view_reports_executive');

    // ========================================================
    // 📦 ระบบใบรับสินค้า (Goods Receipts)
    // ========================================================
    Route::get('/goods-receipts', [GoodsReceiptController::class, 'getGoodsReceipts'])->middleware('permission:stock_in_purchase');
    Route::post('/purchase-orders/{id}/goods-receipt', [GoodsReceiptController::class, 'storeGoodsReceipt'])->middleware('permission:bt_create_goods_receipt');
    Route::post('/direct-goods-receipt', [GoodsReceiptController::class, 'storeDirectGoodsReceipt'])->middleware('permission:bt_create_goods_receipt_no_po');
    Route::patch('/goods-receipts/{id}/cancel', [GoodsReceiptController::class, 'cancelGoodsReceipt'])->middleware('permission:bt_edit_purchase');
    Route::get('/goods-receipts/{id}/items', [GoodsReceiptController::class, 'showItems'])->middleware('permission:view_purchase');
});
