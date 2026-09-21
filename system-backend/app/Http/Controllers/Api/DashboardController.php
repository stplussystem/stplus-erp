<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SaleDocument;
use App\Models\SaleDocumentItem;
use App\Models\PurchaseOrder;
use App\Models\ContractorWorkOrder;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\Project;
use App\Models\GovernmentContractDueDate;
use Illuminate\Http\Request;

// GET /api/dashboard/stats — หน้าแรกของระบบ (แทนที่หน้า index เดิม) แบ่งเป็น 6 กลุ่มตามที่ผู้ใช้ขอ:
// ยอดขาย / ยอดงานเช่า / โครงการ / สินค้า / แจ้งเตือน / เอกสารรอการอนุมัติ
// 🛡️ ดึงตรรกะเดียวกับที่ ReportController ใช้ในแต่ละรายงาน แต่ไม่เรียก ReportController ตรงๆ
// (method ส่วนใหญ่ผูกกับ Request/HTTP response) จึง duplicate query สั้นๆ ตรงจุดแทน
class DashboardController extends Controller
{
    private const REAL_SALES_DOC_TYPES = ['tax_invoice', 'cash', 'receipt'];

    public function index(Request $request)
    {
        $companyId = auth()->user()->company_id;

        return response()->json(['data' => [
            'sales' => $this->salesSummary($companyId),
            'rental' => $this->rentalSummary($companyId),
            'projects' => $this->projectsSummary($companyId),
            'products' => $this->productsSummary($companyId),
            'notifications' => $this->notificationsSummary($request),
            'pending_approvals' => $this->pendingApprovalsSummary($companyId),
        ]]);
    }

    // 🧮 ต้นทุนต่อสินค้า — อ่านจากมูลค่าล็อตคงเหลือจริง (StockCostService) เป็นหลัก แทนค่าเฉลี่ยทั้งประวัติแบบเดิม
    private function averageCostByProduct(int $companyId): \Illuminate\Support\Collection
    {
        return \App\Services\StockCostService::averageCostByProduct($companyId);
    }

    // ================== 1. ยอดขาย (เดือนนี้) ==================
    private function salesSummary(int $companyId): array
    {
        $monthDocs = SaleDocument::where('company_id', $companyId)
            ->where('status', 'Approved')
            ->whereMonth('issue_date', now()->month)
            ->whereYear('issue_date', now()->year)
            ->get(['id', 'document_type', 'grand_total']);

        $realSalesTotal = $monthDocs->whereIn('document_type', self::REAL_SALES_DOC_TYPES)->sum('grand_total');
        $creditNoteTotal = $monthDocs->where('document_type', 'credit_note')->sum('grand_total');
        $totalSales = round((float) ($realSalesTotal - $creditNoteTotal), 2);

        // ต้นทุนสินค้าที่ขายไปเดือนนี้ — คูณจำนวนที่ขาย (ไม่รวมแถวลูกของ Bundle) กับต้นทุนเฉลี่ยถ่วงน้ำหนัก
        $realSaleDocIds = $monthDocs->whereIn('document_type', self::REAL_SALES_DOC_TYPES)->pluck('id');
        $avgCostByProduct = $this->averageCostByProduct($companyId);
        $itemRows = SaleDocumentItem::whereIn('sale_document_id', $realSaleDocIds)
            ->whereNull('parent_item_id')
            ->get(['product_id', 'quantity']);
        $totalCostOfGoods = round(
            (float) $itemRows->sum(fn($row) => (float) $row->quantity * (float) ($avgCostByProduct[$row->product_id] ?? 0)),
            2,
        );

        // 🔄 [2026-09-17] ต้นทุนอุปกรณ์/วัสดุติดตั้งเดือนนี้ — เดิม snapshot จาก InstallationEquipmentItem (ไม่เคยตัด
        // สต๊อกจริง) ตอนนี้รวมจากเอกสาร sale_documents ประเภท 'installation_issue' ที่อนุมัติแล้วจริงแทน ใช้
        // approved_at (เดือนที่ตัดสต๊อกจริง) ไม่ใช่ created_at (เดือนที่สร้างเอกสาร อาจคนละเดือนกับตอนอนุมัติ)
        $installationCost = (float) SaleDocumentItem::query()
            ->join('sale_documents', 'sale_documents.id', '=', 'sale_document_items.sale_document_id')
            ->where('sale_documents.company_id', $companyId)
            ->where('sale_documents.document_type', 'installation_issue')
            ->where('sale_documents.status', 'Approved')
            ->whereMonth('sale_documents.approved_at', now()->month)
            ->whereYear('sale_documents.approved_at', now()->year)
            ->selectRaw('SUM(sale_document_items.quantity * sale_document_items.cost_price) as total')
            ->value('total');

        return [
            'total_sales' => $totalSales,
            'total_cost_of_goods' => $totalCostOfGoods,
            'total_installation_cost' => round($installationCost, 2),
            'profit' => round($totalSales - $totalCostOfGoods - $installationCost, 2),
            // 🏆 ลูกค้าซื้อเยอะสุด 5 อันดับ — สะสมทั้งหมด (ไม่จำกัดแค่เดือนนี้) เหมือน ReportController::topCustomers()
            'top_customers' => SaleDocument::where('company_id', $companyId)
                ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
                ->where('status', 'Approved')
                ->whereNotNull('contact_id')
                ->selectRaw('contact_id, COUNT(*) as document_count, SUM(grand_total) as total_amount')
                ->groupBy('contact_id')
                ->orderByDesc('total_amount')
                ->limit(5)
                ->with('contact:id,business_name,contact_person_name')
                ->get(),
        ];
    }

