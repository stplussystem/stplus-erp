<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class PurchaseOrderController extends Controller
{
    public function index()
    {
        // 🛡️ จำกัดเพดานไว้กันรายการโตไม่มีที่สิ้นสุดทำให้ query/response หนักขึ้นเรื่อยๆ (เดิมไม่มี limit เลย)
        // ไม่เปลี่ยนรูปแบบ response (ยังเป็น array เปล่าๆ) เพื่อไม่กระทบหน้า frontend ที่เรียกอยู่
        $pos = PurchaseOrder::with(['contact', 'creator'])->latest()->limit(2000)->get();
        return response()->json($pos);
    }

    public function store(Request $request)
    {
        $companyId = auth()->user()->company_id;

        // 1. ตรวจสอบข้อมูลที่ส่งมา (Validation) รองรับฟิลด์ใหม่ทั้งหมด
        // 🛡️ exists: เดิมเช็คแค่ว่า id มีอยู่จริงในตาราง ไม่ได้เช็คว่าเป็นของบริษัทตัวเอง
        // ทำให้ผูก PO เข้ากับ contact/warehouse/product ของบริษัทอื่นได้ถ้ารู้/เดาเลข id — เพิ่มเงื่อนไข company_id กัน
        $request->validate([
            'contact_id' => ['required', Rule::exists('contacts', 'id')->where('company_id', $companyId)],
            'project_id' => 'nullable|integer',
            'warehouse_id' => ['nullable', Rule::exists('warehouses', 'id')->where('company_id', $companyId)],
            'reference_number' => 'nullable|string',
            'expected_date' => 'nullable|date',
            'credit_days' => 'nullable|integer|min:0',
            'currency' => 'nullable|string|size:3',
            'tax_type' => 'required|in:include,exclude,none',
            'items' => 'required|array|min:1',
            'items.*.product_id' => ['required', Rule::exists('products', 'id')->where('company_id', $companyId)],
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            // subtotal: ปกติคำนวณจาก items เอง แต่ยอมให้ client ส่งมา override ได้ (กรณีปัดเศษ/ให้ตรงกับผู้ขาย)
            'subtotal' => 'nullable|numeric|min:0',
            'vat_amount' => 'nullable|numeric|min:0',
            'wht_amount' => 'nullable|numeric|min:0',
            // grand_total: ไม่เชื่อค่าที่ client ส่งมาอีกต่อไป คำนวณเองจาก subtotal/discount/vat เสมอ (ดู logic ท้ายฟังก์ชัน)
            'grand_total' => 'nullable|numeric|min:0',
            'items.*.unit_name' => 'nullable|string|max:50',
        ]);

        try {
            DB::beginTransaction();

            // 2. 🧠 ระบบรันเลขที่เอกสารอัจฉริยะ (Smart Auto-Numbering) — ใช้ DocumentService กลางร่วมกับ Sale Documents
            $poNumber = DocumentService::generate('purchase_order', $companyId);

            // 3. คำนวณวันครบกำหนด (Due Date) จากเครดิตเทอม
            $dueDate = null;
            if ($request->expected_date && $request->credit_days > 0) {
                $dueDate = Carbon::parse($request->expected_date)->addDays($request->credit_days)->format('Y-m-d');
            }

            // 4. สร้างหัวบิล PO
            $po = PurchaseOrder::create([
                'company_id' => $companyId,
                'project_id' => $request->project_id,
                'warehouse_id' => $request->warehouse_id,
                'contact_id' => $request->contact_id,
                'po_number' => $poNumber,
                'reference_number' => $request->reference_number,
                'status' => 'Pending', // 🚀 ใช้ Pending ตามที่เราตกลงกันไว้
                'expected_date' => $request->expected_date,
                'credit_days' => $request->credit_days ?? 0,
                'due_date' => $dueDate,
                'currency' => $request->currency ?? 'THB',
                'tax_type' => $request->tax_type,
                'subtotal' => 0, // จะรวมจาก Items ด้านล่าง (หรือค่า override ของ client ถ้าส่งมา)
                'discount_amount' => $request->discount_amount ?? 0,
                'vat_amount' => $request->vat_amount ?? 0,
                'wht_amount' => $request->wht_amount ?? 0,
                'grand_total' => 0, // จะคำนวณจริงหลังทราบ subtotal ด้านล่าง ไม่เชื่อค่าที่ client ส่งมาตรงๆ
                'note' => $request->note,
                'created_by' => auth()->id(),
            ]);

            $subtotal = 0;

            // 5. บันทึกรายการสินค้าในบิล
            foreach ($request->items as $item) {
                $totalPrice = $item['quantity'] * $item['unit_price'];
                $itemDiscount = $item['discount_amount'] ?? 0;
                $netItemPrice = $totalPrice - $itemDiscount;

                $subtotal += $netItemPrice;

                PurchaseOrderItem::create([
                    'purchase_order_id' => $po->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_name' => $item['unit_name'] ?? 'ชิ้น',
                    'unit_price' => $item['unit_price'],
                    'discount_percent' => $item['discount_percent'] ?? null,
                    'discount_amount' => $itemDiscount,
                    'tax_rate' => $item['tax_rate'] ?? 0,
                    'tax_amount' => $item['tax_amount'] ?? 0,
                    'wht_rate' => $item['wht_rate'] ?? null,
                    'wht_amount' => $item['wht_amount'] ?? 0,
                    'total_price' => $netItemPrice,
                ]);
            }

            // 6. อัปเดตยอด Subtotal ที่แท้จริงกลับไปที่หัวบิล — ยอมให้ client override ได้ (ปัดเศษ/ให้ตรงผู้ขาย)
            // 🛡️ แต่จำกัดส่วนต่างไม่ให้เกินเกณฑ์เล็กน้อย (ปัดเศษจริงต่างกันไม่กี่บาท ไม่ใช่หลักพัน/หมื่น) กัน
            // client ส่งค่าปลอมที่ไม่สัมพันธ์กับรายการสินค้าจริงเลยมาบันทึกเป็นยอดเอกสาร
            $requestedSubtotal = $request->filled('subtotal') ? (float) $request->subtotal : $subtotal;
            $subtotalTolerance = max(5, $subtotal * 0.01);
            $finalSubtotal = abs($requestedSubtotal - $subtotal) <= $subtotalTolerance ? $requestedSubtotal : $subtotal;
            $headerDiscount = $request->discount_amount ?? 0;
            $vatAmount = $request->vat_amount ?? 0;
            // grand_total ไม่หัก WHT ออก — WHT เป็นแค่ "ยอดสุทธิที่ต้องจ่าย" แยกต่างหาก ไม่ใช่ส่วนหนึ่งของยอดเอกสาร
            $grandTotal = max(0, $finalSubtotal - $headerDiscount + $vatAmount);

            $po->update([
                'subtotal' => $finalSubtotal,
                'grand_total' => $grandTotal,
            ]);

            DB::commit();
            return response()->json(['message' => 'สร้างใบสั่งซื้อสำเร็จ', 'data' => $po->load('items')], 201);

            // 🚀 เพิ่มบล็อก catch สำหรับจัดการ Error ฐานข้อมูลโดยเฉพาะ
        } catch (\Illuminate\Database\QueryException $e) {
            DB::rollBack();

            // ตรวจสอบว่าเป็น Error 1062 (ข้อมูลซ้ำ) หรือไม่
            if ($e->errorInfo[1] == 1062) {
                // ถ้าเป็นเลขเอกสารซ้ำ
                if (str_contains($e->getMessage(), 'purchase_orders_po_number_unique')) {
                    return response()->json([
                        'message' => 'เลขที่เอกสารนี้มีอยู่ในระบบแล้ว กรุณากดบันทึกใหม่อีกครั้งเพื่อรันเลขถัดไปครับ'
                    ], 400);
                }

                // ข้อมูลอื่นซ้ำ
                return response()->json([
                    'message' => 'ไม่สามารถบันทึกได้ เนื่องจากมีข้อมูลบางอย่างซ้ำซ้อนในระบบ'
                ], 400);
            }

            // ถ้าเป็น Error จากฐานข้อมูลเรื่องอื่นๆ
            return response()->json(['message' => 'เกิดข้อผิดพลาดจากฐานข้อมูล กรุณาลองใหม่อีกครั้ง'], 500);

            // ดักจับ Error ทั่วไป
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $th->getMessage()], 500);
        }
    }

    public function show($id)
    {
        try {
            // 🚀 เรียกแค่ creator กับ approver ก็พอแล้วครับ (ชื่อตรง Model เป๊ะๆ)
            $po = \App\Models\PurchaseOrder::with([
                'items.product',
                'contact',
                'project',
                'warehouse',
                'creator',
                'approver'
            ])->find($id);

            if (!$po) return response()->json(['message' => 'ไม่พบข้อมูล'], 404);

            // 🚀 แปลงรูปผู้จัดทำเป็น Base64
            if ($po->creator && $po->creator->signature_path) {
                $path = storage_path('app/public/' . $po->creator->signature_path);
                if (file_exists($path)) {
                    $mime = mime_content_type($path);
                    $data = file_get_contents($path);
                    $po->creator->signature_base64 = 'data:' . $mime . ';base64,' . base64_encode($data);
                }
            }

            // 🚀 แปลงรูปผู้อนุมัติเป็น Base64
            if ($po->approver && $po->approver->signature_path) {
                $path = storage_path('app/public/' . $po->approver->signature_path);
                if (file_exists($path)) {
                    $mime = mime_content_type($path);
                    $data = file_get_contents($path);
                    $po->approver->signature_base64 = 'data:' . $mime . ';base64,' . base64_encode($data);
                }
            }

            return response()->json(['data' => $po]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // 💾 2. ฟังก์ชันอัปเดตข้อมูล (สำหรับปุ่ม "อัปเดตเอกสาร" ในหน้า Edit)
    public function update(Request $request, $id)
    {
        $po = PurchaseOrder::find($id);
        if (!$po) {
            return response()->json(['message' => 'ไม่พบข้อมูลใบสั่งซื้อ'], 404);
        }

        // 🛡️ แก้ไขได้เฉพาะบิลที่ยังไม่ถูกอนุมัติเท่านั้น — ถ้าอนุมัติ/รับสินค้าไปแล้ว ยอด received_quantity
        // และสต็อกที่บันทึกไปแล้วจะอ้างอิงรายการเดิม แก้ items ตอนนี้จะทำให้ข้อมูลไม่ตรงกับของจริง
        if ($po->status !== 'Pending') {
            return response()->json(['message' => 'ไม่สามารถแก้ไขได้ เนื่องจากใบสั่งซื้อนี้ถูกอนุมัติ/ดำเนินการไปแล้ว'], 400);
        }

        $companyId = auth()->user()->company_id;

        $request->validate([
            'contact_id' => ['required', Rule::exists('contacts', 'id')->where('company_id', $companyId)],
            'project_id' => 'nullable|integer',
            'warehouse_id' => ['nullable', Rule::exists('warehouses', 'id')->where('company_id', $companyId)],
            'reference_number' => 'nullable|string',
            'expected_date' => 'nullable|date',
            'credit_days' => 'nullable|integer|min:0',
            'currency' => 'nullable|string|size:3',
            'tax_type' => 'required|in:include,exclude,none',
            'items' => 'required|array|min:1',
            'items.*.product_id' => ['required', Rule::exists('products', 'id')->where('company_id', $companyId)],
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'subtotal' => 'nullable|numeric|min:0',
            'vat_amount' => 'nullable|numeric|min:0',
            'wht_amount' => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $dueDate = $po->due_date;
            if ($request->expected_date && $request->credit_days > 0) {
                $dueDate = Carbon::parse($request->expected_date)->addDays($request->credit_days)->format('Y-m-d');
            }

            // 2.1 อัปเดตข้อมูลหัวบิล
            $po->update($request->only([
                'contact_id',
                'project_id',
                'warehouse_id',
                'reference_number',
                'expected_date',
                'credit_days',
                'currency',
                'tax_type',
                'note',
                'discount_amount',
            ]) + ['due_date' => $dueDate]);

            // 2.2 อัปเดตรายการสินค้า (เทคนิคที่เสถียรสุดคือ: ลบของเก่า แล้วบันทึกของใหม่ทับ)
            $po->items()->delete();

            // 🛡️ คำนวณ subtotal จาก items จริงที่ผ่าน validate แล้วไว้เป็นค่าเริ่มต้น แต่ยอมให้ client override ได้
            // (ปัดเศษ/ให้ตรงกับผู้ขาย) — ไม่บล็อกแม้ค่าที่ส่งมาจะต่างจากผลรวม items มาก
            $itemSubtotal = 0;
            foreach ($request->items as $item) {
                $totalPrice = $item['quantity'] * $item['unit_price'];
                $itemDiscount = $item['discount_amount'] ?? 0;
                $netItemPrice = $totalPrice - $itemDiscount;
                $itemSubtotal += $netItemPrice;

                $po->items()->create([
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_name' => $item['unit_name'] ?? 'ชิ้น',
                    'unit_price' => $item['unit_price'],
                    'discount_percent' => $item['discount_percent'] ?? null,
                    'discount_amount' => $itemDiscount,
                    'tax_rate' => $item['tax_rate'] ?? 0,
                    'tax_amount' => $item['tax_amount'] ?? 0,
                    'wht_rate' => $item['wht_rate'] ?? null,
                    'wht_amount' => $item['wht_amount'] ?? 0,
                    'total_price' => $netItemPrice,
                ]);
            }

            // 🛡️ เกณฑ์เดียวกับ store() — จำกัดส่วนต่างที่ client ปรับ subtotal เองไม่ให้เกินปัดเศษเล็กน้อย
            $requestedSubtotal = $request->filled('subtotal') ? (float) $request->subtotal : $itemSubtotal;
            $subtotalTolerance = max(5, $itemSubtotal * 0.01);
            $finalSubtotal = abs($requestedSubtotal - $itemSubtotal) <= $subtotalTolerance ? $requestedSubtotal : $itemSubtotal;
            $headerDiscount = $request->discount_amount ?? 0;
            $vatAmount = $request->vat_amount ?? 0;
            $whtAmount = $request->wht_amount ?? 0;
            // 🛡️ grand_total ไม่หัก WHT ออก — ให้ตรงกับ store() และหน้าจอที่แสดง (WHT เป็นแค่ "ยอดสุทธิที่ต้องจ่าย" แยกต่างหาก)
            $grandTotal = max(0, $finalSubtotal - $headerDiscount + $vatAmount);

            $po->update([
                'subtotal' => $finalSubtotal,
                'vat_amount' => $vatAmount,
                'wht_amount' => $whtAmount,
                'grand_total' => $grandTotal,
            ]);

            DB::commit();
            return response()->json(['message' => 'อัปเดตข้อมูลสำเร็จ', 'data' => $po->load('items')]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    // 🚀 ฟังก์ชันสำหรับกด "ยืนยันสั่งซื้อ" เปลี่ยนสถานะ Pending -> Approved
    public function approve($id)
    {
        // 🚀 ดักจับสิทธิ์อนุมัติราคาใบสั่งซื้อ
        $isSuperAdmin = auth()->user()->isCompanyAdmin();

        if (!auth()->user()->can('approve_purchase') && !auth()->user()->is_platform_admin && !$isSuperAdmin) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์อนุมัติใบสั่งซื้อนี้'], 403);
        }

        // 🛡️ ห่อ transaction ให้สอดคล้องกับ store()/update()/destroy() ในไฟล์นี้ — ตอนนี้เป็นแค่ update แถวเดียว
        // ยังไม่มีปัญหา แต่ถ้ามีการเพิ่ม side-effect (เช่น audit log) ในอนาคตจะได้ atomic ไปด้วยตั้งแต่แรก
        DB::beginTransaction();
        try {
            $po = PurchaseOrder::find($id);
            if (!$po) {
                DB::rollBack();
                return response()->json(['message' => 'ไม่พบข้อมูลใบสั่งซื้อ'], 404);
            }
            if ($po->status !== 'Pending') {
                DB::rollBack();
                return response()->json(['message' => 'บิลนี้ถูกยืนยันไปแล้ว'], 400);
            }
            $po->update([
                'status' => 'Approved',
                'approved_by' => auth()->id()
            ]);

            DB::commit();
            return response()->json(['message' => 'ยืนยันใบสั่งซื้อสำเร็จ', 'status' => 'Approved']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // 🕒 ฟังก์ชันดึงประวัติการซื้อสินค้าย้อนหลัง 5 ครั้งล่าสุด
    public function productPurchaseHistory($productId)
    {
        try {
            // โหลดรายการสินค้าจากบิลที่ "ยืนยันแล้ว" หรือ "รับของแล้ว" เท่านั้น
            $history = \App\Models\PurchaseOrderItem::with(['purchaseOrder.contact'])
                ->where('product_id', $productId)
                ->whereHas('purchaseOrder', function ($q) {
                    $q->whereIn('status', ['Approved', 'Partial', 'Completed']);
                })
                ->latest('id') // เรียงจากล่าสุด
                ->take(5) // เอาแค่ 5 บิล
                ->get()
                ->map(function ($item) {
                    return [
                        'po_id' => $item->purchaseOrder->id,
                        'date' => \Carbon\Carbon::parse($item->purchaseOrder->expected_date ?? $item->purchaseOrder->created_at)->format('d/m/Y'),
                        'po_number' => $item->purchaseOrder->po_number,
                        'supplier_name' => $item->purchaseOrder->contact->business_name ?? $item->purchaseOrder->contact->name ?? '-',
                        'unit_price' => $item->unit_price,
                        'quantity' => $item->quantity,
                    ];
                });

            return response()->json(['data' => $history]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // 🗑️ ฟังก์ชันลบใบสั่งซื้อ (ลบได้เฉพาะสถานะ Pending เท่านั้น)
    public function destroy($id)
    {
        try {
            $po = PurchaseOrder::find($id);

            if (!$po) {
                return response()->json(['message' => 'ไม่พบข้อมูลใบสั่งซื้อนี้ในระบบ'], 404);
            }
            // 🚀 ป้องกันความผิดพลาด: ห้ามลบบิลที่ยืนยันสั่งซื้อไปแล้ว
            if ($po->status !== 'Pending' && $po->status !== 'Cancelled') {
                return response()->json([
                    'message' => 'ไม่สามารถลบได้! เอกสารนี้ถูกอนุมัติหรือรับสินค้าไปแล้ว'
                ], 400);
            }

            DB::beginTransaction();

            // ลบรายการสินค้าข้างในบิลทิ้งก่อน (ป้องกันข้อมูลตกค้างในฐานข้อมูล)
            $po->items()->delete();

            // ลบตัวเอกสารใบสั่งซื้อ
            $po->delete();

            DB::commit();
            return response()->json(['message' => 'ลบใบสั่งซื้อสำเร็จ']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาดในการลบ: ' . $e->getMessage()], 500);
        }
    }

    // ❌ ฟังก์ชันยกเลิกเอกสาร (Void)
    public function cancel($id)
    {
        DB::beginTransaction();
        try {
            $po = PurchaseOrder::find($id);
            if (!$po) {
                DB::rollBack();
                return response()->json(['message' => 'ไม่พบข้อมูลใบสั่งซื้อ'], 404);
            }

            // เช็คว่าถ้ามีการรับของไปแล้ว (Partial/Completed) จะยกเลิกไม่ได้
            if ($po->status === 'Partial' || $po->status === 'Completed') {
                DB::rollBack();
                return response()->json(['message' => 'ไม่สามารถยกเลิกได้ เนื่องจากมีการรับสินค้าไปแล้ว (กรุณาใช้ฟังก์ชันปิดใบสั่งซื้อแทน)'], 400);
            }

            $po->update(['status' => 'Cancelled']);
            DB::commit();
            return response()->json(['message' => 'ยกเลิกเอกสารสำเร็จ', 'status' => 'Cancelled']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // 🔒 ฟังก์ชันปิดใบสั่งซื้อแบบบังคับ (Force Close) ใช้เมื่อรับของไม่ครบและจะไม่รับแล้ว
    public function forceClose(Request $request, $id)
    {
        // 🚀 บังคับให้ระบุเหตุผลทุกครั้ง (เช่น ผู้ขายแจ้งของหมด/เลิกผลิต) — validate ก่อนเข้า try/catch
        // เพราะ catch ด้านล่างจับ \Exception กว้างๆ ถ้า validate อยู่ในนั้นจะไปเคลม ValidationException
        // ทำให้ตอบ error 500 ข้อความรวมแทนที่จะเป็น 422 แจ้ง field ที่ผิดตามมาตรฐาน Laravel
        $request->validate([
            'reason' => 'required|string|max:255',
        ]);

        DB::beginTransaction();
        try {
            $po = PurchaseOrder::find($id);
            if (!$po) {
                DB::rollBack();
                return response()->json(['message' => 'ไม่พบข้อมูลใบสั่งซื้อ'], 404);
            }

            // ต้องมีสถานะเป็น Partial เท่านั้นถึงจะอนุญาตให้กดปิดบิลได้
            if ($po->status !== 'Partial') {
                DB::rollBack();
                return response()->json([
                    'message' => 'ไม่สามารถปิดใบสั่งซื้อได้ (ฟังก์ชันนี้ใช้ได้เฉพาะบิลที่มีสถานะรับสินค้าบางส่วนเท่านั้น)'
                ], 400);
            }

            // เก็บเหตุผลไว้ต่อท้ายหมายเหตุเดิม ตาม pattern เดียวกับที่ใช้บันทึกเหตุผลยกเลิกใบรับสินค้า
            // (GoodsReceiptController::cancelGoodsReceipt)
            $po->note = $po->note
                ? $po->note . "\n[ปิดใบสั่งซื้อก่อนรับครบ]: " . $request->reason
                : "[ปิดใบสั่งซื้อก่อนรับครบ]: " . $request->reason;
            // บังคับเปลี่ยนสถานะเป็น Completed
            $po->status = 'Completed';
            $po->save();

            DB::commit();
            return response()->json(['message' => 'ปิดใบสั่งซื้อสำเร็จ (สถานะเปลี่ยนเป็นรับของครบแล้ว)', 'status' => 'Completed']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // 🔍 1. ฟังก์ชันดึงรายการสินค้าคงค้างจาก PO (สำหรับเอาไปโหลดโชว์ในหน้าสร้างใบ GR)
    public function getPendingItems($id)
    {
        try {
            $po = PurchaseOrder::with(['items.product', 'contact', 'warehouse', 'project'])->find($id);
            if (!$po) return response()->json(['message' => 'ไม่พบข้อมูลใบสั่งซื้อ'], 404);
            if ($po->status === 'Pending' || $po->status === 'Draft') {
                return response()->json(['message' => 'ใบสั่งซื้อนี้ยังไม่ได้รับการอนุมัติราคา'], 400);
            }

            // กรองเอาเฉพาะสินค้าที่ยอดรับจริง ยังน้อยกว่ายอดที่สั่งซื้อ
            $pendingItems = $po->items->map(function ($item) {
                $remaining = $item->quantity - ($item->received_quantity ?? 0);
                return [
                    'po_item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product->name,
                    'sku' => $item->product->sku,
                    'has_serial_number' => $item->product->has_serial_number,
                    'ordered_qty' => $item->quantity,
                    'received_qty' => $item->received_quantity ?? 0,
                    'remaining_qty' => $remaining > 0 ? $remaining : 0
                ];
            })->filter(function ($item) {
                return $item['remaining_qty'] > 0;
            })->values();

            return response()->json([
                'po_number' => $po->po_number,
                'supplier_name' => $po->contact->business_name ?? $po->contact->name ?? '-',
                'warehouse_name' => $po->warehouse->name ?? 'ไม่ระบุ',
                'warehouse_id' => $po->warehouse_id,
                'project_name' => $po->project->name ?? '-',
                'items' => $pendingItems
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }
}
