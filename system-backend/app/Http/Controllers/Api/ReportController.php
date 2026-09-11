<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductSerial;
use App\Models\RepairTicket;
use App\Models\SaleDocument;
use App\Models\SaleDocumentItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\ContractorWorkOrder;
use App\Models\InstallationRecord;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\Reports\SalesDetailExport;
use App\Exports\Reports\PurchasesExport;
use App\Exports\Reports\TopCustomersExport;
use App\Exports\Reports\InventoryValuationExport;
use App\Exports\Reports\RepairsSummaryExport;
use App\Exports\Reports\FrequentlyRepairedProductsExport;
use App\Exports\Reports\InstallationsSummaryExport;
use App\Exports\Reports\ArAgingExport;
use App\Exports\Reports\SalesTrendExport;
use App\Exports\Reports\SalesBySalespersonExport;
use App\Exports\Reports\SalesMarginExport;
use App\Exports\Reports\TopSuppliersExport;
use App\Exports\Reports\PoBackorderExport;
use App\Exports\Reports\SupplierPriceComparisonExport;
use App\Exports\Reports\ApAgingExport;
use App\Exports\Reports\LowStockExport;
use App\Exports\Reports\StockMovementLedgerExport;
use App\Exports\Reports\StockByWarehouseExport;
use App\Exports\Reports\SlowMovingStockExport;
use App\Models\Asset;
use App\Exports\Reports\WarrantyExpiryExport;
use App\Exports\Reports\RepairTurnaroundExport;
use App\Models\Project;
use App\Models\RentalJob;
use App\Exports\Reports\ProjectProfitabilityExport;
use App\Exports\Reports\RentalJobsExport;
use App\Exports\Reports\OverdueRentalsExport;
use App\Exports\Reports\CompanyMarginTrendExport;
use App\Exports\Reports\CashPositionExport;

class ReportController extends Controller
{
    // เอกสารขายที่ตัดสต๊อกออกจริง / นับเป็นยอดขายจริง — สำเนา convention เดิมจาก RepairTicketController/InstallationRecordController
    private const REAL_SALES_DOC_TYPES = ['tax_invoice', 'cash', 'receipt'];

    // GET /api/reports/serial-history/{serialNumber}
    // ตอบคำถามหลักของฟีเจอร์นี้: S/N นี้รับเข้ามาเมื่อไหร่ ขายให้ใคร แล้วมีประวัติซ่อมอะไรบ้าง
    public function serialHistory($serialNumber)
    {
        $serial = ProductSerial::with(['product', 'stockMovement', 'soldToSaleDocument.contact'])
            ->where('serial_number', $serialNumber)
            ->where('company_id', auth()->user()->company_id)
            ->first();

        if (!$serial) {
            return response()->json(['message' => 'ไม่พบ S/N นี้ในระบบ'], 404);
        }

        $repairs = RepairTicket::with('contact:id,business_name,contact_person_name')
            ->where('product_serial_id', $serial->id)
            ->orderBy('created_at')
            ->get(['id', 'ticket_number', 'status', 'received_at', 'returned_at', 'repair_cost', 'created_at', 'contact_id']);

        return response()->json(['data' => [
            'serial' => $serial,
            'repairs' => $repairs,
        ]]);
    }