    // ================== 2. ยอดงานเช่า (เดือนนี้) ==================
    private function rentalSummary(int $companyId): array
    {
        $revenue = (float) SaleDocument::where('company_id', $companyId)
            ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
            ->where('status', 'Approved')
            ->whereNotNull('rental_job_id')
            ->whereMonth('issue_date', now()->month)
            ->whereYear('issue_date', now()->year)
            ->sum('grand_total');

        // 🛡️ ยังไม่มีระบบคำนวณค่าเสื่อม/ต้นทุนอุปกรณ์เช่าโดยตรง — ใช้ต้นทุนผู้รับเหมา/บริการภายนอกที่ผูกกับงานเช่า
        // (ContractorWorkOrder.rental_job_id) เป็นตัวแทนต้นทุนที่ใกล้เคียงที่สุดเท่าที่มีข้อมูลอยู่จริงตอนนี้
        $cost = (float) ContractorWorkOrder::where('company_id', $companyId)
            ->where('status', 'Approved')
            ->whereNotNull('rental_job_id')
            ->whereMonth('order_date', now()->month)
            ->whereYear('order_date', now()->year)
            ->sum('grand_total');

        return [
            'total_revenue' => round($revenue, 2),
            'total_cost' => round($cost, 2),
            'profit' => round($revenue - $cost, 2),
        ];
    }

    // ================== 3. โครงการ ==================
    private function projectsSummary(int $companyId): array
    {
        $countsByStatus = Project::where('company_id', $companyId)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $projectIds = Project::where('company_id', $companyId)->pluck('id');

        $revenue = (float) SaleDocument::where('company_id', $companyId)
            ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
            ->where('status', 'Approved')
            ->whereIn('project_id', $projectIds)
            ->sum('grand_total');

        $poCost = (float) PurchaseOrder::where('company_id', $companyId)
            ->whereIn('status', ['Approved', 'Completed'])
            ->whereIn('project_id', $projectIds)
            ->sum('grand_total');

        $workOrderCost = (float) ContractorWorkOrder::where('company_id', $companyId)
            ->where('status', 'Approved')
            ->whereIn('project_id', $projectIds)
            ->sum('grand_total');

        // 🔄 [2026-09-17] เดิมรวมจาก InstallationEquipmentItem — แทนที่ด้วยเอกสาร 'installation_issue' ที่อนุมัติแล้วจริง
        $equipmentCost = (float) SaleDocumentItem::query()
            ->join('sale_documents', 'sale_documents.id', '=', 'sale_document_items.sale_document_id')
            ->where('sale_documents.company_id', $companyId)
            ->where('sale_documents.document_type', 'installation_issue')
            ->where('sale_documents.status', 'Approved')
            ->whereIn('sale_documents.project_id', $projectIds)
            ->selectRaw('SUM(sale_document_items.quantity * sale_document_items.cost_price) as total')
            ->value('total');

        $totalExpense = $poCost + $workOrderCost + $equipmentCost;

        return [
            // 🪜 status จริงมี 4 ค่า (active/on_hold/completed/cancelled) — จัดกลุ่มให้ตรงกับที่ผู้ใช้ขอ 3 กลุ่ม
            // (กำลังเดินงาน/สำเร็จ/ยกเลิก) โดยรวม on_hold เข้ากับ "กำลังเดินงาน" (ยังไม่จบ ไม่ได้ยกเลิก)
            'counts' => [
                'ongoing' => (int) ($countsByStatus['active'] ?? 0) + (int) ($countsByStatus['on_hold'] ?? 0),
                'success' => (int) ($countsByStatus['completed'] ?? 0),
                'cancelled' => (int) ($countsByStatus['cancelled'] ?? 0),
                'on_hold' => (int) ($countsByStatus['on_hold'] ?? 0),
                'total' => (int) $countsByStatus->sum(),
            ],
            'total_revenue' => round($revenue, 2),
            'total_expense' => round($totalExpense, 2),
            'total_profit' => round($revenue - $totalExpense, 2),
        ];
    }

