<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RentalJob;
use App\Models\SaleDocument;
use Illuminate\Http\Request;

class RentalJobController extends Controller
{
    // ค่าตั้งต้นของ "รูปแบบงาน" — รวมกับค่า custom ที่เคยใช้จริงในบริษัทผ่าน jobTypeOptions()
    private const DEFAULT_JOB_TYPES = ['Lighting', 'Sound System', 'Stage', 'OB', 'Organize'];

    // RentalJob model ใช้ trait BelongsToCompany อยู่แล้ว จึงคัดกรองแยกบริษัทให้อัตโนมัติ
    public function index()
    {
        return response()->json(RentalJob::with(['contact', 'pic'])->orderBy('name')->get());
    }

    public function show($id)
    {
        $rentalJob = RentalJob::with(['contact', 'pic', 'project'])->findOrFail($id);

        return response()->json(['data' => $rentalJob]);
    }

    // GET /api/rental-jobs/job-type-options — ตัวเลือกคงที่ 5 อัน + ค่า custom ที่บริษัทนี้เคยใช้จริง
    public function jobTypeOptions()
    {
        $usedTypes = RentalJob::whereNotNull('job_types')
            ->pluck('job_types')
            ->flatten()
            ->filter()
            ->unique()
            ->values();

        $options = collect(self::DEFAULT_JOB_TYPES)
            ->merge($usedTypes)
            ->unique()
            ->values();

        return response()->json(['data' => $options]);
    }

    // GET /api/rental-jobs/{id}/summary
    // รวมข้อมูลที่หน้า Rental Job Hub ต้องใช้ในคำขอเดียว: ตัวงานเช่า + จำนวน/รายการล่าสุดของเอกสารขายแต่ละประเภท (ครบ 11 ประเภท รวม stock_issue/stock_return/custom_quotation)
    public function summary($id)
    {
        $rentalJob = RentalJob::with(['contact', 'pic'])->findOrFail($id);

        $saleDocTypes = [
            'quotation', 'billing_invoice', 'tax_invoice', 'cash',
            'receipt', 'credit_note', 'debit_note', 'delivery_note',
            'stock_issue', 'rental_stock_return', 'custom_quotation', 'invoice',
        ];

        $documents = SaleDocument::where('rental_job_id', $id)
            ->select(['id', 'document_type', 'document_number', 'status', 'grand_total', 'issue_date', 'reference_document_id', 'created_at'])
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

        // 🛠️ ใบสั่งซื้อ/ใบสั่งจ้าง ผู้รับเหมา — ไม่ใช่ SaleDocument จึงต้อง query แยกต่างหาก (งานเช่าไม่เคยผูกกับ PurchaseOrder เดิมเลย)
        $contractorWorkOrders = \App\Models\ContractorWorkOrder::where('rental_job_id', $id)
            ->select(['id', 'order_number', 'status', 'grand_total', 'created_at'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => [
                'rental_job' => $rentalJob,
                'sale_documents' => $saleDocumentsSummary,
                'contractor_work_orders' => [
                    'count' => $contractorWorkOrders->count(),
                    'latest' => $contractorWorkOrders->take(5)->values(),
                ],
            ],
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
            'contact_id' => 'nullable|exists:contacts,id',
            'project_id' => 'nullable|exists:projects,id',
            'pic_user_id' => 'nullable|exists:users,id',
            'job_types' => 'nullable|array',
            'job_types.*' => 'string|max:100',
            // 🛡️ เดิมรับ string อิสระ ไม่มี allow-list เลย ทำให้ตั้งสถานะเป็นค่าที่ frontend ไม่รู้จักได้
            'status' => 'nullable|in:draft,confirmed,in_progress,completed,cancelled',
            // 🪜 ขั้นตอนงาน — แยกจาก status เดิมโดยสิ้นเชิง (ใช้ชุดเดียวกับ ProjectController ตามที่ยืนยันแล้ว)
            'stage' => 'nullable|in:quotation,purchasing,sales_order,delivery,installation',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'note' => 'nullable|string',
        ]);

        $rentalJob = RentalJob::create([
            // 🚀 ตั้ง company_id ตรงๆ เหมือน ProjectController — BelongsToCompany trait จะไม่ auto-stamp ให้ถ้าผู้สร้างเป็น Platform Admin
            'company_id' => $request->user()->company_id,
            'name' => $request->name,
            'location' => $request->location,
            'contact_id' => $request->contact_id,
            'project_id' => $request->project_id,
            'pic_user_id' => $request->pic_user_id,
            'job_types' => $request->job_types ?? [],
            'status' => $request->status ?? 'draft',
            'stage' => $request->stage,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'note' => $request->note,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'เพิ่มงานเช่าสำเร็จ',
            'data' => $rentalJob,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
            'contact_id' => 'nullable|exists:contacts,id',
            'project_id' => 'nullable|exists:projects,id',
            'pic_user_id' => 'nullable|exists:users,id',
            'job_types' => 'nullable|array',
            'job_types.*' => 'string|max:100',
            // 🛡️ เดิมรับ string อิสระ ไม่มี allow-list เลย ทำให้ตั้งสถานะเป็นค่าที่ frontend ไม่รู้จักได้
            'status' => 'nullable|in:draft,confirmed,in_progress,completed,cancelled',
            // 🪜 ขั้นตอนงาน — แยกจาก status เดิมโดยสิ้นเชิง (ใช้ชุดเดียวกับ ProjectController ตามที่ยืนยันแล้ว)
            'stage' => 'nullable|in:quotation,purchasing,sales_order,delivery,installation',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'note' => 'nullable|string',
        ]);

        $rentalJob = RentalJob::findOrFail($id);
        $rentalJob->update($request->only([
            'name', 'location', 'contact_id', 'project_id', 'pic_user_id',
            'job_types', 'status', 'stage', 'start_date', 'end_date', 'note',
        ]));

        return response()->json([
            'message' => 'อัปเดตงานเช่าสำเร็จ',
            'data' => $rentalJob,
        ]);
    }

    public function destroy($id)
    {
        $rentalJob = RentalJob::findOrFail($id);
        $rentalJob->delete();

        return response()->json(['message' => 'ลบงานเช่าสำเร็จ']);
    }
}
