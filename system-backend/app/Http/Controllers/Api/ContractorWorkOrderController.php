<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContractorWorkOrder;
use App\Models\ContractorWorkOrderItem;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

// 🛠️ ใบสั่งซื้อ/ใบสั่งจ้าง สำหรับจ้างช่าง/ผู้รับเหมารายตัว — โครงสร้างมิเรอร์ PurchaseOrderController แต่ไม่มี
// partial-receiving workflow (ไม่มี goods_receipt concept เพราะไม่ใช่การซื้อสินค้าเข้าสต๊อก)
class ContractorWorkOrderController extends Controller
{
    private function hasPermission(string $action): bool
    {
        $user = auth()->user();
        if ($user->is_platform_admin || $user->isCompanyAdmin()) return true;
        return $user->can("{$action}_contractor_work_orders");
    }

    public function index()
    {
        if (!$this->hasPermission('view')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารประเภทนี้'], 403);
        }
        $orders = ContractorWorkOrder::with(['contact', 'creator'])
            ->where('company_id', auth()->user()->company_id)
            ->latest()
            ->limit(2000)
            ->get();
        return response()->json($orders);
    }

    public function store(Request $request)
    {
        if (!$this->hasPermission('create')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์สร้างเอกสารนี้'], 403);
        }

        $companyId = auth()->user()->company_id;

        $request->validate([
            'contact_id' => ['required', Rule::exists('contacts', 'id')->where('company_id', $companyId)],
            'project_id' => 'nullable|integer',
            'rental_job_id' => 'nullable|integer',
            'site_reference' => 'nullable|string|max:255',
            'order_date' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_name' => 'nullable|string|max:50',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.discount_amount' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'wht_rate' => 'nullable|numeric|min:0|max:100',
            'note' => 'nullable|string',
            'show_footer_note' => 'nullable|boolean',
        ]);

        try {
            DB::beginTransaction();

            $orderNumber = DocumentService::generate('contractor_work_order', $companyId);

            $order = ContractorWorkOrder::create([
                'company_id' => $companyId,
                'project_id' => $request->project_id,
                'rental_job_id' => $request->rental_job_id,
                'contact_id' => $request->contact_id,
                'order_number' => $orderNumber,
                'site_reference' => $request->site_reference,
                'status' => 'Pending',
                'order_date' => $request->order_date,
                'subtotal' => 0,
                'discount_amount' => $request->discount_amount ?? 0,
                'wht_rate' => $request->wht_rate,
                'wht_amount' => 0,
                'grand_total' => 0,
                'show_footer_note' => $request->show_footer_note ?? true,
                'note' => $request->note,
                'created_by' => auth()->id(),
            ]);

            $subtotal = 0;
            foreach ($request->items as $item) {
                $totalPrice = $item['quantity'] * $item['unit_price'];
                $itemDiscount = $item['discount_amount'] ?? 0;
                $netItemPrice = $totalPrice - $itemDiscount;
                $subtotal += $netItemPrice;

                ContractorWorkOrderItem::create([
                    'contractor_work_order_id' => $order->id,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_name' => $item['unit_name'] ?? 'งาน',
                    'unit_price' => $item['unit_price'],
                    'discount_amount' => $itemDiscount,
                    'total_price' => $netItemPrice,
                ]);
            }

            $this->recalculateTotals($order, $subtotal, $request->discount_amount ?? 0, $request->wht_rate);

            DB::commit();
            return response()->json(['message' => 'สร้างใบสั่งจ้างสำเร็จ', 'data' => $order->load('items')], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // 🧮 คำนวณยอดใหม่เสมอฝั่ง server — 🛡️ ตั้งใจ: grand_total = subtotal - discount_amount - wht_amount
    // (หัก ณ ที่จ่ายถูกลบออกจากยอดสุทธิ) ต่างจากเอกสารอื่นทุกประเภทในระบบ (SaleDocument/PurchaseOrder ไม่เคยหัก WHT ออกจาก
    // grand_total) — เป็นความตั้งใจตามแบบฟอร์มจริงที่บริษัทใช้จ้างช่าง อย่าแก้กลับให้เหมือนเอกสารอื่นโดยไม่ตรวจสอบกับผู้ใช้ก่อน
    private function recalculateTotals(ContractorWorkOrder $order, float $subtotal, float $discountAmount, $whtRate): void
    {
        $whtAmount = $whtRate ? round(($subtotal - $discountAmount) * ($whtRate / 100), 2) : 0;
        $grandTotal = max(0, $subtotal - $discountAmount - $whtAmount);
        $order->update([
            'subtotal' => $subtotal,
            'discount_amount' => $discountAmount,
            'wht_amount' => $whtAmount,
            'grand_total' => $grandTotal,
        ]);
    }

    public function show($id)
    {
        if (!$this->hasPermission('view')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารนี้'], 403);
        }
        $order = ContractorWorkOrder::with(['items', 'contact', 'project', 'rentalJob', 'creator', 'approver'])->find($id);
        if (!$order) return response()->json(['message' => 'ไม่พบข้อมูล'], 404);

        if ($order->creator && $order->creator->signature_path) {
            $path = storage_path('app/public/' . $order->creator->signature_path);
            if (file_exists($path)) {
                $order->creator->signature_base64 = 'data:' . mime_content_type($path) . ';base64,' . base64_encode(file_get_contents($path));
            }
        }
        if ($order->approver && $order->approver->signature_path) {
            $path = storage_path('app/public/' . $order->approver->signature_path);
            if (file_exists($path)) {
                $order->approver->signature_base64 = 'data:' . mime_content_type($path) . ';base64,' . base64_encode(file_get_contents($path));
            }
        }

        return response()->json(['data' => $order]);
    }

    public function update(Request $request, $id)
    {
        if (!$this->hasPermission('edit')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์แก้ไขเอกสารนี้'], 403);
        }
        $order = ContractorWorkOrder::find($id);
        if (!$order) return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        // 🛡️ แก้ไขได้ทั้ง Pending และ Approved (เปิดให้แก้ไขตรงๆ ได้ทันทีตามที่ยืนยันแล้ว) — บล็อกเฉพาะ Cancelled
        // ซึ่งเป็นสถานะจบแล้ว การแก้ไขเอกสาร Approved จะไม่รีเซ็ตสถานะกลับเป็น Pending และไม่ต้องอนุมัติซ้ำ
        if ($order->status === 'Cancelled') {
            return response()->json(['message' => 'ไม่สามารถแก้ไขได้ เนื่องจากเอกสารนี้ถูกยกเลิกไปแล้ว'], 400);
        }

        $companyId = auth()->user()->company_id;
        $request->validate([
            'contact_id' => ['required', Rule::exists('contacts', 'id')->where('company_id', $companyId)],
            'project_id' => 'nullable|integer',
            'rental_job_id' => 'nullable|integer',
            'site_reference' => 'nullable|string|max:255',
            'order_date' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_name' => 'nullable|string|max:50',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.discount_amount' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'wht_rate' => 'nullable|numeric|min:0|max:100',
            'note' => 'nullable|string',
            'show_footer_note' => 'nullable|boolean',
        ]);

        DB::beginTransaction();
        try {
            $order->update($request->only([
                'contact_id', 'project_id', 'rental_job_id', 'site_reference',
                'order_date', 'note', 'show_footer_note',
            ]));

            $order->items()->delete();
            $subtotal = 0;
            foreach ($request->items as $item) {
                $totalPrice = $item['quantity'] * $item['unit_price'];
                $itemDiscount = $item['discount_amount'] ?? 0;
                $netItemPrice = $totalPrice - $itemDiscount;
                $subtotal += $netItemPrice;

                $order->items()->create([
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_name' => $item['unit_name'] ?? 'งาน',
                    'unit_price' => $item['unit_price'],
                    'discount_amount' => $itemDiscount,
                    'total_price' => $netItemPrice,
                ]);
            }

            $this->recalculateTotals($order, $subtotal, $request->discount_amount ?? 0, $request->wht_rate);
            $order->update(['wht_rate' => $request->wht_rate]);

            DB::commit();
            return response()->json(['message' => 'อัปเดตข้อมูลสำเร็จ', 'data' => $order->load('items')]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function approve($id)
    {
        if (!$this->hasPermission('approve')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์อนุมัติเอกสารนี้'], 403);
        }
        DB::beginTransaction();
        try {
            $order = ContractorWorkOrder::find($id);
            if (!$order) {
                DB::rollBack();
                return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
            }
            if ($order->status !== 'Pending') {
                DB::rollBack();
                return response()->json(['message' => 'เอกสารนี้ถูกดำเนินการไปแล้ว'], 400);
            }
            $order->update(['status' => 'Approved', 'approved_by' => auth()->id(), 'approved_at' => now()]);
            DB::commit();
            return response()->json(['message' => 'อนุมัติใบสั่งจ้างสำเร็จ', 'status' => 'Approved']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    public function cancel(Request $request, $id)
    {
        if (!$this->hasPermission('edit')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ยกเลิกเอกสารนี้'], 403);
        }
        DB::beginTransaction();
        try {
            $order = ContractorWorkOrder::find($id);
            if (!$order) {
                DB::rollBack();
                return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
            }
            if ($order->status === 'Cancelled') {
                DB::rollBack();
                return response()->json(['message' => 'เอกสารนี้ถูกยกเลิกไปแล้ว'], 400);
            }
            $order->update(['status' => 'Cancelled']);
            DB::commit();
            return response()->json(['message' => 'ยกเลิกเอกสารสำเร็จ', 'status' => 'Cancelled']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        if (!$this->hasPermission('delete')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ลบเอกสารนี้'], 403);
        }
        $order = ContractorWorkOrder::find($id);
        if (!$order) return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        if ($order->status !== 'Pending' && $order->status !== 'Cancelled') {
            return response()->json(['message' => 'ไม่สามารถลบเอกสารที่มีการเคลื่อนไหวแล้วได้'], 400);
        }
        DB::beginTransaction();
        try {
            $order->items()->delete();
            $order->delete();
            DB::commit();
            return response()->json(['message' => 'ลบเอกสารเรียบร้อยแล้ว']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาดในการลบ: ' . $e->getMessage()], 500);
        }
    }
}