    // ================== 4. สินค้า ==================
    private function productsSummary(int $companyId): array
    {
        $avgCostByProduct = $this->averageCostByProduct($companyId);
        $balanceByProduct = StockBalance::where('company_id', $companyId)
            ->selectRaw('product_id, SUM(qty) as total_qty, SUM(reserved_qty) as total_reserved_qty')
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id');

        // มูลค่าสินค้าคงเหลือรวม (ต้นทุน) — เหมือน ReportController::inventoryValuation()
        $totalInventoryValue = 0;
        foreach ($balanceByProduct as $productId => $balance) {
            $avgCost = $avgCostByProduct[$productId] ?? null;
            if ($avgCost !== null) {
                $totalInventoryValue += (float) $balance->total_qty * $avgCost;
            }
        }

        // สินค้าต่ำกว่าจุดแจ้งเตือน — เหมือน ReportController::lowStock() แต่ตัดเหลือ preview 5 แถวแรก
        $lowStockAll = Product::where('company_id', $companyId)
            ->whereNotNull('low_stock_threshold')
            ->get(['id', 'name', 'sku', 'low_stock_threshold'])
            ->map(function ($product) use ($balanceByProduct) {
                $qty = (int) ($balanceByProduct[$product->id]->total_qty ?? 0);
                $reservedQty = (int) ($balanceByProduct[$product->id]->total_reserved_qty ?? 0);
                $availableQty = $qty - $reservedQty;
                return [
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'available_qty' => $availableQty,
                    'threshold' => (int) $product->low_stock_threshold,
                ];
            })
            ->filter(fn($row) => $row['available_qty'] <= $row['threshold'])
            ->sortBy('available_qty')
            ->values();

        // สินค้าขายดี 5 อันดับ (ตามจำนวนที่ขายได้ สะสมทั้งหมด) — group เดียวกับ ReportController::salesMargin()
        $bestSellers = SaleDocumentItem::whereNull('parent_item_id')
            ->whereHas('saleDocument', fn($q) => $q->where('company_id', $companyId)
                ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
                ->where('status', 'Approved'))
            ->with('product:id,name,sku')
            ->get(['product_id', 'quantity', 'total_price'])
            ->groupBy('product_id')
            ->map(fn($group) => [
                'product' => $group->first()->product,
                'qty' => (float) $group->sum('quantity'),
                'sale_amount' => round((float) $group->sum('total_price'), 2),
            ])
            ->sortByDesc('qty')
            ->take(5)
            ->values();

        // vendor ที่ยอดซื้อเยอะสุด 5 อันดับ — เหมือน ReportController::topSuppliers()
        $topVendors = PurchaseOrder::where('company_id', $companyId)
            ->whereIn('status', ['Approved', 'Completed'])
            ->whereNotNull('contact_id')
            ->selectRaw('contact_id, COUNT(*) as document_count, SUM(grand_total) as total_amount')
            ->groupBy('contact_id')
            ->orderByDesc('total_amount')
            ->limit(5)
            ->with('contact:id,business_name,contact_person_name')
            ->get();

        return [
            'total_inventory_value' => round($totalInventoryValue, 2),
            'low_stock' => [
                'total_count' => $lowStockAll->count(),
                'preview' => $lowStockAll->take(5)->values(),
            ],
            'best_sellers' => $bestSellers,
            'top_vendors' => $topVendors,
        ];
    }

    // ================== 5. แจ้งเตือน ==================
    private function notificationsSummary(Request $request): array
    {
        $unread = $request->user()->unreadNotifications()->latest()->limit(5)->get(['id', 'data', 'created_at']);

        return [
            'unread_count' => $request->user()->unreadNotifications()->count(),
            'recent' => $unread,
        ];
    }

