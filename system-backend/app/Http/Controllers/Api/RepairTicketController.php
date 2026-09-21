<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductSerial;
use App\Models\RepairTicket;
use App\Models\SaleDocument;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RepairTicketController extends Controller
{
    // สถานะที่อนุญาตให้เปลี่ยนได้จากแต่ละสถานะปัจจุบัน (varchar + ตรวจสอบระดับ app ตามแพทเทิร์นเดียวกับ ProductSerial.status)
    private const STATUS_TRANSITIONS = [
        'received' => ['diagnosing', 'cancelled'],
        'diagnosing' => ['awaiting_approval', 'unrepairable', 'cancelled'],
        'awaiting_approval' => ['in_repair', 'unrepairable', 'cancelled'],
        'in_repair' => ['repaired', 'unrepairable'],
        'repaired' => ['returned'],
        'unrepairable' => ['returned'],
        'returned' => [],
        'cancelled' => [],
    ];

    private const STOCK_OUT_DOC_TYPES = ['tax_invoice', 'cash', 'receipt'];

    public function index(Request $request)
    {
        $query = RepairTicket::with(['contact:id,business_name', 'product:id,name,sku'])
            ->where('company_id', auth()->user()->company_id);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('contact_id')) {
            $query->where('contact_id', $request->contact_id);
        }
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('ticket_number', 'like', "%{$q}%")
                    ->orWhereHas('contact', function ($c) use ($q) {
                        $c->where('business_name', 'like', "%{$q}%")->orWhere('contact_person_name', 'like', "%{$q}%");
                    });
            });
        }

        return response()->json($query->latest()->paginate(20));
    }

    public function show($id)
    {
        $ticket = RepairTicket::with([
            'contact', 'project', 'product', 'productSerial',
            'referenceSaleDocument', 'billingSaleDocument', 'creator', 'assignee', 'activitiesAsSubject', 'photos',
        ])->find($id);

        if (!$ticket) {
            return response()->json(['message' => 'ไม่พบข้อมูลงานซ่อม'], 404);
        }
        if (!auth()->user()->is_platform_admin && $ticket->company_id !== auth()->user()->company_id) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์เข้าถึงงานซ่อมนี้'], 403);
        }

        return response()->json(['data' => $ticket]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'product_serial_id' => 'nullable|exists:product_serials,id',
            'reference_sale_document_id' => 'nullable|exists:sale_documents,id',
            'contact_id' => 'nullable|exists:contacts,id',
            'project_id' => 'nullable|exists:projects,id',
            'reported_issue' => 'nullable|string',
            'is_under_warranty' => 'nullable|boolean',
            'received_at' => 'nullable|date',
            'is_external' => 'nullable|boolean',
            'manual_serial_number' => 'nullable|string|max:100',
            'photos' => 'nullable|array|max:4',
            'photos.*' => 'file|image|mimes:jpeg,png,jpg,webp|max:1024',
        ]);

        $product = Product::findOrFail($request->product_id);
        $companyId = auth()->user()->company_id;

        $contactId = $request->contact_id;
        $projectId = $request->project_id;
        $isExternal = $request->boolean('is_external');

        // 🔧 ลูกค้านำเครื่องมาเองโดยไม่ได้ซื้อผ่านระบบ — ข้ามการตรวจสอบ S/N/เอกสารขายจริงที่บังคับปกติ
        // ยังคงบังคับเลือกสินค้าจากแคตตาล็อกเดิม (product_id required จาก validate() แล้ว) แค่ไม่ต้องมีประวัติซื้อขาย
        // สินค้าคุม S/N: ต้องระบุ product_serial_id — auto-derive ลูกค้า/โครงการจากเอกสารขายที่ผูก S/N นี้ไว้
        // สินค้าไม่มี S/N: ต้องอ้างอิงเอกสารขายเดิม (ต้องเป็น 3 ประเภท stock-out ที่อนุมัติแล้ว) ตามที่ยืนยันไว้
        if ($isExternal) {
            // ไม่มีการตรวจสอบเพิ่มเติม — contactId ถูกเช็คบังคับท้ายฟังก์ชันเหมือนกันทุก branch
        } elseif ($product->has_serial_number) {
            if (!$request->product_serial_id) {
                return response()->json(['message' => 'สินค้านี้คุม S/N กรุณาระบุ Serial Number ที่รับแจ้งซ่อม'], 422);
            }
            $serial = ProductSerial::where('id', $request->product_serial_id)
                ->where('product_id', $product->id)
                ->first();
            if (!$serial) {
                return response()->json(['message' => 'ไม่พบ S/N นี้ในระบบสำหรับสินค้าที่เลือก'], 422);
            }
            if (!$contactId && $serial->sold_to_sale_document_id) {
                $saleDoc = SaleDocument::find($serial->sold_to_sale_document_id);
                $contactId = $contactId ?: $saleDoc?->contact_id;
                $projectId = $projectId ?: $saleDoc?->project_id;
            }
        } else {
            if (!$request->reference_sale_document_id) {
                return response()->json(['message' => 'สินค้านี้ไม่มี S/N กรุณาอ้างอิงเอกสารขายเดิมของลูกค้า'], 422);
            }
            $refDoc = SaleDocument::find($request->reference_sale_document_id);
            if (!$refDoc || !in_array($refDoc->document_type, self::STOCK_OUT_DOC_TYPES) || $refDoc->status !== 'Approved') {
                return response()->json(['message' => 'เอกสารอ้างอิงไม่ถูกต้อง ต้องเป็นใบกำกับภาษี/บิลเงินสด/ใบเสร็จที่อนุมัติแล้วเท่านั้น'], 422);
            }
            $contactId = $contactId ?: $refDoc->contact_id;
            $projectId = $projectId ?: $refDoc->project_id;
        }

        if (!$contactId) {
            return response()->json(['message' => 'กรุณาระบุลูกค้าสำหรับงานซ่อมนี้'], 422);
        }

        $ticket = RepairTicket::create([
            'company_id' => $companyId,
            'ticket_number' => DocumentService::generate('repair_ticket', $companyId),
            'contact_id' => $contactId,
            'project_id' => $projectId,
            'product_id' => $product->id,
            'product_serial_id' => $isExternal ? null : $request->product_serial_id,
            'reference_sale_document_id' => $isExternal ? null : $request->reference_sale_document_id,
            'is_external' => $isExternal,
            'manual_serial_number' => $isExternal ? $request->manual_serial_number : null,
            'status' => 'received',
            'reported_issue' => $request->reported_issue,
            'is_under_warranty' => $request->is_under_warranty ?? false,
            'received_at' => $request->received_at ?? now()->format('Y-m-d'),
            'created_by' => auth()->id(),
        ]);

        if ($request->hasFile('photos')) {
            foreach ($request->file('photos') as $photo) {
                $path = $photo->store('repairs', 'public');
                $ticket->photos()->create(['path' => $path]);
            }
        }

        return response()->json([
            'message' => 'บันทึกรับแจ้งซ่อมสำเร็จ',
            'data' => $ticket->load(['contact', 'project', 'product', 'productSerial', 'referenceSaleDocument', 'photos']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $ticket = RepairTicket::findOrFail($id);

        if (in_array($ticket->status, ['returned', 'cancelled'])) {
            return response()->json(['message' => 'ไม่สามารถแก้ไขงานซ่อมที่ปิดงานแล้วได้'], 400);
        }

        $request->validate([
            'diagnosis_notes' => 'nullable|string',
            'repair_cost' => 'nullable|numeric|min:0',
            'assigned_to' => 'nullable|exists:users,id',
            'is_under_warranty' => 'nullable|boolean',
            'reported_issue' => 'nullable|string',
        ]);

        $ticket->update($request->only([
            'diagnosis_notes', 'repair_cost', 'assigned_to', 'is_under_warranty', 'reported_issue',
        ]));

        return response()->json(['message' => 'บันทึกการแก้ไขสำเร็จ', 'data' => $ticket->fresh()]);
    }

    public function transitionStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|string',
            'note' => 'nullable|string',
        ]);

        $ticket = RepairTicket::findOrFail($id);
        $allowed = self::STATUS_TRANSITIONS[$ticket->status] ?? [];

        if (!in_array($request->status, $allowed)) {
            return response()->json([
                'message' => "ไม่สามารถเปลี่ยนสถานะจาก \"{$ticket->status}\" เป็น \"{$request->status}\" ได้",
            ], 400);
        }

        $updates = ['status' => $request->status];
        if ($request->status === 'returned') {
            $updates['returned_at'] = now()->format('Y-m-d');
        }
        if ($request->filled('note')) {
            $updates['diagnosis_notes'] = trim(($ticket->diagnosis_notes ?? '') . "\n" . $request->note);
        }

        $ticket->update($updates);

        return response()->json(['message' => 'อัปเดตสถานะงานซ่อมสำเร็จ', 'data' => $ticket->fresh()]);
    }

    // POST /api/repairs/{id}/generate-billing — ออกเอกสารเรียกเก็บเงินจากงานซ่อมที่เสร็จแล้ว
    // เรียกใช้ SaleDocumentController::store() ตัวเดิมโดยตรง (ไม่ก็อปโค้ดคำนวณ VAT/เลขที่เอกสาร)
    // เพื่อกันไม่ให้ logic การสร้างเอกสารขายเพี้ยนตามกันไม่ทันถ้ามีการแก้ไข store() ในอนาคต
    public function generateBilling(Request $request, $id)
    {
        $request->validate([
            'document_type' => 'required|in:tax_invoice,cash,receipt',
        ]);

        // 🛡️ ล็อกแถวตั๋วซ่อมก่อนเช็ค/ออกบิล กันสองคำขอออกบิลพร้อมกัน (double-click/สองคนกดพร้อมกัน)
        // สร้างเอกสารเรียกเก็บเงินซ้ำสองใบ — เดิมเช็ค billing_sale_document_id แบบอ่านเฉยๆ ไม่ล็อก
        DB::beginTransaction();
        $ticket = RepairTicket::where('id', $id)->lockForUpdate()->first();

        if (!$ticket) {
            DB::rollBack();
            return response()->json(['message' => 'ไม่พบงานซ่อม'], 404);
        }
        if (!in_array($ticket->status, ['repaired', 'returned'])) {
            DB::rollBack();
            return response()->json(['message' => 'ออกบิลได้เฉพาะงานที่ซ่อมเสร็จแล้วเท่านั้น'], 400);
        }
        if (!$ticket->repair_cost) {
            DB::rollBack();
            return response()->json(['message' => 'กรุณาระบุค่าซ่อมก่อนออกบิล'], 400);
        }
        if ($ticket->billing_sale_document_id) {
            DB::rollBack();
            return response()->json(['message' => 'งานซ่อมนี้ออกบิลไปแล้ว'], 400);
        }

        $taxType = 'exclude';
        $subtotal = (float) $ticket->repair_cost;
        $vatAmount = round($subtotal * 0.07, 2);
        $grandTotal = $subtotal + $vatAmount;

        // 🔧 ค่าซ่อมคือ "ค่าบริการ" ไม่ใช่การขายสินค้าตัวที่ซ่อมซ้ำอีกชิ้น — ถ้าใช้ product_id ของสินค้าที่ซ่อม
        // ตรงๆ และสินค้านั้นคุม S/N อยู่ จะโดนบังคับเลือก S/N ของสต๊อกที่ยังไม่ถูกขาย (ผิดหลักการ เพราะลูกค้า
        // ถือหน่วยนั้นอยู่แล้ว ไม่ได้ซื้อหน่วยใหม่) จึงต้องใช้สินค้ากลาง "ค่าบริการซ่อม" ที่ไม่คุม S/N แทนเสมอ
        $serviceProduct = Product::firstOrCreate(
            ['company_id' => $ticket->company_id, 'sku' => 'SERVICE-REPAIR'],
            [
                'name' => 'ค่าบริการซ่อม',
                'price' => 0,
                'vat_type' => '7',
                'has_serial_number' => false,
                'product_type' => 'service',
            ],
        );

        $docRequest = Request::create('/api/sale-documents', 'POST', [
            'document_type' => $request->document_type,
            'contact_id' => $ticket->contact_id,
            'project_id' => $ticket->project_id,
            'issue_date' => now()->format('Y-m-d'),
            'tax_type' => $taxType,
            'reference_number' => $ticket->ticket_number,
            'vat_amount' => $vatAmount,
            'grand_total' => $grandTotal,
            'items' => [[
                'product_id' => $serviceProduct->id,
                'quantity' => 1,
                'unit_name' => 'งาน',
                'unit_price' => $subtotal,
            ]],
        ]);

        $response = app(SaleDocumentController::class)->store($docRequest);
        $responseData = json_decode($response->getContent(), true);

        if ($response->getStatusCode() !== 201) {
            DB::rollBack();
            return response()->json([
                'message' => 'สร้างเอกสารเรียกเก็บเงินไม่สำเร็จ',
                'detail' => $responseData['message'] ?? null,
            ], 500);
        }

        $ticket->update(['billing_sale_document_id' => $responseData['data']['id']]);
        DB::commit();

        return response()->json([
            'message' => 'ออกเอกสารเรียกเก็บเงินสำเร็จ',
            'data' => $ticket->fresh()->load('billingSaleDocument'),
        ]);
    }

    public function destroy($id)
    {
        $ticket = RepairTicket::findOrFail($id);

        if ($ticket->status !== 'received') {
            return response()->json(['message' => 'ลบได้เฉพาะงานที่ยังไม่เริ่มดำเนินการ (สถานะ "รับเครื่อง" เท่านั้น)'], 400);
        }

        $ticket->delete();

        return response()->json(['message' => 'ลบข้อมูลงานซ่อมสำเร็จ']);
    }
}
