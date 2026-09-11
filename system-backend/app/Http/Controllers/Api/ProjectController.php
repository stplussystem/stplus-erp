<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\SaleDocument;
use App\Models\SaleDocumentItem;
use App\Models\InstallationRecord;
use App\Models\InstallationEquipmentItem;
use App\Models\RepairTicket;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    // Project model ใช้ trait BelongsToCompany อยู่แล้ว จึงคัดกรองแยกบริษัทให้อัตโนมัติ
    public function index()
    {
        return response()->json(Project::orderBy('name')->get());
    }

    public function show($id)
    {
        $project = Project::with(['contact', 'pic'])->findOrFail($id);

        return response()->json(['data' => $project]);
    }

    // GET /api/projects/{id}/summary
    // รวมข้อมูลที่หน้า Project Hub ต้องใช้ในคำขอเดียว: ตัวโครงการ + จำนวน/รายการล่าสุดของเอกสารขายแต่ละประเภท + PO
    public function summary($id)
    {
        $project = Project::with(['contact', 'pic'])->findOrFail($id);

        $saleDocTypes = [
            'quotation', 'material_issue', 'billing_invoice', 'tax_invoice', 'cash',
            'receipt', 'credit_note', 'debit_note', 'delivery_note', 'invoice',
        ];

        $documents = SaleDocument::where('project_id', $id)
            ->select(['id', 'document_type', 'document_number', 'status', 'grand_total', 'issue_date', 'created_at'])
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('document_type');

        $saleDocumentsSummary = collect($saleDocTypes)->mapWithKeys(function ($type) use ($documents) {
            $group = $documents->get($type, collect());

            return [$type => [
                'count' => $group->count(),
                'latest' => $group->take(5)->values(),
            ]];
        });

        $purchaseOrders = PurchaseOrder::where('project_id', $id)
            ->select(['id', 'po_number', 'status', 'grand_total', 'created_at'])
            ->orderByDesc('created_at')
            ->get();

        $installations = InstallationRecord::where('project_id', $id)
            ->select(['id', 'installation_number', 'status', 'room_location', 'site_name', 'installed_at', 'scheduled_at', 'created_at'])
            ->orderByDesc('created_at')
            ->get();

        $repairs = RepairTicket::where('project_id', $id)
            ->select(['id', 'ticket_number', 'status', 'reported_issue', 'received_at', 'created_at'])
            ->orderByDesc('created_at')
            ->get();

        // 🛡️ งานซ่อมที่ยังไม่ปิดงาน (ไม่นับ returned/cancelled ตาม STATUS_TRANSITIONS ใน
        // RepairTicketController — เขียนตรงๆ ไม่ import จากคอนโทรลเลอร์นั้นเพราะ const เป็น private) ใช้เตือน
        // ตอนโครงการถูกปิด (completed) ทั้งที่ยังมีงานซ่อมค้าง — ไม่ query เพิ่ม กรองจาก $repairs ที่โหลดมาแล้ว
        $openRepairsCount = $repairs->whereNotIn('status', ['returned', 'cancelled'])->count();

        // 🛠️ ใบสั่งซื้อ/ใบสั่งจ้าง ผู้รับเหมา — แยกจาก purchase_orders (ซื้อสินค้าเข้าสต๊อก) โดยสิ้นเชิง
        $contractorWorkOrders = \App\Models\ContractorWorkOrder::where('project_id', $id)
            ->select(['id', 'order_number', 'status', 'grand_total', 'created_at'])
            ->orderByDesc('created_at')
            ->get();

        // 📋 ใบคุมสัญญาราชการ — ทะเบียนติดตาม ไม่มีสถานะอนุมัติ (ใช้ guarantee_returned_date แทน grand_total ในการ์ด)
        $governmentContracts = \App\Models\GovernmentContract::where('project_id', $id)
            ->select(['id', 'contract_number', 'agency_name', 'contract_amount', 'guarantee_returned_date', 'created_at'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => [
                'project' => $project,
                'sale_documents' => $saleDocumentsSummary,
                'purchase_orders' => [
                    'count' => $purchaseOrders->count(),
                    'latest' => $purchaseOrders->take(5)->values(),
                ],
                'contractor_work_orders' => [
                    'count' => $contractorWorkOrders->count(),
                    'latest' => $contractorWorkOrders->take(5)->values(),
                ],
                'government_contracts' => [
                    'count' => $governmentContracts->count(),
                    'latest' => $governmentContracts->take(5)->values(),
                ],
                'installations' => [
                    'count' => $installations->count(),
                    'latest' => $installations->take(5)->values(),
                ],
                'repairs' => [
                    'count' => $repairs->count(),
                    'open_count' => $openRepairsCount,
                    'latest' => $repairs->take(5)->values(),
                ],
            ],
        ]);
    }

    // GET /api/projects/{id}/cost-summary — สรุป "ค่าติดตั้ง" (รายได้จากแถวบริการ) กับ "ต้นทุนอุปกรณ์ติดตั้ง"
    // (จากอุปกรณ์ที่เลือกไว้ผ่านหน้า "เลือกอุปกรณ์ที่นำไปติดตั้ง") ของโครงการนี้
    // pattern การ join เดียวกับ InstallationRecordController::installableItems()
    public function costSummary($id)
    {
        $companyId = auth()->user()->company_id;
        $stockOutDocTypes = ['tax_invoice', 'cash', 'receipt'];

        $installationFeeTotal = SaleDocumentItem::query()
            ->join('sale_documents', 'sale_documents.id', '=', 'sale_document_items.sale_document_id')
            ->join('products', 'products.id', '=', 'sale_document_items.product_id')
            ->where('sale_documents.project_id', $id)
            ->where('sale_documents.company_id', $companyId)
            ->whereIn('sale_documents.document_type', $stockOutDocTypes)
            ->where('sale_documents.status', 'Approved')
            ->where('products.product_type', 'service')
            ->sum('sale_document_items.total_price');

        $equipmentCostTotal = InstallationEquipmentItem::where('project_id', $id)
            ->where('company_id', $companyId)
            ->selectRaw('SUM(quantity * unit_cost_snapshot) as total')
            ->value('total');

        return response()->json(['data' => [
            'installation_fee_total' => round((float) $installationFeeTotal, 2),
            'equipment_cost_total' => round((float) $equipmentCostTotal, 2),
        ]]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            // 🛡️ เดิมรับ string อิสระ ไม่มี allow-list เลย ทำให้ตั้งสถานะเป็นค่าที่ frontend ไม่รู้จักได้
            'status' => 'nullable|in:active,completed,on_hold,cancelled',
            // 🪜 ขั้นตอนงาน — แยกจาก status เดิมโดยสิ้นเชิง (ตั้งเองในหน้าแก้ไข ใช้แสดง stepper ในหน้าดูข้อมูล)
            'stage' => 'nullable|in:quotation,purchasing,sales_order,delivery,installation',
            'contact_id' => 'nullable|exists:contacts,id',
            'pic_user_id' => 'nullable|exists:users,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $project = Project::create([
            'company_id' => $request->user()->company_id,
            'name' => $request->name,
            'description' => $request->description,
            'status' => $request->status ?? 'active',
            'stage' => $request->stage,
            'contact_id' => $request->contact_id,
            'pic_user_id' => $request->pic_user_id,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
        ]);

        return response()->json([
            'message' => 'เพิ่มโครงการสำเร็จ',
            'data' => $project,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            // 🛡️ เดิมรับ string อิสระ ไม่มี allow-list เลย ทำให้ตั้งสถานะเป็นค่าที่ frontend ไม่รู้จักได้
            'status' => 'nullable|in:active,completed,on_hold,cancelled',
            // 🪜 ขั้นตอนงาน — แยกจาก status เดิมโดยสิ้นเชิง (ตั้งเองในหน้าแก้ไข ใช้แสดง stepper ในหน้าดูข้อมูล)
            'stage' => 'nullable|in:quotation,purchasing,sales_order,delivery,installation',
            'contact_id' => 'nullable|exists:contacts,id',
            'pic_user_id' => 'nullable|exists:users,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $project = Project::findOrFail($id);
        $project->update($request->only([
            'name', 'description', 'status', 'stage', 'contact_id', 'pic_user_id', 'start_date', 'end_date',
        ]));

        return response()->json([
            'message' => 'อัปเดตโครงการสำเร็จ',
            'data' => $project,
        ]);
    }

    public function destroy($id)
    {
        $project = Project::findOrFail($id);
        $project->delete();

        return response()->json(['message' => 'ลบโครงการสำเร็จ']);
    }
}