    // ================== 6. เอกสารรอการอนุมัติทั้งหมด ==================
    // รวม 3 แหล่งที่มีสถานะ 'Pending' จริง (ตรวจโค้ดยืนยันแล้ว): SaleDocument (ครอบคลุมเอกสารขาย/คลัง/งานเช่าเกือบทุกประเภท),
    // PurchaseOrder, ContractorWorkOrder — GoodsReceipt ไม่มี workflow อนุมัติ (สร้างเป็น Completed ทันที จึงไม่รวม)
    // 🚀 $forUser: ถ้าส่งมา จะกรองให้เหลือเฉพาะประเภทที่ user คนนั้นมีสิทธิ์ approve จริง (ใช้กับหน้า index
    // ส่วนตัวที่ homeSummary() เรียก) ถ้าไม่ส่ง (เช่น /dashboard/stats เดิม) จะเห็นทุกรายการของบริษัทเหมือนเดิม
    private function pendingApprovalsSummary(int $companyId, $forUser = null): array
    {
        $pendingSaleDocs = SaleDocument::where('company_id', $companyId)
            ->where('status', 'Pending')
            ->get(['id', 'document_type', 'document_number', 'grand_total', 'created_at']);

        $pendingPOs = PurchaseOrder::where('company_id', $companyId)
            ->where('status', 'Pending')
            ->get(['id', 'po_number', 'grand_total', 'created_at']);

        $pendingWorkOrders = ContractorWorkOrder::where('company_id', $companyId)
            ->where('status', 'Pending')
            ->get(['id', 'order_number', 'grand_total', 'created_at']);

        $combined = $pendingSaleDocs->map(fn($doc) => [
            'source' => 'sale_document',
            'document_type' => $doc->document_type,
            'number' => $doc->document_number,
            'amount' => (float) $doc->grand_total,
            'created_at' => $doc->created_at,
            'id' => $doc->id,
        ])->concat($pendingPOs->map(fn($po) => [
            'source' => 'purchase_order',
            'document_type' => 'purchase_order',
            'number' => $po->po_number,
            'amount' => (float) $po->grand_total,
            'created_at' => $po->created_at,
            'id' => $po->id,
        ]))->concat($pendingWorkOrders->map(fn($wo) => [
            'source' => 'contractor_work_order',
            'document_type' => 'contractor_work_order',
            'number' => $wo->order_number,
            'amount' => (float) $wo->grand_total,
            'created_at' => $wo->created_at,
            'id' => $wo->id,
        ]))->sortByDesc('created_at')->values();

        if ($forUser !== null && !$forUser->is_platform_admin && !$forUser->isCompanyAdmin()) {
            $combined = $combined->filter(function ($item) use ($forUser) {
                $requiredPermission = match ($item['source']) {
                    'purchase_order' => 'bt_approve_purchase',
                    'contractor_work_order' => 'approve_contractor_work_orders',
                    default => "approve_{$item['document_type']}",
                };
                return $forUser->can($requiredPermission);
            })->values();
        }

        return [
            'total_count' => $combined->count(),
            'recent' => $combined->take(8)->values(),
        ];
    }

    // ================== 7. สัญญาราชการใกล้หมดอายุ (ภายใน 30 วัน) ==================
    private function contractsExpiringSummary(int $companyId): array
    {
        $upcoming = GovernmentContractDueDate::whereHas('contract', fn($q) => $q->where('company_id', $companyId))
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [now()->toDateString(), now()->addDays(30)->toDateString()])
            ->with('contract:id,agency_name,contract_number,project_id')
            ->orderBy('due_date')
            ->get(['id', 'government_contract_id', 'due_date', 'note']);

        return [
            'total_count' => $upcoming->count(),
            'recent' => $upcoming->take(8)->values(),
        ];
    }

    // GET /home/summary — หน้าแรกส่วนตัวของแต่ละ user (แทนที่การเด้งไป /dashboard เดิม) เอาแค่ 3 กลุ่มที่
    // เป็น "แจ้งเตือนที่ต้องรู้" จริง ๆ ไม่ต้องคำนวณยอดขาย/กำไรหนัก ๆ เหมือน /dashboard/stats
    public function homeSummary(Request $request)
    {
        $companyId = auth()->user()->company_id;

        return response()->json(['data' => [
            'products' => $this->productsSummary($companyId),
            'pending_approvals' => $this->pendingApprovalsSummary($companyId, $request->user()),
            'contracts_expiring' => $this->contractsExpiringSummary($companyId),
        ]]);
    }
}