    // GET /api/reports/repairs-summary?date_from=&date_to=&contact_id=&status=
    public function repairsSummary(Request $request)
    {
        $query = RepairTicket::where('company_id', auth()->user()->company_id);

        if ($request->filled('date_from')) {
            $query->whereDate('received_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('received_at', '<=', $request->date_to);
        }
        if ($request->filled('contact_id')) {
            $query->where('contact_id', $request->contact_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $tickets = $query->get(['status', 'repair_cost']);

        return response()->json(['data' => [
            'total_tickets' => $tickets->count(),
            'by_status' => $tickets->groupBy('status')->map->count(),
            'total_repair_cost' => (float) $tickets->sum('repair_cost'),
        ]]);
    }

    // GET /api/reports/frequently-repaired-products?limit=20&date_from=&date_to=
    public function frequentlyRepairedProducts(Request $request)
    {
        $limit = (int) $request->get('limit', 20);

        $query = RepairTicket::where('company_id', auth()->user()->company_id);
        if ($request->filled('date_from')) {
            $query->whereDate('received_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('received_at', '<=', $request->date_to);
        }

        $rows = $query
            ->selectRaw('product_id, COUNT(*) as repair_count, SUM(repair_cost) as total_cost')
            ->groupBy('product_id')
            ->orderByDesc('repair_count')
            ->limit($limit)
            ->with('product:id,name,sku')
            ->get();

        return response()->json(['data' => $rows]);
    }

    // ================== Export เดิม 2 รายงาน ==================

    public function exportRepairsSummary(Request $request)
    {
        $query = RepairTicket::where('company_id', auth()->user()->company_id);
        if ($request->filled('date_from')) $query->whereDate('received_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('received_at', '<=', $request->date_to);
        if ($request->filled('contact_id')) $query->where('contact_id', $request->contact_id);
        if ($request->filled('status')) $query->where('status', $request->status);

        $tickets = $query->with('contact:id,business_name,contact_person_name')
            ->get(['id', 'ticket_number', 'status', 'received_at', 'returned_at', 'repair_cost', 'contact_id']);

        return Excel::download(new RepairsSummaryExport($tickets), 'repairs_summary_' . now()->format('Ymd_His') . '.xlsx');
    }

    public function exportFrequentlyRepairedProducts(Request $request)
    {
        $limit = (int) $request->get('limit', 20);
        $query = RepairTicket::where('company_id', auth()->user()->company_id);
        if ($request->filled('date_from')) $query->whereDate('received_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('received_at', '<=', $request->date_to);

        $rows = $query->selectRaw('product_id, COUNT(*) as repair_count, SUM(repair_cost) as total_cost')
            ->groupBy('product_id')->orderByDesc('repair_count')->limit($limit)
            ->with('product:id,name,sku')->get();

        return Excel::download(new FrequentlyRepairedProductsExport($rows), 'frequently_repaired_products_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 1. รายงานสรุปยอดขาย ==================

    private function salesSummaryQuery(Request $request)
    {
        $query = SaleDocument::where('company_id', auth()->user()->company_id);
        if ($request->filled('date_from')) $query->whereDate('issue_date', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('issue_date', '<=', $request->date_to);
        if ($request->filled('contact_id')) $query->where('contact_id', $request->contact_id);
        return $query;
    }

    // GET /api/reports/sales-summary?date_from=&date_to=&contact_id=
    public function salesSummary(Request $request)
    {
        $docs = $this->salesSummaryQuery($request)->get(['document_type', 'status', 'grand_total']);

        // 🛡️ ยอดเงินนับเฉพาะเอกสารที่อนุมัติแล้วเท่านั้น (เดิมนับรวม Pending/Cancelled ด้วย ทำให้ยอดขายสูงเกินจริง)
        // และหักใบลดหนี้ที่อนุมัติแล้วออกจากยอดขายจริง (เดิมไม่เคยถูกหักเลยเพราะไม่อยู่ใน REAL_SALES_DOC_TYPES)
        $approvedDocs = $docs->where('status', 'Approved');
        $realSalesTotal = $approvedDocs->whereIn('document_type', self::REAL_SALES_DOC_TYPES)->sum('grand_total');
        $creditNoteTotal = $approvedDocs->where('document_type', 'credit_note')->sum('grand_total');

        return response()->json(['data' => [
            'total_documents' => $docs->count(),
            'total_amount' => (float) ($realSalesTotal - $creditNoteTotal),
            'by_type' => $docs->groupBy('document_type')->map(fn($g) => [
                'count' => $g->count(),
                'total' => (float) $g->where('status', 'Approved')->sum('grand_total'),
            ]),
        ]]);
    }

    // ================== 2. รายงานรายการขาย (ละเอียด) ==================

    // GET /api/reports/sales?date_from=&date_to=&document_type=&status=&contact_id=
    public function salesDetail(Request $request)
    {
        $query = $this->salesSummaryQuery($request);
        if ($request->filled('document_type')) $query->where('document_type', $request->document_type);
        if ($request->filled('status')) $query->where('status', $request->status);

        $docs = $query->with('contact:id,business_name,contact_person_name')
            ->latest('issue_date')
            ->limit(500)
            ->get(['id', 'document_number', 'document_type', 'issue_date', 'status', 'grand_total', 'contact_id']);

        return response()->json(['data' => $docs]);
    }

    public function exportSalesDetail(Request $request)
    {
        $query = $this->salesSummaryQuery($request);
        if ($request->filled('document_type')) $query->where('document_type', $request->document_type);
        if ($request->filled('status')) $query->where('status', $request->status);

        $docs = $query->with('contact:id,business_name,contact_person_name')->latest('issue_date')->get();

        return Excel::download(new SalesDetailExport($docs), 'sales_report_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 3. รายงานจัดซื้อ ==================

    private function purchasesQuery(Request $request)
    {
        $query = PurchaseOrder::where('company_id', auth()->user()->company_id);
        if ($request->filled('date_from')) $query->whereDate('created_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('created_at', '<=', $request->date_to);
        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('contact_id')) $query->where('contact_id', $request->contact_id);
        return $query;
    }

    // GET /api/reports/purchases?date_from=&date_to=&status=&contact_id=
    public function purchases(Request $request)
    {
        $orders = $this->purchasesQuery($request)->with('contact:id,business_name,contact_person_name')
            ->latest()->limit(500)
            ->get(['id', 'po_number', 'status', 'created_at', 'grand_total', 'contact_id']);

        return response()->json(['data' => $orders]);
    }

    public function exportPurchases(Request $request)
    {
        $orders = $this->purchasesQuery($request)->with('contact:id,business_name,contact_person_name')->latest()->get();
        return Excel::download(new PurchasesExport($orders), 'purchases_report_' . now()->format('Ymd_His') . '.xlsx');
    }

    // GET /api/reports/purchase-summary?date_from=&date_to=&status=&contact_id=
    // ใบสั่งซื้อที่นับเป็นยอดจัดซื้อจริง = Approved (ยืนยันแล้ว) + Completed (รับของครบแล้ว) — Pending/Cancelled ไม่นับ
    public function purchaseSummary(Request $request)
    {
        $orders = $this->purchasesQuery($request)->get(['status', 'grand_total']);

        return response()->json(['data' => [
            'total_documents' => $orders->count(),
            'total_amount' => (float) $orders->whereIn('status', ['Approved', 'Completed'])->sum('grand_total'),
            'by_status' => $orders->groupBy('status')->map(fn($g) => [
                'count' => $g->count(),
                'total' => (float) $g->sum('grand_total'),
            ]),
        ]]);
    }

    // ================== 4. รายงานสรุปงานติดตั้ง ==================

    // GET /api/reports/installations-summary?date_from=&date_to=
    public function installationsSummary(Request $request)
    {
        $query = InstallationRecord::where('company_id', auth()->user()->company_id);
        if ($request->filled('date_from')) $query->whereDate('scheduled_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('scheduled_at', '<=', $request->date_to);

        $records = $query->get(['status', 'scheduled_at', 'installed_at']);

        $installed = $records->where('status', 'installed')->filter(fn($r) => $r->scheduled_at && $r->installed_at);
        $avgDays = $installed->count() > 0
            ? round($installed->avg(fn($r) => \Carbon\Carbon::parse($r->scheduled_at)->diffInDays(\Carbon\Carbon::parse($r->installed_at))), 1)
            : 0;

        return response()->json(['data' => [
            'total_records' => $records->count(),
            'by_status' => $records->groupBy('status')->map->count(),
            'avg_days_to_install' => $avgDays,
        ]]);
    }

    public function exportInstallationsSummary(Request $request)
    {
        $query = InstallationRecord::where('company_id', auth()->user()->company_id);
        if ($request->filled('date_from')) $query->whereDate('scheduled_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('scheduled_at', '<=', $request->date_to);

        $records = $query->with('contact:id,business_name,contact_person_name')->get();

        return Excel::download(new InstallationsSummaryExport($records), 'installations_summary_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 5. รายงานลูกค้าซื้อสูงสุด ==================

    // GET /api/reports/top-customers?date_from=&date_to=&limit=20
    public function topCustomers(Request $request)
    {
        $limit = (int) $request->get('limit', 20);
        // 🛡️ นับเฉพาะเอกสารที่อนุมัติแล้ว (เดิมนับรวม Pending/Cancelled ทำให้อันดับ/ยอดซื้อลูกค้าคลาดเคลื่อน)
        $query = SaleDocument::where('company_id', auth()->user()->company_id)
            ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
            ->where('status', 'Approved')
            ->whereNotNull('contact_id');
        if ($request->filled('date_from')) $query->whereDate('issue_date', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('issue_date', '<=', $request->date_to);

        $rows = $query->selectRaw('contact_id, COUNT(*) as document_count, SUM(grand_total) as total_amount')
            ->groupBy('contact_id')
            ->orderByDesc('total_amount')
            ->limit($limit)
            ->with('contact:id,business_name,contact_person_name')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function exportTopCustomers(Request $request)
    {
        $limit = (int) $request->get('limit', 20);
        $query = SaleDocument::where('company_id', auth()->user()->company_id)
            ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
            ->where('status', 'Approved')
            ->whereNotNull('contact_id');
        if ($request->filled('date_from')) $query->whereDate('issue_date', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('issue_date', '<=', $request->date_to);

        $rows = $query->selectRaw('contact_id, COUNT(*) as document_count, SUM(grand_total) as total_amount')
            ->groupBy('contact_id')->orderByDesc('total_amount')->limit($limit)
            ->with('contact:id,business_name,contact_person_name')->get();

        return Excel::download(new TopCustomersExport($rows), 'top_customers_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 6. รายงานสินค้าคงเหลือ (ต้นทุน+มูลค่าขาย) ==================

    // ต้นทุนถัวเฉลี่ยถ่วงน้ำหนักต่อสินค้า จาก goods_receipt_items.unit_price (ครอบคลุมทั้งรับผ่าน PO และรับตรง)
    // 🛡️ ไม่นับใบรับสินค้าที่ถูกยกเลิก — เดิมนับรวมด้วย ทำให้ต้นทุนถัวเฉลี่ย/มูลค่าสต๊อกในรายงานคลาดเคลื่อน
    private function averageCostByProduct(int $companyId): \Illuminate\Support\Collection
    {
        return GoodsReceiptItem::whereHas('goodsReceipt', fn($q) => $q->where('company_id', $companyId)->where('status', '!=', 'Cancelled'))
            ->whereNotNull('unit_price')
            ->selectRaw('product_id, SUM(quantity * unit_price) as total_cost, SUM(quantity) as total_qty')
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id')
            ->map(fn($row) => $row->total_qty > 0 ? round($row->total_cost / $row->total_qty, 2) : null);
    }

    private function inventoryValuationRows(Request $request)
    {
        $companyId = auth()->user()->company_id;

        $productQuery = Product::where('company_id', $companyId);
        if ($request->filled('category_id')) $productQuery->where('category_id', $request->category_id);
        $products = $productQuery->with('category:id,name')->get(['id', 'name', 'sku', 'price', 'category_id']);

        $balanceByProduct = StockBalance::where('company_id', $companyId)
            ->selectRaw('product_id, SUM(qty) as total_qty, SUM(reserved_qty) as total_reserved_qty')
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id');

        $avgCostByProduct = $this->averageCostByProduct($companyId);

        return $products->map(function ($product) use ($balanceByProduct, $avgCostByProduct) {
            $qty = (int) ($balanceByProduct[$product->id]->total_qty ?? 0);
            $reservedQty = (int) ($balanceByProduct[$product->id]->total_reserved_qty ?? 0);
            $avgCost = $avgCostByProduct[$product->id] ?? null;
            return (object) [
                'product' => $product,
                'qty' => $qty,
                'reserved_qty' => $reservedQty,
                'available_qty' => $qty - $reservedQty,
                'avg_cost' => $avgCost,
                'cost_value' => $avgCost !== null ? round($qty * $avgCost, 2) : null,
                'sale_value' => round($qty * (float) $product->price, 2),
            ];
        })->filter(fn($row) => $row->qty > 0)->values();
    }

    // GET /api/reports/inventory-valuation?category_id=
    public function inventoryValuation(Request $request)
    {
        $rows = $this->inventoryValuationRows($request);

        return response()->json(['data' => [
            'rows' => $rows,
            'total_cost_value' => round($rows->sum('cost_value'), 2),
            'total_sale_value' => round($rows->sum('sale_value'), 2),
        ]]);
    }

    public function exportInventoryValuation(Request $request)
    {
        $rows = $this->inventoryValuationRows($request);
        return Excel::download(new InventoryValuationExport($rows), 'inventory_valuation_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 7. รายงานอายุลูกหนี้ (AR Aging) ==================

    private function arAgingRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = SaleDocument::where('company_id', $companyId)
            ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
            ->where('status', 'Approved')
            ->whereNotNull('due_date');
        if ($request->filled('contact_id')) $query->where('contact_id', $request->contact_id);

        $docs = $query->with('contact:id,business_name,contact_person_name')
            ->get(['id', 'contact_id', 'document_number', 'due_date', 'grand_total']);

        $today = now()->startOfDay();
        return $docs->groupBy('contact_id')->map(function ($group) use ($today) {
            $buckets = ['b0_30' => 0.0, 'b31_60' => 0.0, 'b61_90' => 0.0, 'b90_plus' => 0.0];
            foreach ($group as $doc) {
                $due = \Carbon\Carbon::parse($doc->due_date)->startOfDay();
                $daysOverdue = $due->lt($today) ? $due->diffInDays($today) : 0;
                $amount = (float) $doc->grand_total;
                if ($daysOverdue <= 30) $buckets['b0_30'] += $amount;
                elseif ($daysOverdue <= 60) $buckets['b31_60'] += $amount;
                elseif ($daysOverdue <= 90) $buckets['b61_90'] += $amount;
                else $buckets['b90_plus'] += $amount;
            }
            return [
                'contact' => $group->first()->contact,
                'buckets' => $buckets,
                'total' => round(array_sum($buckets), 2),
            ];
        })->sortByDesc('total')->values();
    }

    // GET /api/reports/ar-aging?contact_id=
    public function arAging(Request $request)
    {
        $rows = $this->arAgingRows($request);
        $totals = ['b0_30' => 0.0, 'b31_60' => 0.0, 'b61_90' => 0.0, 'b90_plus' => 0.0];
        foreach ($rows as $row) {
            foreach ($totals as $key => $v) $totals[$key] += $row['buckets'][$key];
        }

        return response()->json(['data' => [
            'rows' => $rows,
            'totals' => $totals,
        ]]);
    }

    public function exportArAging(Request $request)
    {
        $rows = $this->arAgingRows($request);
        return Excel::download(new ArAgingExport($rows), 'ar_aging_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 8. รายงานแนวโน้มยอดขายรายเดือน ==================

    private function salesTrendRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = SaleDocument::where('company_id', $companyId)->where('status', 'Approved');
        if ($request->filled('date_from')) $query->whereDate('issue_date', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('issue_date', '<=', $request->date_to);

        $docs = $query->get(['document_type', 'issue_date', 'grand_total']);

        return $docs->groupBy(fn($d) => \Carbon\Carbon::parse($d->issue_date)->format('Y-m'))
            ->map(function ($group, $month) {
                $sales = $group->whereIn('document_type', self::REAL_SALES_DOC_TYPES)->sum('grand_total');
                $creditNotes = $group->where('document_type', 'credit_note')->sum('grand_total');
                return [
                    'month' => $month,
                    'total_amount' => round((float) ($sales - $creditNotes), 2),
                    'document_count' => $group->whereIn('document_type', self::REAL_SALES_DOC_TYPES)->count(),
                ];
            })->sortBy('month')->values();
    }

    // GET /api/reports/sales-trend?date_from=&date_to=
    public function salesTrend(Request $request)
    {
        return response()->json(['data' => $this->salesTrendRows($request)]);
    }

    public function exportSalesTrend(Request $request)
    {
        $rows = $this->salesTrendRows($request);
        return Excel::download(new SalesTrendExport($rows), 'sales_trend_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 9. รายงานอัตราการปิดใบเสนอราคา ==================

    // GET /api/reports/quotation-conversion?date_from=&date_to=
    public function quotationConversion(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = SaleDocument::where('company_id', $companyId)->where('document_type', 'quotation');
        if ($request->filled('date_from')) $query->whereDate('issue_date', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('issue_date', '<=', $request->date_to);

        $quotations = $query->get(['id', 'status', 'grand_total']);
        $quotationIds = $quotations->pluck('id');

        $convertedIds = SaleDocument::where('company_id', $companyId)
            ->whereIn('reference_document_id', $quotationIds)
            ->where('status', 'Approved')
            ->pluck('reference_document_id')
            ->unique();

        $totalQuotations = $quotations->count();
        $convertedCount = $convertedIds->count();
        $convertedAmount = $quotations->whereIn('id', $convertedIds)->sum('grand_total');

        return response()->json(['data' => [
            'total_quotations' => $totalQuotations,
            'converted_count' => $convertedCount,
            'conversion_rate' => $totalQuotations > 0 ? round($convertedCount / $totalQuotations * 100, 1) : 0,
            'total_quotation_amount' => round((float) $quotations->sum('grand_total'), 2),
            'converted_amount' => round((float) $convertedAmount, 2),
        ]]);
    }

    // ================== 10. รายงานยอดขายตามพนักงานขาย ==================

    private function salesBySalespersonRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = SaleDocument::where('company_id', $companyId)
            ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
            ->where('status', 'Approved')
            ->whereNotNull('saleman_code')
            ->where('saleman_code', '!=', '');
        if ($request->filled('date_from')) $query->whereDate('issue_date', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('issue_date', '<=', $request->date_to);

        return $query->selectRaw('saleman_code, COUNT(*) as document_count, SUM(grand_total) as total_amount')
            ->groupBy('saleman_code')
            ->orderByDesc('total_amount')
            ->get();
    }

    // GET /api/reports/sales-by-salesperson?date_from=&date_to=
    public function salesBySalesperson(Request $request)
    {
        return response()->json(['data' => $this->salesBySalespersonRows($request)]);
    }

    public function exportSalesBySalesperson(Request $request)
    {
        $rows = $this->salesBySalespersonRows($request);
        return Excel::download(new SalesBySalespersonExport($rows), 'sales_by_salesperson_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 11. รายงานกำไรขั้นต้นต่อรายการขาย ==================

    // 🛡️ ตัดแถวส่วนประกอบของสินค้าชุด (parent_item_id ไม่ว่าง) ออก เพราะ unit_price ถูกบังคับเป็น 0 เสมอ
    // (ยอดขายจริงอยู่ที่แถวแม่สินค้าชุดแล้ว) นับซ้ำจะทำให้ต้นทุนส่วนประกอบโผล่มาเป็น margin ติดลบหลอกๆ
    private function salesMarginRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = SaleDocumentItem::whereNull('parent_item_id')
            ->whereHas('saleDocument', function ($q) use ($request, $companyId) {
                $q->where('company_id', $companyId)
                    ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
                    ->where('status', 'Approved');
                if ($request->filled('date_from')) $q->whereDate('issue_date', '>=', $request->date_from);
                if ($request->filled('date_to')) $q->whereDate('issue_date', '<=', $request->date_to);
            });

        $items = $query->with('product:id,name,sku')->get(['id', 'sale_document_id', 'product_id', 'quantity', 'total_price']);
        $avgCostByProduct = $this->averageCostByProduct($companyId);

        return $items->groupBy('product_id')->map(function ($group) use ($avgCostByProduct) {
            $productId = $group->first()->product_id;
            $qty = (float) $group->sum('quantity');
            $saleAmount = round((float) $group->sum('total_price'), 2);
            $avgCost = $avgCostByProduct[$productId] ?? null;
            $costAmount = $avgCost !== null ? round($qty * $avgCost, 2) : null;
            return [
                'product' => $group->first()->product,
                'qty' => $qty,
                'sale_amount' => $saleAmount,
                'cost_amount' => $costAmount,
                'margin_amount' => $costAmount !== null ? round($saleAmount - $costAmount, 2) : null,
                'margin_pct' => ($costAmount !== null && $saleAmount > 0) ? round(($saleAmount - $costAmount) / $saleAmount * 100, 1) : null,
            ];
        })->sortByDesc('sale_amount')->values();
    }

    // GET /api/reports/sales-margin?date_from=&date_to=
    public function salesMargin(Request $request)
    {
        $rows = $this->salesMarginRows($request);
        return response()->json(['data' => [
            'rows' => $rows,
            'total_sale_amount' => round((float) $rows->sum('sale_amount'), 2),
            'total_cost_amount' => round((float) $rows->sum(fn($r) => $r['cost_amount'] ?? 0), 2),
            'total_margin_amount' => round((float) $rows->sum(fn($r) => $r['margin_amount'] ?? 0), 2),
        ]]);
    }

    public function exportSalesMargin(Request $request)
    {
        $rows = $this->salesMarginRows($request);
        return Excel::download(new SalesMarginExport($rows), 'sales_margin_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 12. รายงานซัพพลายเออร์อันดับต้น ==================

    private function topSuppliersRows(Request $request)
    {
        $limit = (int) $request->get('limit', 20);
        $companyId = auth()->user()->company_id;
        $query = PurchaseOrder::where('company_id', $companyId)
            ->whereIn('status', ['Approved', 'Completed'])
            ->whereNotNull('contact_id');
        if ($request->filled('date_from')) $query->whereDate('created_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('created_at', '<=', $request->date_to);

        return $query->selectRaw('contact_id, COUNT(*) as document_count, SUM(grand_total) as total_amount')
            ->groupBy('contact_id')
            ->orderByDesc('total_amount')
            ->limit($limit)
            ->with('contact:id,business_name,contact_person_name')
            ->get();
    }

    // GET /api/reports/top-suppliers?date_from=&date_to=&limit=20
    public function topSuppliers(Request $request)
    {
        return response()->json(['data' => $this->topSuppliersRows($request)]);
    }

    public function exportTopSuppliers(Request $request)
    {
        $rows = $this->topSuppliersRows($request);
        return Excel::download(new TopSuppliersExport($rows), 'top_suppliers_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 13. รายงาน PO ค้างรับ/ยังไม่ครบ ==================

    private function poBackorderRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = PurchaseOrder::where('company_id', $companyId)->where('status', '!=', 'Cancelled');
        if ($request->filled('date_from')) $query->whereDate('created_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('created_at', '<=', $request->date_to);
        if ($request->filled('contact_id')) $query->where('contact_id', $request->contact_id);

        $orders = $query->with(['contact:id,business_name,contact_person_name', 'items.product:id,name,sku'])
            ->get(['id', 'po_number', 'contact_id', 'status', 'created_at']);

        return $orders->map(function ($po) {
            $items = $po->items->map(fn($item) => [
                'product' => $item->product,
                'ordered_qty' => (float) $item->quantity,
                'received_qty' => (float) $item->received_quantity,
                'backorder_qty' => max(0, (float) $item->quantity - (float) $item->received_quantity),
            ])->filter(fn($i) => $i['backorder_qty'] > 0)->values();

            if ($items->isEmpty()) return null;

            return [
                'po_number' => $po->po_number,
                'contact' => $po->contact,
                'status' => $po->status,
                'items' => $items,
                'total_backorder_qty' => (float) $items->sum('backorder_qty'),
            ];
        })->filter()->values();
    }

    // GET /api/reports/po-backorder?date_from=&date_to=&contact_id=
    public function poBackorder(Request $request)
    {
        return response()->json(['data' => $this->poBackorderRows($request)]);
    }

    public function exportPoBackorder(Request $request)
    {
        $rows = $this->poBackorderRows($request);
        return Excel::download(new PoBackorderExport($rows), 'po_backorder_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 14. เปรียบเทียบราคาซื้อต่อซัพพลายเออร์ต่อสินค้า ==================

    // 🛡️ ต้องระบุ product_id เสมอ (ราคาต่อสินค้า×ซัพพลายเออร์ปนกันทั้งบริษัทจะมากเกินจะแสดงเป็นตารางเดียวได้)
    private function supplierPriceComparisonRows(Request $request)
    {
        if (!$request->filled('product_id')) {
            return collect();
        }

        $companyId = auth()->user()->company_id;
        $items = GoodsReceiptItem::where('product_id', $request->product_id)
            ->whereNotNull('unit_price')
            ->whereHas('goodsReceipt', fn($q) => $q->where('company_id', $companyId)->where('status', '!=', 'Cancelled'))
            ->with(['goodsReceipt.contact:id,business_name,contact_person_name', 'goodsReceipt.purchaseOrder.contact:id,business_name,contact_person_name'])
            ->get();

        return $items->groupBy(function ($item) {
            return $item->goodsReceipt->contact_id ?? $item->goodsReceipt->purchaseOrder->contact_id ?? 0;
        })->map(function ($group) {
            $first = $group->first();
            $contact = $first->goodsReceipt->contact ?? $first->goodsReceipt->purchaseOrder->contact ?? null;
            $qty = $group->sum('quantity');
            $cost = $group->sum(fn($i) => $i->quantity * $i->unit_price);
            return [
                'contact' => $contact,
                'total_qty' => (float) $qty,
                'avg_unit_price' => $qty > 0 ? round($cost / $qty, 2) : null,
                'receipt_count' => $group->count(),
            ];
        })->filter(fn($row) => $row['contact'] !== null)
            ->sortBy('avg_unit_price')
            ->values();
    }

    // GET /api/reports/supplier-price-comparison?product_id=
    public function supplierPriceComparison(Request $request)
    {
        return response()->json(['data' => $this->supplierPriceComparisonRows($request)]);
    }

    public function exportSupplierPriceComparison(Request $request)
    {
        $rows = $this->supplierPriceComparisonRows($request);
        return Excel::download(new SupplierPriceComparisonExport($rows), 'supplier_price_comparison_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 15. รายงานอายุเจ้าหนี้ (AP Aging) ==================

    private function apAgingRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = PurchaseOrder::where('company_id', $companyId)
            ->whereIn('status', ['Approved', 'Completed'])
            ->whereNotNull('due_date');
        if ($request->filled('contact_id')) $query->where('contact_id', $request->contact_id);

        $orders = $query->with('contact:id,business_name,contact_person_name')
            ->get(['id', 'contact_id', 'po_number', 'due_date', 'grand_total']);

        $today = now()->startOfDay();
        return $orders->groupBy('contact_id')->map(function ($group) use ($today) {
            $buckets = ['b0_30' => 0.0, 'b31_60' => 0.0, 'b61_90' => 0.0, 'b90_plus' => 0.0];
            foreach ($group as $po) {
                $due = \Carbon\Carbon::parse($po->due_date)->startOfDay();
                $daysOverdue = $due->lt($today) ? $due->diffInDays($today) : 0;
                $amount = (float) $po->grand_total;
                if ($daysOverdue <= 30) $buckets['b0_30'] += $amount;
                elseif ($daysOverdue <= 60) $buckets['b31_60'] += $amount;
                elseif ($daysOverdue <= 90) $buckets['b61_90'] += $amount;
                else $buckets['b90_plus'] += $amount;
            }
            return [
                'contact' => $group->first()->contact,
                'buckets' => $buckets,
                'total' => round(array_sum($buckets), 2),
            ];
        })->sortByDesc('total')->values();
    }

    // GET /api/reports/ap-aging?contact_id=
    public function apAging(Request $request)
    {
        $rows = $this->apAgingRows($request);
        $totals = ['b0_30' => 0.0, 'b31_60' => 0.0, 'b61_90' => 0.0, 'b90_plus' => 0.0];
        foreach ($rows as $row) {
            foreach ($totals as $key => $v) $totals[$key] += $row['buckets'][$key];
        }

        return response()->json(['data' => [
            'rows' => $rows,
            'totals' => $totals,
        ]]);
    }

    public function exportApAging(Request $request)
    {
        $rows = $this->apAgingRows($request);
        return Excel::download(new ApAgingExport($rows), 'ap_aging_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 16. รายงานสินค้าใกล้หมด/ต้องสั่งเพิ่ม ==================

    private function lowStockRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $productQuery = Product::where('company_id', $companyId)->whereNotNull('low_stock_threshold');
        if ($request->filled('category_id')) $productQuery->where('category_id', $request->category_id);
        $products = $productQuery->with('category:id,name')->get(['id', 'name', 'sku', 'low_stock_threshold', 'category_id']);

        $balanceByProduct = StockBalance::where('company_id', $companyId)
            ->selectRaw('product_id, SUM(qty) as total_qty, SUM(reserved_qty) as total_reserved_qty')
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id');

        // 🛡️ เช็คเทียบกับ "พร้อมใช้จริง" (qty - reserved_qty) ไม่ใช่ qty ดิบ — ของที่ถูกจองไว้แล้วนับว่าใช้ไม่ได้จริง
        return $products->map(function ($product) use ($balanceByProduct) {
            $qty = (int) ($balanceByProduct[$product->id]->total_qty ?? 0);
            $reservedQty = (int) ($balanceByProduct[$product->id]->total_reserved_qty ?? 0);
            $availableQty = $qty - $reservedQty;
            $threshold = (int) $product->low_stock_threshold;
            return [
                'product' => $product,
                'qty' => $qty,
                'reserved_qty' => $reservedQty,
                'available_qty' => $availableQty,
                'threshold' => $threshold,
                'shortage' => max(0, $threshold - $availableQty),
            ];
        })->filter(fn($row) => $row['available_qty'] <= $row['threshold'])->sortBy('available_qty')->values();
    }

    // GET /api/reports/low-stock?category_id=
    public function lowStock(Request $request)
    {
        return response()->json(['data' => $this->lowStockRows($request)]);
    }

    public function exportLowStock(Request $request)
    {
        $rows = $this->lowStockRows($request);
        return Excel::download(new LowStockExport($rows), 'low_stock_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 17. รายงานความเคลื่อนไหวสต๊อก (ทะเบียนธุรกรรม) ==================

    private function stockMovementLedgerQuery(Request $request)
    {
        $query = StockMovement::where('company_id', auth()->user()->company_id);
        if ($request->filled('date_from')) $query->whereDate('created_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('created_at', '<=', $request->date_to);
        if ($request->filled('product_id')) $query->where('product_id', $request->product_id);
        if ($request->filled('warehouse_id')) $query->where('warehouse_id', $request->warehouse_id);
        if ($request->filled('type')) $query->where('type', $request->type);
        return $query;
    }

    // GET /api/reports/stock-movement-ledger?date_from=&date_to=&product_id=&warehouse_id=&type=
    public function stockMovementLedger(Request $request)
    {
        $rows = $this->stockMovementLedgerQuery($request)
            ->with(['product:id,name,sku', 'warehouse:id,name', 'user:id,name'])
            ->latest()
            ->limit(500)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function exportStockMovementLedger(Request $request)
    {
        $rows = $this->stockMovementLedgerQuery($request)
            ->with(['product:id,name,sku', 'warehouse:id,name', 'user:id,name'])
            ->latest()
            ->get();

        return Excel::download(new StockMovementLedgerExport($rows), 'stock_movement_ledger_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 18. รายงานสต๊อกแยกตามคลัง ==================

    private function stockByWarehouseRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = StockBalance::where('company_id', $companyId)->where('qty', '>', 0);
        if ($request->filled('warehouse_id')) $query->where('warehouse_id', $request->warehouse_id);

        $balances = $query->with(['product:id,name,sku', 'warehouse:id,name'])->get();

        return $balances->groupBy('warehouse_id')->map(function ($group) {
            return [
                'warehouse' => $group->first()->warehouse,
                'total_qty' => (float) $group->sum('qty'),
                'total_reserved_qty' => (float) $group->sum('reserved_qty'),
                'product_count' => $group->count(),
                'items' => $group->map(fn($b) => [
                    'product' => $b->product,
                    'qty' => (float) $b->qty,
                    'reserved_qty' => (float) $b->reserved_qty,
                    'available_qty' => (float) $b->qty - (float) $b->reserved_qty,
                ])->sortByDesc('qty')->values(),
            ];
        })->values();
    }

    // GET /api/reports/stock-by-warehouse?warehouse_id=
    public function stockByWarehouse(Request $request)
    {
        return response()->json(['data' => $this->stockByWarehouseRows($request)]);
    }

    public function exportStockByWarehouse(Request $request)
    {
        $rows = $this->stockByWarehouseRows($request);
        return Excel::download(new StockByWarehouseExport($rows), 'stock_by_warehouse_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 19. รายงานสินค้าเคลื่อนไหวช้า/ค้างสต๊อกนาน ==================

    // 🛡️ นับเฉพาะสินค้าที่ยังมีสต๊อกอยู่จริง (qty > 0) เทียบกับวันที่ "เบิกออก" (type=out) ล่าสุด
    // ถ้าไม่เคยเบิกออกเลยตั้งแต่มีสต๊อก ก็ถือว่าค้างสต๊อกเช่นกัน (last_out_at = null)
    private function slowMovingStockRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $days = (int) $request->get('days', 90);
        $cutoff = now()->subDays($days);

        $qtyByProduct = StockBalance::where('company_id', $companyId)
            ->selectRaw('product_id, SUM(qty) as total_qty')
            ->groupBy('product_id')
            ->havingRaw('SUM(qty) > 0')
            ->pluck('total_qty', 'product_id');

        if ($qtyByProduct->isEmpty()) {
            return collect();
        }

        $lastOutByProduct = StockMovement::where('company_id', $companyId)
            ->where('type', 'out')
            ->whereIn('product_id', $qtyByProduct->keys())
            ->selectRaw('product_id, MAX(created_at) as last_out_at')
            ->groupBy('product_id')
            ->pluck('last_out_at', 'product_id');

        $products = Product::whereIn('id', $qtyByProduct->keys())
            ->with('category:id,name')
            ->get(['id', 'name', 'sku', 'category_id'])
            ->keyBy('id');

        return $qtyByProduct->map(function ($qty, $productId) use ($lastOutByProduct, $products, $cutoff) {
            $lastOut = $lastOutByProduct[$productId] ?? null;
            $isSlow = $lastOut === null || \Carbon\Carbon::parse($lastOut)->lt($cutoff);
            if (!$isSlow) return null;

            return [
                'product' => $products[$productId] ?? null,
                'qty' => (float) $qty,
                'last_out_at' => $lastOut,
                'days_since_out' => $lastOut ? (int) \Carbon\Carbon::parse($lastOut)->diffInDays(now()) : null,
            ];
        })->filter()->sortByDesc(fn($row) => $row['days_since_out'] ?? PHP_INT_MAX)->values();
    }

    // GET /api/reports/slow-moving-stock?days=90
    public function slowMovingStock(Request $request)
    {
        return response()->json(['data' => $this->slowMovingStockRows($request)]);
    }

    public function exportSlowMovingStock(Request $request)
    {
        $rows = $this->slowMovingStockRows($request);
        return Excel::download(new SlowMovingStockExport($rows), 'slow_moving_stock_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 20. รายงานประกันใกล้หมดอายุ ==================

    private function upcomingWarrantyExpiryRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $days = (int) $request->get('days', 60);
        $query = InstallationRecord::where('company_id', $companyId)
            ->whereNotNull('warranty_expires_at')
            ->whereDate('warranty_expires_at', '<=', now()->addDays($days));

        return $query->with(['contact:id,business_name,contact_person_name', 'product:id,name,sku'])
            ->orderBy('warranty_expires_at')
            ->get(['id', 'installation_number', 'contact_id', 'product_id', 'site_name', 'warranty_expires_at'])
            ->map(fn($record) => [
                'record' => $record,
                'is_expired' => \Carbon\Carbon::parse($record->warranty_expires_at)->isPast(),
            ]);
    }

    // GET /api/reports/warranty-expiry?days=60
    public function warrantyExpiry(Request $request)
    {
        return response()->json(['data' => $this->upcomingWarrantyExpiryRows($request)]);
    }

    public function exportWarrantyExpiry(Request $request)
    {
        $rows = $this->upcomingWarrantyExpiryRows($request);
        return Excel::download(new WarrantyExpiryExport($rows), 'warranty_expiry_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 21. รายงานเวลาซ่อมเฉลี่ย ==================

    private function repairTurnaroundRows(Request $request)
    {
        $query = RepairTicket::where('company_id', auth()->user()->company_id)->whereNotNull('returned_at');
        if ($request->filled('date_from')) $query->whereDate('received_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('received_at', '<=', $request->date_to);

        return $query->with('contact:id,business_name,contact_person_name')
            ->get(['id', 'ticket_number', 'contact_id', 'received_at', 'returned_at', 'repair_cost'])
            ->map(fn($ticket) => [
                'ticket' => $ticket,
                'turnaround_days' => \Carbon\Carbon::parse($ticket->received_at)->diffInDays(\Carbon\Carbon::parse($ticket->returned_at)),
            ]);
    }

    // GET /api/reports/repair-turnaround?date_from=&date_to=
    public function repairTurnaround(Request $request)
    {
        $rows = $this->repairTurnaroundRows($request);
        return response()->json(['data' => [
            'rows' => $rows->sortByDesc('turnaround_days')->values(),
            'avg_turnaround_days' => $rows->count() > 0 ? round($rows->avg('turnaround_days'), 1) : 0,
        ]]);
    }

    public function exportRepairTurnaround(Request $request)
    {
        $rows = $this->repairTurnaroundRows($request);
        return Excel::download(new RepairTurnaroundExport($rows), 'repair_turnaround_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 22. แนวโน้มค่าซ่อมรายเดือน ==================

    // GET /api/reports/repair-cost-trend?date_from=&date_to=
    public function repairCostTrend(Request $request)
    {
        $query = RepairTicket::where('company_id', auth()->user()->company_id)->whereNotNull('received_at');
        if ($request->filled('date_from')) $query->whereDate('received_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('received_at', '<=', $request->date_to);

        $tickets = $query->get(['received_at', 'repair_cost']);

        $rows = $tickets->groupBy(fn($t) => \Carbon\Carbon::parse($t->received_at)->format('Y-m'))
            ->map(fn($group, $month) => [
                'month' => $month,
                'ticket_count' => $group->count(),
                'total_cost' => round((float) $group->sum('repair_cost'), 2),
            ])->sortBy('month')->values();

        return response()->json(['data' => $rows]);
    }

    // ================== 23. รายงานสินทรัพย์ถาวรใกล้ครบกำหนดบำรุงรักษา ==================

    private function assetMaintenanceDueRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $days = (int) $request->get('days', 30);
        $query = Asset::where('company_id', $companyId)
            ->where('status', '!=', 'retired')
            ->whereNotNull('next_maintenance_date')
            ->whereDate('next_maintenance_date', '<=', now()->addDays($days));

        return $query->with('responsibleUser:id,name')
            ->orderBy('next_maintenance_date')
            ->get()
            ->map(fn($asset) => [
                'asset' => $asset,
                'is_overdue' => \Carbon\Carbon::parse($asset->next_maintenance_date)->isPast(),
            ]);
    }

    // GET /api/reports/asset-maintenance-due?days=30
    public function assetMaintenanceDue(Request $request)
    {
        return response()->json(['data' => $this->assetMaintenanceDueRows($request)]);
    }

    // ================== 24. รายงานกำไร-ขาดทุนต่อโครงการ (ภาพรวมทุกโครงการ) ==================

    // 🛡️ [2026-09-11] เปลี่ยนจากเดิมที่เทียบ "ยอดเอกสารขายทั้งใบ" กับ "ยอด PO ทั้งใบ" (ไม่ใช่ต้นทุนของสินค้า
    // ที่ขายออกไปจริง และไม่ครอบคลุมสินค้าที่ดึงจากสต๊อกเดิมที่ไม่มี PO ผูกกับโครงการเลย) มาเป็นการเทียบ
    // "ราคาขาย" กับ "ราคาทุน" ต่อรายการสินค้าที่ขายจริงในโครงการ (ยืนยันกับผู้ใช้แล้ว) — ลำดับหาต้นทุนต่อหน่วย:
    // 1) ถ้าสินค้านั้นมีอยู่ใน PO ที่ผูกกับโครงการนี้ ใช้ราคาถัวเฉลี่ยถ่วงน้ำหนักจาก PO ของโครงการนี้ (บาง
    //    โครงการสั่งสินค้าเฉพาะงาน ราคาจริงอาจต่างจากค่าเฉลี่ยทั้งบริษัท)
    // 2) ถ้าไม่มีใน PO ของโครงการนี้เลย (ดึงจากสต๊อกเดิม) fallback เป็นต้นทุนถัวเฉลี่ยทั้งบริษัท
    //    (averageCostByProduct() เดิม)
    // และรวมค่าใช้จ่ายผู้รับเหมา (contractor_work_orders) ที่ผูกกับโครงการเข้าเป็นต้นทุนด้วย (เดิมไม่เคยรวม
    // เลยทั้งที่ตารางนี้ผูก project_id ไว้แล้ว)
    //
    // "รายได้" เปลี่ยนจาก SUM(sale_documents.grand_total) (รวม VAT) เป็น SUM(sale_document_items.total_price)
    // (ไม่รวม VAT) ให้สอดคล้องกับนิยาม "ราคาขาย" ที่ salesMarginRows()/companyMarginTrendRows() ใช้อยู่แล้ว
    // — ตัวเลขรายได้ในรายงานนี้จะเปลี่ยนไปจากก่อนแก้เล็กน้อย (ไม่รวม VAT อีกต่อไป)
    private function projectProfitabilityRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $projects = Project::where('company_id', $companyId)->get(['id', 'name', 'status']);

        // 🛡️ query รวมทีเดียวทุกโครงการ (group by project_id + product_id) แทนการยิงต่อโครงการในลูป กัน N+1
        $soldRows = SaleDocumentItem::whereNull('parent_item_id') // ตัดแถวส่วนประกอบสินค้าชุดออกเหมือน salesMarginRows()
            ->join('sale_documents', 'sale_documents.id', '=', 'sale_document_items.sale_document_id')
            ->where('sale_documents.company_id', $companyId)
            ->whereIn('sale_documents.document_type', self::REAL_SALES_DOC_TYPES)
            ->where('sale_documents.status', 'Approved')
            ->whereNotNull('sale_documents.project_id')
            ->selectRaw('sale_documents.project_id as project_id, sale_document_items.product_id as product_id, SUM(sale_document_items.quantity) as qty_sold, SUM(sale_document_items.total_price) as sale_amount')
            ->groupBy('sale_documents.project_id', 'sale_document_items.product_id')
            ->get()
            ->groupBy('project_id');

        // 🛡️ ต้นทุนจาก PO เฉลี่ยถ่วงน้ำหนักต่อ (โครงการ, สินค้า) — คนละชุดกับ averageCostByProduct ที่เฉลี่ย
        // ทั้งบริษัทไม่แยกโครงการ
        $poCostRows = PurchaseOrderItem::join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->where('purchase_orders.company_id', $companyId)
            ->whereIn('purchase_orders.status', ['Approved', 'Completed'])
            ->whereNotNull('purchase_orders.project_id')
            ->selectRaw('purchase_orders.project_id as project_id, purchase_order_items.product_id as product_id, SUM(purchase_order_items.quantity * purchase_order_items.unit_price) as total_cost, SUM(purchase_order_items.quantity) as total_qty')
            ->groupBy('purchase_orders.project_id', 'purchase_order_items.product_id')
            ->get()
            ->groupBy('project_id')
            ->map(fn($rows) => $rows->keyBy('product_id'));

        $avgCostByProduct = $this->averageCostByProduct($companyId);

        $contractorCostByProject = ContractorWorkOrder::where('company_id', $companyId)
            ->where('status', 'Approved') // 🛡️ นับเฉพาะที่อนุมัติแล้ว เหมือนเงื่อนไข PO/SaleDocument ข้างต้น
            ->whereNotNull('project_id')
            ->selectRaw('project_id, SUM(grand_total) as total_cost')
            ->groupBy('project_id')
            ->pluck('total_cost', 'project_id');

        return $projects->map(function ($project) use ($soldRows, $poCostRows, $avgCostByProduct, $contractorCostByProject) {
            $itemRows = $soldRows[$project->id] ?? collect();
            $poCostByProduct = $poCostRows[$project->id] ?? collect();

            $revenue = (float) $itemRows->sum('sale_amount');
            $productCost = $itemRows->sum(function ($row) use ($poCostByProduct, $avgCostByProduct) {
                $poRow = $poCostByProduct[$row->product_id] ?? null;
                $unitCost = $poRow && $poRow->total_qty > 0
                    ? $poRow->total_cost / $poRow->total_qty
                    : ($avgCostByProduct[$row->product_id] ?? 0);
                return $row->qty_sold * $unitCost;
            });
            $contractorCost = (float) ($contractorCostByProject[$project->id] ?? 0);
            $cost = $productCost + $contractorCost;

            return [
                'project' => $project,
                'revenue' => round($revenue, 2),
                'cost' => round($cost, 2),
                'profit' => round($revenue - $cost, 2),
                'margin_pct' => $revenue > 0 ? round(($revenue - $cost) / $revenue * 100, 1) : null,
            ];
        })->filter(fn($row) => $row['revenue'] > 0 || $row['cost'] > 0)->sortByDesc('profit')->values();
    }

    // GET /api/reports/project-profitability
    public function projectProfitability(Request $request)
    {
        return response()->json(['data' => $this->projectProfitabilityRows($request)]);
    }

    public function exportProjectProfitability(Request $request)
    {
        $rows = $this->projectProfitabilityRows($request);
        return Excel::download(new ProjectProfitabilityExport($rows), 'project_profitability_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 25. รายงานงานเช่า ==================

    private function rentalJobsReportRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = RentalJob::where('company_id', $companyId);
        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('date_from')) $query->whereDate('start_date', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('start_date', '<=', $request->date_to);

        $jobs = $query->with('contact:id,business_name,contact_person_name')
            ->get(['id', 'name', 'contact_id', 'status', 'start_date', 'end_date']);

        $revenueByJob = SaleDocument::where('company_id', $companyId)
            ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
            ->where('status', 'Approved')
            ->whereNotNull('rental_job_id')
            ->selectRaw('rental_job_id, SUM(grand_total) as total_revenue')
            ->groupBy('rental_job_id')
            ->pluck('total_revenue', 'rental_job_id');

        return $jobs->map(fn($job) => [
            'job' => $job,
            'revenue' => round((float) ($revenueByJob[$job->id] ?? 0), 2),
        ])->sortByDesc('revenue')->values();
    }

    // GET /api/reports/rental-jobs?status=&date_from=&date_to=
    public function rentalJobsReport(Request $request)
    {
        return response()->json(['data' => $this->rentalJobsReportRows($request)]);
    }

    public function exportRentalJobs(Request $request)
    {
        $rows = $this->rentalJobsReportRows($request);
        return Excel::download(new RentalJobsExport($rows), 'rental_jobs_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 26. รายงานอุปกรณ์เช่าค้างคืน ==================

    // 🛡️ เทียบ ProductSerial ที่ยังอยู่สถานะ 'rented' กับ end_date ของ RentalJob ที่ผูกผ่านเอกสารเบิกเช่า
    // (ระบบยังไม่มีวันครบกำหนดคืนต่อ item จึงใช้ end_date ระดับงานเช่าเป็นตัวเทียบตามที่วิเคราะห์ไว้)
    private function overdueRentalsRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $today = now()->startOfDay();

        return ProductSerial::where('company_id', $companyId)
            ->where('status', 'rented')
            ->whereNotNull('rented_via_sale_document_id')
            ->with([
                'product:id,name,sku',
                'rentedViaSaleDocument:id,rental_job_id,contact_id',
                'rentedViaSaleDocument.rentalJob:id,name,end_date',
                'rentedViaSaleDocument.contact:id,business_name,contact_person_name',
            ])
            ->get()
            ->filter(fn($serial) => $serial->rentedViaSaleDocument?->rentalJob?->end_date
                && \Carbon\Carbon::parse($serial->rentedViaSaleDocument->rentalJob->end_date)->lt($today))
            ->map(fn($serial) => [
                'serial' => $serial,
                'rental_job' => $serial->rentedViaSaleDocument->rentalJob,
                'contact' => $serial->rentedViaSaleDocument->contact,
                'days_overdue' => (int) \Carbon\Carbon::parse($serial->rentedViaSaleDocument->rentalJob->end_date)->diffInDays($today),
            ])->sortByDesc('days_overdue')->values();
    }

    // GET /api/reports/overdue-rentals
    public function overdueRentals(Request $request)
    {
        return response()->json(['data' => $this->overdueRentalsRows($request)]);
    }

    public function exportOverdueRentals(Request $request)
    {
        $rows = $this->overdueRentalsRows($request);
        return Excel::download(new OverdueRentalsExport($rows), 'overdue_rentals_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 27. รายงานงานติดตั้งแยกตามโครงการ ==================

    // GET /api/reports/installations-by-project?date_from=&date_to=
    public function installationsByProject(Request $request)
    {
        $query = InstallationRecord::where('company_id', auth()->user()->company_id);
        if ($request->filled('date_from')) $query->whereDate('scheduled_at', '>=', $request->date_from);
        if ($request->filled('date_to')) $query->whereDate('scheduled_at', '<=', $request->date_to);

        $records = $query->with(['project:id,name', 'contact:id,business_name,contact_person_name'])
            ->get(['id', 'project_id', 'contact_id', 'site_name', 'status']);

        $rows = $records->groupBy('project_id')->map(function ($group) {
            return [
                'project' => $group->first()->project,
                'total' => $group->count(),
                'by_status' => $group->groupBy('status')->map->count(),
            ];
        })->sortByDesc('total')->values();

        return response()->json(['data' => $rows]);
    }

    // ================== 28. รายงานกำไรขั้นต้นรวมบริษัท + แนวโน้มรายเดือน ==================

    private function companyMarginTrendRows(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $query = SaleDocumentItem::whereNull('parent_item_id')
            ->whereHas('saleDocument', function ($q) use ($companyId, $request) {
                $q->where('company_id', $companyId)
                    ->whereIn('document_type', self::REAL_SALES_DOC_TYPES)
                    ->where('status', 'Approved');
                if ($request->filled('date_from')) $q->whereDate('issue_date', '>=', $request->date_from);
                if ($request->filled('date_to')) $q->whereDate('issue_date', '<=', $request->date_to);
            });

        $items = $query->with('saleDocument:id,issue_date')->get(['id', 'sale_document_id', 'product_id', 'quantity', 'total_price']);
        $avgCostByProduct = $this->averageCostByProduct($companyId);

        return $items->groupBy(fn($item) => \Carbon\Carbon::parse($item->saleDocument->issue_date)->format('Y-m'))
            ->map(function ($group, $month) use ($avgCostByProduct) {
                $saleAmount = (float) $group->sum('total_price');
                $costAmount = (float) $group->sum(function ($item) use ($avgCostByProduct) {
                    $avgCost = $avgCostByProduct[$item->product_id] ?? null;
                    return $avgCost !== null ? $item->quantity * $avgCost : 0;
                });
                return [
                    'month' => $month,
                    'sale_amount' => round($saleAmount, 2),
                    'cost_amount' => round($costAmount, 2),
                    'margin_amount' => round($saleAmount - $costAmount, 2),
                ];
            })->sortBy('month')->values();
    }

    // GET /api/reports/company-margin-trend?date_from=&date_to=
    public function companyMarginTrend(Request $request)
    {
        return response()->json(['data' => $this->companyMarginTrendRows($request)]);
    }

    public function exportCompanyMarginTrend(Request $request)
    {
        $rows = $this->companyMarginTrendRows($request);
        return Excel::download(new CompanyMarginTrendExport($rows), 'company_margin_trend_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 29. สรุปกระแสเงินสดคร่าวๆ ==================

    // 🛡️ ประมาณจากเอกสารที่มีอยู่จริง ไม่ใช่บัญชีเงินสดจริง (ระบบไม่มีโมดูลบัญชี/ธนาคารแยก)
    // ยอดรับ = เอกสารประเภทรับเงินทันที (cash/receipt) ที่อนุมัติแล้ว, ยอดจ่าย = PO ที่ยืนยัน/รับของครบแล้ว
    private function cashPositionRows(Request $request)
    {
        $companyId = auth()->user()->company_id;

        $inDocs = SaleDocument::where('company_id', $companyId)
            ->whereIn('document_type', ['cash', 'receipt'])
            ->where('status', 'Approved')
            ->get(['issue_date', 'grand_total']);

        $outDocs = PurchaseOrder::where('company_id', $companyId)
            ->whereIn('status', ['Approved', 'Completed'])
            ->get(['created_at', 'grand_total']);

        $inByMonth = $inDocs->groupBy(fn($d) => \Carbon\Carbon::parse($d->issue_date)->format('Y-m'))
            ->map(fn($g) => (float) $g->sum('grand_total'));
        $outByMonth = $outDocs->groupBy(fn($d) => \Carbon\Carbon::parse($d->created_at)->format('Y-m'))
            ->map(fn($g) => (float) $g->sum('grand_total'));

        $months = $inByMonth->keys()->merge($outByMonth->keys())->unique()->sort()->values();

        return $months->map(fn($month) => [
            'month' => $month,
            'cash_in' => round($inByMonth[$month] ?? 0, 2),
            'cash_out' => round($outByMonth[$month] ?? 0, 2),
            'net' => round(($inByMonth[$month] ?? 0) - ($outByMonth[$month] ?? 0), 2),
        ])->values();
    }

    // GET /api/reports/cash-position
    public function cashPosition(Request $request)
    {
        return response()->json(['data' => $this->cashPositionRows($request)]);
    }

    public function exportCashPosition(Request $request)
    {
        $rows = $this->cashPositionRows($request);
        return Excel::download(new CashPositionExport($rows), 'cash_position_' . now()->format('Ymd_His') . '.xlsx');
    }

    // ================== 30. รายงานเปรียบเทียบ AR vs AP รวม ==================

    // GET /api/reports/ar-ap-comparison
    public function arApComparison(Request $request)
    {
        $arRows = $this->arAgingRows($request);
        $apRows = $this->apAgingRows($request);

        $sumBuckets = function ($rows) {
            $totals = ['b0_30' => 0.0, 'b31_60' => 0.0, 'b61_90' => 0.0, 'b90_plus' => 0.0];
            foreach ($rows as $row) {
                foreach ($totals as $key => $v) $totals[$key] += $row['buckets'][$key];
            }
            return $totals;
        };

        $arTotals = $sumBuckets($arRows);
        $apTotals = $sumBuckets($apRows);

        return response()->json(['data' => [
            'ar' => ['totals' => $arTotals, 'total' => round(array_sum($arTotals), 2)],
            'ap' => ['totals' => $apTotals, 'total' => round(array_sum($apTotals), 2)],
        ]]);
    }
}
