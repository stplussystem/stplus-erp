<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SaleDocument;
use App\Models\SaleDocumentItem;
use App\Models\SaleDocumentInvoiceRef;
use App\Models\Product;
use App\Models\ProductSerial;
use App\Models\StockBalance;
use App\Models\Warehouse;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class SaleDocumentController extends Controller
{
    private const DOC_TYPES = ['quotation', 'custom_quotation', 'billing_invoice', 'tax_invoice', 'cash', 'custom_cash', 'receipt', 'credit_note', 'debit_note', 'delivery_note', 'stock_issue', 'stock_return', 'rental_stock_return', 'material_issue', 'loan_issue', 'loan_return', 'invoice'];

    // 🛡️ ฟังก์ชันเช็คสิทธิ์ (API Guard) แบบแยกตามประเภทเอกสาร เช่น hasPermission('create', 'tax_invoice') เช็ค create_tax_invoice
    private function hasPermission(string $action, string $documentType): bool
    {
        $user = auth()->user();
        if ($user->is_platform_admin) return true;
        if ($user->isCompanyAdmin()) return true;
        return $user->can("{$action}_{$documentType}");
    }

    // ประเภทเอกสารที่ user คนปัจจุบันมีสิทธิ์ view (ใช้ตอน index ที่ไม่ได้ระบุ ?type= มา)
    private function viewableTypes(): array
    {
        $user = auth()->user();
        if ($user->is_platform_admin || $user->isCompanyAdmin()) return self::DOC_TYPES;
        return array_values(array_filter(self::DOC_TYPES, fn($type) => $user->can("view_{$type}")));
    }

    // 🔗 ผูก S/N ที่เลือกเข้ากับ item ตอน store()/update() — ยังไม่ authoritative (แค่บันทึกไว้ก่อน)
    // การยึด S/N จริง (mark sold/rented/available) เกิดที่ approve() เท่านั้น ตามดีไซน์เดิมที่ store() ไม่แตะสต๊อกเลย
    // $expectedStatus: สถานะที่ S/N ต้องมีอยู่ตอนนี้ถึงจะเลือกได้ — ปกติคือ 'available' (จะเบิก/ขาย)
    // แต่ใบคืนสินค้า (stock_return) ต้องเลือกจาก S/N ที่ 'rented' อยู่ (คืนอุปกรณ์เช่า) หรือ 'sold' อยู่ (คืนสินค้าที่ขายไปแล้ว อ้างอิงใบลดหนี้)
    private function attachItemSerials(SaleDocumentItem $item, array $serialNumbers, string $expectedStatus = 'available'): void
    {
        $product = Product::find($item->product_id);
        if (!$product || !$product->has_serial_number) {
            return; // สินค้าไม่ใช้ S/N ไม่ต้องเช็ค
        }

        if (count($serialNumbers) !== (int) $item->quantity) {
            throw new \Exception(
                "S/N ไม่ครบสำหรับสินค้า {$product->name} (ต้องการ {$item->quantity} ชิ้น แต่ระบุมา " . count($serialNumbers) . " รายการ)"
            );
        }

        $matchedSerials = ProductSerial::whereIn('serial_number', $serialNumbers)
            ->where('product_id', $item->product_id)
            ->where('status', $expectedStatus)
            ->get()
            ->keyBy('serial_number');

        if ($matchedSerials->count() !== count($serialNumbers)) {
            $errorMsg = match ($expectedStatus) {
                'rented' => "มี S/N บางรายการของสินค้า {$product->name} ไม่ได้อยู่ในสถานะเช่าออก (อาจถูกคืนไปแล้วหรือเลือกผิดใบเบิก)",
                'sold' => "มี S/N บางรายการของสินค้า {$product->name} ไม่ได้อยู่ในสถานะขายออก (อาจถูกคืนไปแล้วหรือเลือกผิดรายการ)",
                default => "มี S/N บางรายการของสินค้า {$product->name} ไม่พร้อมขาย (อาจถูกขายไปแล้วหรือไม่มีในระบบ)",
            };
            throw new \Exception($errorMsg);
        }

        foreach ($serialNumbers as $sn) {
            $item->serials()->attach($matchedSerials[$sn]->id);
        }
    }

    public function index(Request $request)
    {
        $query = SaleDocument::with(['contact', 'creator'])->where('company_id', auth()->user()->company_id);

        // 🎪 กรองตามงานเช่า ถ้ามีการส่งมา (ใช้ตอนเลือกใบเบิกสินค้าอ้างอิงในหน้าสร้างใบคืนสินค้า)
        if ($request->filled('rental_job_id')) {
            $query->where('rental_job_id', $request->rental_job_id);
        }
        // 🎪 กรองตามโครงการ ถ้ามีการส่งมา (ใช้ตอนเลือกใบเสนอราคาของโครงการนั้นในหน้าสร้างใบเบิกสินค้า)
        // project_id=none = ใบเสนอราคาที่ไม่มีโครงการเลย (ใช้ตอนสร้างใบเบิกสินค้าโดยไม่เลือกโครงการ)
        if ($request->filled('project_id')) {
            if ($request->project_id === 'none') {
                $query->whereNull('project_id');
            } else {
                $query->where('project_id', $request->project_id);
            }
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // กรองตามประเภทเอกสาร ถ้ามีการส่งมา (เช่น ?type=quotation)
        if ($request->has('type')) {
            if (!$this->hasPermission('view', $request->type)) {
                return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารประเภทนี้'], 403);
            }
            $query->where('document_type', $request->type);
        } else {
            // ไม่ได้ระบุประเภท: กรองให้เห็นเฉพาะประเภทที่มีสิทธิ์ดู
            $allowed = $this->viewableTypes();
            if (empty($allowed)) return response()->json([]);
            $query->whereIn('document_type', $allowed);
        }

        return response()->json($query->latest()->get());
    }

    // POST /api/sale-documents/custom-quotations/upload-logo — อัปโหลดโลโก้เฉพาะเอกสารสำหรับใบเสนอราคาแบบกำหนดเอง
    // แยก endpoint ต่างหากจาก store()/update() เพราะสอง endpoint นั้นรับ JSON (มี items เป็น array ซ้อน) ไม่ใช่ multipart form
    // 🛡️ validate ชนิดไฟล์เข้มงวด (image + mimes + จำกัดขนาด) ตาม pattern เดียวกับ qr_code_image ใน ContactController
    public function uploadCustomLogo(Request $request)
    {
        if (!$this->hasPermission('create', 'custom_quotation') && !$this->hasPermission('edit', 'custom_quotation')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์อัปโหลดโลโก้สำหรับใบเสนอราคาแบบกำหนดเอง'], 403);
        }

        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        $path = $request->file('logo')->store('custom_quotations/logos', 'public');

        return response()->json(['path' => $path, 'url' => Storage::disk('public')->url($path)]);
    }

    // POST /api/sale-documents/custom-cash-sales/upload-logo — เหมือน uploadCustomLogo() ทุกประการ แต่แยก path เก็บไฟล์
    // และเช็คสิทธิ์ตาม custom_cash แทน (บิลเงินสดแบบกำหนดเอง)
    public function uploadCustomCashLogo(Request $request)
    {
        if (!$this->hasPermission('create', 'custom_cash') && !$this->hasPermission('edit', 'custom_cash')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์อัปโหลดโลโก้สำหรับบิลเงินสดแบบกำหนดเอง'], 403);
        }

        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        $path = $request->file('logo')->store('custom_cash/logos', 'public');

        return response()->json(['path' => $path, 'url' => Storage::disk('public')->url($path)]);
    }

    public function store(Request $request)
    {
        // 🎗️ ใบยืมสินค้าแบบ "ยืมของจากลูกค้า" (borrow_in) — สินค้าไม่ใช่ของเรา ไม่ผูกกับ catalog/สต๊อกเลย
        // กรอกชื่อรายการเป็นข้อความอิสระผ่าน item_name แทน product_id (ดู migration ที่เปิด product_id ให้ nullable)
        // ใบคืนสินค้ายืมที่อ้างอิงใบยืม borrow_in ก็ต้องนับเป็น borrow_in เหมือนกัน (item_name ล้วน ไม่มี product_id เช่นกัน)
        $isBorrowIn = $request->document_type === 'loan_issue' && $request->loan_direction === 'borrow_in';
        if ($request->document_type === 'loan_return' && $request->reference_document_id) {
            $refDoc = SaleDocument::find($request->reference_document_id);
            $isBorrowIn = $isBorrowIn || ($refDoc && $refDoc->loan_direction === 'borrow_in');
        }

        // 🎗️ ใบกำกับภาษี/ใบส่งสินค้า ที่อ้างอิงใบเบิกสินค้า (material_issue) — รายการสินค้าต้อง "ล็อก" ให้ตรงกับใบเบิกทุกประการ
        // items ที่ client ส่งมาจะถูกเมินทั้งหมด (ใช้แค่แสดงผลฝั่ง frontend) แล้วคัดลอกจาก material_issue ตรงๆ แทน กันแก้ไขตัวเลขที่ต้องห้าม
        $materialIssueLock = null;
        if (in_array($request->document_type, ['tax_invoice', 'delivery_note']) && $request->reference_document_id) {
            $refDoc = SaleDocument::with('items.serials')->find($request->reference_document_id);
            if ($refDoc && $refDoc->document_type === 'material_issue') {
                $materialIssueLock = $refDoc;
            }
        }

        // 🧾 ใบวางบิล/ใบเสร็จรับเงิน อ้างอิงใบกำกับภาษีที่อนุมัติแล้วได้หลายใบแทนการกรอกรายการสินค้าเอง — ถ้าส่ง invoice_refs
        // มา ไม่บังคับ items เลย (ตารางสินค้าไม่มีความหมายในโหมดนี้ ยอดคำนวณจากใบกำกับภาษีที่เลือกแทน ดู logic ท้ายฟังก์ชัน)
        $hasInvoiceRefs = in_array($request->document_type, ['billing_invoice', 'receipt'])
            && is_array($request->invoice_refs) && count($request->invoice_refs) > 0;

        $request->validate([
            'document_type' => 'required|string|in:' . implode(',', self::DOC_TYPES),
            // 🎗️ ใบยืมสินค้า/ใบคืนสินค้ายืมไม่บังคับผูกกับลูกค้าในระบบ (อาจกรอกผู้ยืมเองผ่าน borrower_name แทน ใบคืนก็สืบทอด
            // สถานะไม่มีลูกค้ามาจากใบยืมต้นทางได้เช่นกัน) — ประเภทอื่นยังบังคับเหมือนเดิม
            'contact_id' => in_array($request->document_type, ['loan_issue', 'loan_return']) ? 'nullable|exists:contacts,id' : 'required|exists:contacts,id',
            'borrower_name' => 'nullable|string|max:255',
            'borrower_phone' => 'nullable|string|max:50',
            'loan_direction' => 'nullable|in:lend_out,borrow_in',
            'project_id' => 'nullable|integer',
            'rental_job_id' => 'nullable|integer',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'issue_date' => 'nullable|date',
            'credit_days' => 'nullable|integer|min:0',
            // 🎗️ ใบยืมสินค้า — วันที่ต้องคืน กรอกตรงๆ ไม่คำนวณจาก credit_days (ดู logic ด้านล่าง)
            'due_date' => 'nullable|date',
            'tax_type' => 'required|in:include,exclude,none',
            'items' => $hasInvoiceRefs ? 'nullable|array' : 'required|array|min:1',
            'items.*.product_id' => $isBorrowIn ? 'nullable' : 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.1',
            'items.*.unit_price' => 'required|numeric|min:0',
            // 💰 ราคาต้นทุนต่อรายการ — เก็บไว้คำนวณกำไร-ขาดทุน ไม่แสดงตอนพิมพ์เอกสาร (ดู SalesPdfTemplate.tsx)
            'items.*.cost_price' => 'nullable|numeric|min:0',
            'items.*.serials' => 'nullable|array',
            'items.*.serials.*' => 'string|exists:product_serials,serial_number',
            // 📦 สินค้าชุด (Bundle): item_name = ชื่อรายการที่แก้ไขได้ (เช่น แถวแม่สินค้าชุด),
            // parent_index = ตำแหน่งของแถวแม่ใน array นี้ (ระบุว่าแถวนี้เป็นส่วนประกอบของแถวไหน — ไม่ persist ตรงๆ)
            'items.*.item_name' => 'nullable|string|max:255',
            'items.*.parent_index' => 'nullable|integer|min:0',
            // 🧾 ใบวางบิล/ใบเสร็จรับเงิน — รายการใบกำกับภาษีที่อ้างอิง (many-to-many)
            'invoice_refs' => 'nullable|array',
            'invoice_refs.*.tax_invoice_id' => 'required_with:invoice_refs|integer',
            'invoice_refs.*.payment_amount' => 'nullable|numeric|min:0',
            // grand_total: ไม่เชื่อค่าที่ client ส่งมาอีกต่อไป คำนวณเองจาก subtotal/discount/vat เสมอ (ดู logic ท้ายฟังก์ชัน)
            'discount_amount' => 'nullable|numeric|min:0',
            'vat_amount' => 'nullable|numeric|min:0',
            'wht_amount' => 'nullable|numeric|min:0',
            // 🖨️ ฟิลด์สำหรับพิมพ์ใบกำกับภาษี/ใบส่งสินค้าตามแบบฟอร์มจริง (reference_number มีอยู่แล้วด้านบนใช้เป็นเลขที่ P.O./Order No.)
            'transportation' => 'nullable|string|max:255',
            'saleman_code' => 'nullable|string|max:100',
            // 💳 วิธีการชำระเงิน — ใช้จริงเฉพาะใบเสนอราคา (frontend ส่งเป็น string อิสระ เลือกจากรายการหรือพิมพ์เอง)
            'payment_method' => 'nullable|string|max:255',
            'deposit_amount' => 'nullable|numeric|min:0',
            // 🎨 ใบเสนอราคาแบบกำหนดเอง — logo อัปโหลดผ่าน endpoint แยก (uploadCustomLogo) แล้วส่ง path ที่ได้กลับมาที่นี่
            'custom_logo_path' => 'nullable|string|max:500',
            'custom_company_name' => 'nullable|string|max:255',
            'custom_company_address' => 'nullable|string|max:1000',
            'custom_quoter_name' => 'nullable|string|max:255',
            // 💰 custom_quotation/custom_cash เท่านั้น — ผู้ใช้พิมพ์ทับ Subtotal เองได้ ไม่ผูกกับผลรวมรายการสินค้า
            'subtotal_override' => 'nullable|numeric|min:0',
        ]);

        // 🛡️ เช็คสิทธิ์ตามประเภทเอกสารที่ส่งมา (หลัง validate แล้วว่าเป็นค่าที่ถูกต้อง)
        if (!$this->hasPermission('create', $request->document_type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์สร้างเอกสารประเภทนี้'], 403);
        }

        // 🎗️ ใบเบิกสินค้าต้นทางต้องอนุมัติแล้วเท่านั้นถึงจะสร้างเอกสารอ้างอิงต่อได้ (ของยังไม่ถูกจองจริงจนกว่าจะอนุมัติ)
        if ($materialIssueLock && $materialIssueLock->status !== 'Approved') {
            return response()->json(['message' => 'ใบเบิกสินค้าที่อ้างอิงต้องอนุมัติแล้วก่อนจึงจะสร้างเอกสารนี้ได้'], 422);
        }

        // 🎗️ ใบยืมสินค้าต้องระบุผู้ยืม/ผู้ให้ยืมอย่างน้อยทางใดทางหนึ่ง — เลือกลูกค้าจากระบบ หรือกรอกชื่อเอง
        if ($request->document_type === 'loan_issue' && !$request->contact_id && !$request->filled('borrower_name')) {
            return response()->json([
                'message' => $isBorrowIn ? 'กรุณาเลือกลูกค้าจากระบบ หรือระบุชื่อผู้ให้ยืม' : 'กรุณาเลือกลูกค้าจากระบบ หรือระบุชื่อผู้ยืมเอง',
                'errors' => ['borrower_name' => ['กรุณาระบุคู่สัญญาให้ครบ']],
            ], 422);
        }
        // 🎗️ โหมด "ยืมของจากลูกค้า" ไม่มี product_id ให้ยึด — ต้องมีชื่อรายการกำกับทุกแถวแทน
        if ($isBorrowIn && collect($request->items)->contains(fn ($item) => empty($item['item_name'] ?? null))) {
            return response()->json([
                'message' => 'กรุณาระบุชื่อสินค้าที่ยืมมาให้ครบทุกแถว',
                'errors' => ['items' => ['กรุณาระบุชื่อสินค้าที่ยืมมาให้ครบทุกแถว']],
            ], 422);
        }

        // 🧾 ใบวางบิล/ใบเสร็จรับเงินที่อ้างอิงใบกำกับภาษี — ทุกใบต้องเป็น tax_invoice ที่อนุมัติแล้วของบริษัทเดียวกันเท่านั้น
        if ($hasInvoiceRefs) {
            $refIds = collect($request->invoice_refs)->pluck('tax_invoice_id')->unique();
            $validTaxInvoices = SaleDocument::whereIn('id', $refIds)
                ->where('company_id', auth()->user()->company_id)
                ->where('document_type', 'tax_invoice')
                ->where('status', 'Approved')
                ->pluck('id');
            if ($validTaxInvoices->count() !== $refIds->count()) {
                return response()->json([
                    'message' => 'มีใบกำกับภาษีบางรายการที่เลือกไม่ถูกต้อง หรือยังไม่อนุมัติ',
                    'errors' => ['invoice_refs' => ['กรุณาเลือกเฉพาะใบกำกับภาษีที่อนุมัติแล้ว']],
                ], 422);
            }
        }

        try {
            DB::beginTransaction();
            $companyId = auth()->user()->company_id;

            // 🧠 1. รันเลขที่เอกสารอัจฉริยะ (แยกตามประเภทเอกสาร) — ใช้ DocumentService กลางร่วมกับ PO/GR
            $docNumber = DocumentService::generate($request->document_type, $companyId);

            // 📅 2. คำนวณ Due Date — ใบยืมสินค้าใช้ "วันที่ต้องคืน" ที่กรอกตรงๆ แทนการคำนวณจาก credit_days
            $dueDate = null;
            if ($request->document_type === 'loan_issue' && $request->filled('due_date')) {
                $dueDate = $request->due_date;
            } elseif ($request->issue_date && $request->credit_days > 0) {
                $dueDate = Carbon::parse($request->issue_date)->addDays($request->credit_days)->format('Y-m-d');
            }

            // 📝 3. สร้างหัวบิลเอกสารขาย
            $document = SaleDocument::create([
                'company_id' => $companyId,
                'project_id' => $request->project_id,
                'rental_job_id' => $request->rental_job_id,
                // 🎗️ ล็อกคลังสินค้าให้ตรงกับใบเบิกต้นทางเสมอ (กันปลดจอง/ตัดสต๊อกผิดคลังตอนอนุมัติ)
                'warehouse_id' => $materialIssueLock ? $materialIssueLock->warehouse_id : $request->warehouse_id,
                'contact_id' => $request->contact_id,
                'borrower_name' => $request->borrower_name,
                'borrower_phone' => $request->borrower_phone,
                'loan_direction' => $request->document_type === 'loan_issue' ? ($request->loan_direction ?? 'lend_out') : null,
                'document_type' => $request->document_type,
                'document_number' => $docNumber,
                'reference_document_id' => $request->reference_document_id,
                'reference_number' => $request->reference_number,
                'transportation' => $request->transportation,
                'saleman_code' => $request->saleman_code,
                'payment_method' => $request->payment_method,
                'status' => 'Pending',
                'issue_date' => $request->issue_date,
                'credit_days' => $request->credit_days ?? 0,
                'due_date' => $dueDate,
                'currency' => $request->currency ?? 'THB',
                'tax_type' => $request->tax_type,
                'subtotal' => 0,
                'discount_amount' => $request->discount_amount ?? 0,
                'deposit_amount' => $request->deposit_amount ?? 0,
                'vat_amount' => $request->vat_amount ?? 0,
                'wht_amount' => $request->wht_amount ?? 0,
                'grand_total' => 0, // คำนวณจริงหลังทราบ subtotal ด้านล่าง ไม่เชื่อค่าที่ client ส่งมาตรงๆ
                'note' => $request->note,
                'custom_logo_path' => $request->custom_logo_path,
                'custom_company_name' => $request->custom_company_name,
                'custom_company_address' => $request->custom_company_address,
                'custom_quoter_name' => $request->custom_quoter_name,
                'created_by' => auth()->id(),
            ]);

            $subtotal = 0;

            // 🎪 ใบคืนสินค้าต้องรู้ว่า S/N ที่เลือกควรอยู่ในสถานะไหนอยู่ก่อน — ขึ้นกับว่าอ้างอิง "ใบเบิกสินค้า" (rented) หรือ "ใบลดหนี้" (sold)
            // stock_return (คืนจากใบลดหนี้) กับ rental_stock_return (คืนงานเช่า) เป็นคนละ document_type แล้ว แต่ยังเช็ค
            // ประเภทเอกสารต้นทางไว้เป็น safety net เดิม (rental_stock_return จะอ้างอิง stock_issue เสมอ ไม่มีทางเป็น credit_note)
            $stockReturnExpectedStatus = 'rented';
            if (in_array($request->document_type, ['stock_return', 'rental_stock_return']) && $request->reference_document_id) {
                $referencedDoc = SaleDocument::find($request->reference_document_id);
                if ($referencedDoc && $referencedDoc->document_type === 'credit_note') {
                    $stockReturnExpectedStatus = 'sold';
                }
            }

            if ($hasInvoiceRefs) {
                // 🧾 4. ใบวางบิล/ใบเสร็จรับเงิน — ไม่มีรายการสินค้าเลย มีแต่ตารางอ้างอิงใบกำกับภาษีที่เลือก
                // billing_invoice: ยอด = ผลรวม grand_total ของใบกำกับภาษีที่เลือก (แค่แจ้งยอดที่จะเรียกเก็บ ยังไม่มีการจ่ายจริง)
                // receipt: ยอด = ผลรวม payment_amount ที่กรอกต่อใบ (ยอดที่จ่ายจริงในใบเสร็จนี้ อาจไม่เท่า grand_total ถ้าจ่ายบางส่วน)
                $refRows = collect($request->invoice_refs)->keyBy('tax_invoice_id');
                $refTaxInvoices = SaleDocument::whereIn('id', $refRows->keys())->get()->keyBy('id');
                foreach ($refRows as $taxInvoiceId => $refRow) {
                    $taxInvoice = $refTaxInvoices[$taxInvoiceId];
                    $paymentAmount = $request->document_type === 'receipt' ? (float) ($refRow['payment_amount'] ?? 0) : null;
                    $subtotal += $request->document_type === 'receipt' ? ($paymentAmount ?? 0) : (float) $taxInvoice->grand_total;

                    SaleDocumentInvoiceRef::create([
                        'sale_document_id' => $document->id,
                        'tax_invoice_id' => $taxInvoiceId,
                        'payment_amount' => $paymentAmount,
                    ]);
                }
                // ไม่หัก/บวกส่วนลด-ภาษีเพิ่มเติม — เอกสารประเภทนี้เป็นแค่ตัวรวบรวม/รับชำระยอดจากใบกำกับภาษีที่คิดภาษีไปแล้ว
                $document->update(['discount_amount' => 0, 'vat_amount' => 0, 'wht_amount' => 0]);
            } elseif ($materialIssueLock) {
                // 🎗️ 4. รายการสินค้า "ล็อก" ตรงจากใบเบิกสินค้าต้นทาง — เมิน $request->items ทั้งหมด (client ส่งมาแค่โชว์ผล ไม่มีผลจริง)
                // คัดลอก product_id/quantity/ราคา/ส่วนลด ตรงๆ พร้อม attach S/N เดิมที่ผูกกับใบเบิกอยู่แล้ว (ห้ามใช้ attachItemSerials
                // เพราะ S/N สถานะ 'rented' ไม่ใช่ 'available' ที่ attachItemSerials คาดหวัง)
                foreach ($materialIssueLock->items as $sourceItem) {
                    $netItemPrice = (float) $sourceItem->total_price;
                    $subtotal += $netItemPrice;

                    $newItem = SaleDocumentItem::create([
                        'sale_document_id' => $document->id,
                        'product_id' => $sourceItem->product_id,
                        'item_name' => $sourceItem->item_name,
                        'quantity' => $sourceItem->quantity,
                        'unit_name' => $sourceItem->unit_name,
                        'unit_price' => $sourceItem->unit_price,
                        'cost_price' => $sourceItem->cost_price,
                        'discount_percent' => $sourceItem->discount_percent,
                        'discount_amount' => $sourceItem->discount_amount,
                        'tax_rate' => $sourceItem->tax_rate,
                        'tax_amount' => $sourceItem->tax_amount,
                        'wht_rate' => $sourceItem->wht_rate,
                        'wht_amount' => $sourceItem->wht_amount,
                        'total_price' => $netItemPrice,
                    ]);

                    foreach ($sourceItem->serials as $serial) {
                        $newItem->serials()->attach($serial->id);
                    }
                }
                // หมายเหตุ: material_issue ไม่รองรับสินค้าชุด (Bundle) ในสายนี้ — ไม่ต้องทำ pass สอง (parent_item_id remap)
            } else {
                // 🛒 4. บันทึกรายการสินค้า (2-pass เพื่อรองรับแถวลูก/ส่วนประกอบสินค้าชุดที่ต้องอ้างอิง ID ของแถวแม่ที่เพิ่งสร้าง)
                // pass แรก: สร้างทุกแถวตามเดิม — แถวที่มี parent_index (เป็นส่วนประกอบ) บังคับราคา/ส่วนลด = 0 กันบวกราคาซ้ำ
                $createdItems = [];
                foreach ($request->items as $index => $item) {
                    $isBundleChild = isset($item['parent_index']);
                    $unitPrice = $isBundleChild ? 0 : $item['unit_price'];
                    $costPrice = $isBundleChild ? 0 : ($item['cost_price'] ?? null);
                    $itemDiscount = $isBundleChild ? 0 : ($item['discount_amount'] ?? 0);
                    $totalPrice = $item['quantity'] * $unitPrice;
                    $netItemPrice = $totalPrice - $itemDiscount;

                    $subtotal += $netItemPrice;

                    $newItem = SaleDocumentItem::create([
                        'sale_document_id' => $document->id,
                        'product_id' => $item['product_id'] ?? null,
                        'item_name' => $item['item_name'] ?? null,
                        'quantity' => $item['quantity'],
                        'unit_name' => $item['unit_name'] ?? 'ชิ้น',
                        'unit_price' => $unitPrice,
                        'cost_price' => $costPrice,
                        'discount_percent' => $isBundleChild ? null : ($item['discount_percent'] ?? null),
                        'discount_amount' => $itemDiscount,
                        'tax_rate' => $isBundleChild ? 0 : ($item['tax_rate'] ?? 0),
                        'tax_amount' => $isBundleChild ? 0 : ($item['tax_amount'] ?? 0),
                        'wht_rate' => $isBundleChild ? null : ($item['wht_rate'] ?? null),
                        'wht_amount' => $isBundleChild ? 0 : ($item['wht_amount'] ?? 0),
                        'total_price' => $netItemPrice,
                    ]);
                    $createdItems[$index] = $newItem;

                    // 📝 ใบเสนอราคา/ใบวางบิล/ใบลดหนี้ ไม่ตัดสต๊อกหรือยึด S/N จริง — ไม่บังคับเลือก S/N ตอนสร้าง
                    // (ใบลดหนี้ไม่ผูก S/N โดยตรงอีกต่อไป — ของจริงจะกลับเข้าคลังแบบระบุ S/N ผ่าน "ใบคืนสินค้า" ที่อ้างอิงใบลดหนี้นี้แทน)
                    // 🎗️ แถว "ยืมของจากลูกค้า" ไม่มี product_id เลย — ข้าม attachItemSerials ไปเลย ไม่มี S/N ให้ยึด
                    if (!empty($item['product_id']) && !in_array($request->document_type, ['quotation', 'custom_quotation', 'billing_invoice', 'credit_note', 'invoice'])) {
                        $this->attachItemSerials($newItem, $item['serials'] ?? [], in_array($request->document_type, ['stock_return', 'rental_stock_return', 'loan_return']) ? $stockReturnExpectedStatus : 'available');
                    }
                }

                // pass สอง: ผูกแถวส่วนประกอบเข้ากับ ID จริงของแถวแม่ที่เพิ่งสร้าง
                foreach ($request->items as $index => $item) {
                    if (isset($item['parent_index']) && isset($createdItems[$item['parent_index']])) {
                        $createdItems[$index]->update(['parent_item_id' => $createdItems[$item['parent_index']]->id]);
                    }
                }
            }

            // 🔄 5. อัปเดตยอด Subtotal + คำนวณ grand_total จริงคืนหัวบิล (ไม่หัก WHT ออก — WHT เป็นแค่
            // "ยอดสุทธิที่ต้องจ่าย" แยกต่างหาก ไม่ใช่ส่วนหนึ่งของยอดเอกสาร ตรงกับ PurchaseOrderController)
            // 🎨 เอกสารกำหนดเอง (custom_quotation/custom_cash) ผู้ใช้พิมพ์ทับ Subtotal เองได้ — ใช้ค่านั้นแทนยอดที่คำนวณจากรายการสินค้า
            // (เอกสารประเภทอื่นทั้งหมดยังคงบังคับคำนวณจากรายการสินค้าเสมอ กัน tamper เหมือนเดิม)
            $isCustomOverridable = in_array($request->document_type, ['custom_quotation', 'custom_cash']);
            if ($isCustomOverridable && $request->filled('subtotal_override')) {
                $subtotal = (float) $request->subtotal_override;
            }
            // 🧾 ใบวางบิล/ใบเสร็จรับเงินแบบอ้างอิงหลายใบ — ยอด = ผลรวมที่คำนวณไว้แล้วข้างบนตรงๆ ไม่หัก/บวกส่วนลด-ภาษีซ้ำ
            $grandTotal = $hasInvoiceRefs ? $subtotal : max(0, $subtotal - ($request->discount_amount ?? 0) + ($request->vat_amount ?? 0));
            $document->update(['subtotal' => $subtotal, 'grand_total' => $grandTotal]);

            DB::commit();
            return response()->json([
                'message' => 'สร้างเอกสารสำเร็จ',
                'data' => $document->load('items')
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // GET /api/sale-documents/outstanding-balances?type=tax_invoice — ยอดค้างชำระต่อใบกำกับภาษี (Approved เท่านั้น)
    // ใช้ในหน้าสร้างใบวางบิล/ใบเสร็จรับเงิน (โหมดอ้างอิงหลายใบ) แสดง "ยอดค้างชำระ" ต่อแถวก่อนเลือกใบมาอ้างอิง
    // outstanding = grand_total - ผลรวม payment_amount จากใบเสร็จ (receipt) ที่ Approved แล้วที่อ้างอิงใบนี้อยู่
    public function outstandingBalances(Request $request)
    {
        $companyId = auth()->user()->company_id;
        $type = $request->type ?? 'tax_invoice';
        if (!$this->hasPermission('view', $type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารประเภทนี้'], 403);
        }

        $docs = SaleDocument::where('company_id', $companyId)
            ->where('document_type', $type)
            ->where('status', 'Approved')
            ->withSum(['invoiceRefsAsTaxInvoice as paid_total' => function ($q) {
                $q->whereHas('saleDocument', fn ($q2) => $q2->where('document_type', 'receipt')->where('status', 'Approved'));
            }], 'payment_amount')
            ->orderByDesc('id')
            ->get(['id', 'document_number', 'issue_date', 'due_date', 'grand_total']);

        $data = $docs->map(fn ($d) => [
            'id' => $d->id,
            'document_number' => $d->document_number,
            'issue_date' => $d->issue_date,
            'due_date' => $d->due_date,
            'grand_total' => (float) $d->grand_total,
            'outstanding_balance' => max(0, (float) $d->grand_total - (float) ($d->paid_total ?? 0)),
        ]);

        return response()->json(['data' => $data]);
    }

    // GET /api/sale-documents/lookup?q= — ค้นเอกสารขายที่อนุมัติแล้ว (เฉพาะ 3 ประเภท stock-out) ด้วยเลขที่เอกสาร/ชื่อลูกค้า
    // ใช้สำหรับหน้ารับแจ้งซ่อมกรณีสินค้าไม่มี S/N (ต้องอ้างอิงเอกสารขายเดิมเพื่อผูกกับลูกค้า) — gate ด้วย view_repairs ไม่ใช่สิทธิ์ฝ่ายขาย
    public function lookup(Request $request)
    {
        $request->validate(['q' => 'required|string|min:1']);
        $q = $request->q;

        $documents = SaleDocument::with('contact:id,business_name')
            ->where('company_id', auth()->user()->company_id)
            ->whereIn('document_type', ['tax_invoice', 'cash', 'receipt'])
            ->where('status', 'Approved')
            ->where(function ($query) use ($q) {
                $query->where('document_number', 'like', "%{$q}%")
                    ->orWhereHas('contact', function ($c) use ($q) {
                        $c->where('business_name', 'like', "%{$q}%")->orWhere('contact_person_name', 'like', "%{$q}%");
                    });
            })
            ->latest()
            ->limit(20)
            ->get(['id', 'document_number', 'document_type', 'contact_id', 'project_id', 'issue_date']);

        return response()->json(['data' => $documents]);
    }

    // GET /api/products/{id}/sales-history?contact_id= — ราคาที่เคยขายสินค้านี้ให้ลูกค้ารายนี้ 5 ครั้งล่าสุด
    // เฉพาะใบกำกับภาษี (tax_invoice) ที่อนุมัติแล้วเท่านั้น (ตามที่ยืนยันขอบเขตไว้) ใช้ในหน้าสร้าง/แก้ไขใบเสนอราคา
    // เป็นปุ่ม "ดูรายการขายล่าสุด" ต่อแถวสินค้า — pattern เดียวกับ PurchaseOrderController::productPurchaseHistory()
    public function productSalesHistory(Request $request, $productId)
    {
        $request->validate(['contact_id' => 'required|exists:contacts,id']);

        $history = SaleDocumentItem::with('saleDocument')
            ->where('product_id', $productId)
            ->whereHas('saleDocument', function ($q) use ($request) {
                $q->where('contact_id', $request->contact_id)
                    ->where('document_type', 'tax_invoice')
                    ->where('status', 'Approved')
                    ->where('company_id', auth()->user()->company_id);
            })
            ->latest('id')
            ->take(5)
            ->get()
            ->map(fn ($item) => [
                'document_id' => $item->saleDocument->id,
                'date' => Carbon::parse($item->saleDocument->issue_date ?? $item->saleDocument->created_at)->format('d/m/Y'),
                'document_number' => $item->saleDocument->document_number,
                'unit_price' => $item->unit_price,
                'quantity' => $item->quantity,
            ]);

        return response()->json(['data' => $history]);
    }

    public function show($id)
    {
        $document = SaleDocument::with([
            'items.product', 'items.serials', 'contact', 'project', 'rentalJob', 'warehouse', 'creator', 'approver', 'referencedDocument',
            'invoiceRefs.taxInvoice',
        ])->find($id);

        if (!$document) return response()->json(['message' => 'ไม่พบเอกสาร'], 404);

        // 🛡️ เช็คสิทธิ์ดูของบริษัทอื่น + สิทธิ์ดูประเภทเอกสารนี้
        if (!auth()->user()->is_platform_admin && $document->company_id !== auth()->user()->company_id) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้'], 403);
        }
        if (!$this->hasPermission('view', $document->document_type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารประเภทนี้'], 403);
        }

        // 🛡️ แปลงโลโก้เฉพาะเอกสาร (ใบเสนอราคา/บิลเงินสดแบบกำหนดเอง) เป็น base64 ให้ตรงนี้ที่เดียว (endpoint
        // ดึงเอกสารทีละใบ ไม่ใช่ index() ที่ดึงเป็นลิสต์ยาว) — เหมือนที่ Company::logoBase64() ทำกับโลโก้บริษัท
        // เพราะ @react-pdf/renderer โหลดรูปข้าม origin (frontend :3000 → backend :8000) ด้วย URL ตรงๆ ไม่ได้
        // ต้องเป็น base64 data URI เท่านั้น
        return response()->json(['data' => array_merge($document->toArray(), [
            'custom_logo_base64' => $this->fileToBase64($document->custom_logo_path),
        ])]);
    }

    // 🛡️ มิเรอร์ logic เดียวกับ Company::logoBase64() — อ่านไฟล์จาก storage disk 'public' แล้วแปลงเป็น
    // base64 data URI สำหรับส่งให้ @react-pdf/renderer โดยเฉพาะ (โหลด URL ข้าม origin ตรงๆ ไม่ได้)
    private function fileToBase64(?string $path): ?string
    {
        if (!$path) return null;
        if (str_starts_with($path, 'http')) return $path;

        try {
            if (!Storage::disk('public')->exists($path)) return null;
            $file = Storage::disk('public')->get($path);
            $extension = pathinfo($path, PATHINFO_EXTENSION);
            return 'data:image/' . $extension . ';base64,' . base64_encode($file);
        } catch (\Exception $e) {
            return null;
        }
    }

    // GET /api/sale-documents/{id}/rented-serials — S/N ที่ยังเช่าออกอยู่ (ยังไม่ถูกคืน) จากใบเบิกสินค้าใบนี้โดยเฉพาะ
    // ใช้เป็น data source ของหน้าสร้างใบคืนสินค้า (แทนที่ /products/{id}/available-serials ที่ scope ผิด ไม่รู้ว่าเช่าออกจากใบไหน)
    public function rentedSerials($id)
    {
        $doc = SaleDocument::find($id);
        if (!$doc) return response()->json(['message' => 'ไม่พบเอกสาร'], 404);

        // 🔧 คืน serial_number ตรงๆ (array of string) ให้ตรงกับ /products/{id}/available-serials
        // เพื่อให้ SerialPickerDialog ฝั่ง frontend ใช้ซ้ำได้เลยโดยไม่ต้องแก้ logic ภายใน
        $query = ProductSerial::where('rented_via_sale_document_id', $id)->where('status', 'rented');
        if (request('product_id')) {
            $query->where('product_id', request('product_id'));
        }
        $serials = $query->pluck('serial_number');

        return response()->json(['data' => $serials]);
    }

    // GET /api/sale-documents/{id}/sold-serials — S/N ที่ขายออกไปจริง (ยังไม่ถูกคืน) จากใบกำกับภาษีต้นทางที่ "ใบลดหนี้" นี้อ้างอิงถึง
    // ใช้เป็น data source ของหน้าสร้างใบคืนสินค้า เส้นทางที่อ้างอิงใบลดหนี้ (คู่ขนานกับ rentedSerials() ฝั่งงานเช่า)
    // $id = id ของใบลดหนี้ (ไม่ใช่ใบกำกับภาษีตรงๆ) — ต้องไล่ตาม reference_document_id ของใบลดหนี้ไปหาใบกำกับภาษีต้นทางอีกที
    public function soldSerials($id)
    {
        $creditNote = SaleDocument::find($id);
        if (!$creditNote) return response()->json(['message' => 'ไม่พบเอกสาร'], 404);

        $taxInvoiceId = $creditNote->reference_document_id;
        if (!$taxInvoiceId) return response()->json(['data' => []]);

        $query = ProductSerial::where('sold_to_sale_document_id', $taxInvoiceId)->where('status', 'sold');
        if (request('product_id')) {
            $query->where('product_id', request('product_id'));
        }
        $serials = $query->pluck('serial_number');

        return response()->json(['data' => $serials]);
    }

    public function update(Request $request, $id)
    {
        $document = SaleDocument::find($id);
        if (!$document) return response()->json(['message' => 'ไม่พบเอกสาร'], 404);

        // 🛡️ API Guard ตามประเภทเอกสารจริงของเอกสารนี้
        if (!$this->hasPermission('edit', $document->document_type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์แก้ไขเอกสารนี้'], 403);
        }

        // 🎗️ ทิศทางการยืม (lend_out/borrow_in) กำหนดตอนสร้างเท่านั้น แก้ไขไม่เปิดให้เปลี่ยน (เหมือน document_type)
        // ใบคืนสินค้ายืมที่อ้างอิงใบยืม borrow_in ก็ต้องนับเป็น borrow_in เหมือนกัน (เหมือน store())
        $isBorrowIn = $document->document_type === 'loan_issue' && $document->loan_direction === 'borrow_in';
        if ($document->document_type === 'loan_return' && $document->reference_document_id) {
            $refDoc = SaleDocument::find($document->reference_document_id);
            $isBorrowIn = $isBorrowIn || ($refDoc && $refDoc->loan_direction === 'borrow_in');
        }

        // 🎗️ เอกสารนี้ล็อกรายการสินค้าตามใบเบิกสินค้า (material_issue) หรือไม่ — ทิศทางเดียวกับ store() ตรวจจากค่าที่บันทึกไว้แล้ว (immutable หลังสร้าง)
        $materialIssueLock = null;
        if (in_array($document->document_type, ['tax_invoice', 'delivery_note']) && $document->reference_document_id) {
            $refDoc = SaleDocument::find($document->reference_document_id);
            if ($refDoc && $refDoc->document_type === 'material_issue') $materialIssueLock = $refDoc;
        }

        // 🧾 ใบวางบิล/ใบเสร็จรับเงิน อ้างอิงใบกำกับภาษีที่อนุมัติแล้วได้หลายใบแทนการกรอกรายการสินค้าเอง (เหมือน store())
        $hasInvoiceRefs = in_array($document->document_type, ['billing_invoice', 'receipt'])
            && is_array($request->invoice_refs) && count($request->invoice_refs) > 0;

        // 🛡️ เพิ่ม validation ที่ขาดหายไป — เดิม update() ไม่ตรวจสอบอะไรเลย รับค่าจาก request ตรงๆ ทุกฟิลด์
        $request->validate([
            // 🎗️ ใบยืมสินค้า/ใบคืนสินค้ายืมไม่บังคับผูกกับลูกค้าในระบบ (เหมือน store()) — ประเภทอื่นยังบังคับเหมือนเดิม
            'contact_id' => in_array($document->document_type, ['loan_issue', 'loan_return']) ? 'sometimes|nullable|exists:contacts,id' : 'sometimes|exists:contacts,id',
            'borrower_name' => 'nullable|string|max:255',
            'borrower_phone' => 'nullable|string|max:50',
            'project_id' => 'nullable|integer',
            'rental_job_id' => 'nullable|integer',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'issue_date' => 'nullable|date',
            'credit_days' => 'nullable|integer|min:0',
            'due_date' => 'nullable|date',
            'tax_type' => 'sometimes|in:include,exclude,none',
            'discount_amount' => 'nullable|numeric|min:0',
            'vat_amount' => 'nullable|numeric|min:0',
            'wht_amount' => 'nullable|numeric|min:0',
            'transportation' => 'nullable|string|max:255',
            'saleman_code' => 'nullable|string|max:100',
            'payment_method' => 'nullable|string|max:255',
            'deposit_amount' => 'nullable|numeric|min:0',
            'custom_logo_path' => 'nullable|string|max:500',
            'custom_company_name' => 'nullable|string|max:255',
            'custom_company_address' => 'nullable|string|max:1000',
            'custom_quoter_name' => 'nullable|string|max:255',
            'subtotal_override' => 'nullable|numeric|min:0',
            'items' => 'sometimes|array|min:1',
            'items.*.product_id' => $isBorrowIn ? 'nullable' : 'required_with:items|exists:products,id',
            'items.*.quantity' => 'required_with:items|numeric|min:0.1',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
            'items.*.cost_price' => 'nullable|numeric|min:0',
            'items.*.serials' => 'nullable|array',
            'items.*.serials.*' => 'string|exists:product_serials,serial_number',
            'items.*.item_name' => 'nullable|string|max:255',
            'items.*.parent_index' => 'nullable|integer|min:0',
            // 🧾 ใบวางบิล/ใบเสร็จรับเงิน — รายการใบกำกับภาษีที่อ้างอิง (many-to-many)
            'invoice_refs' => 'nullable|array',
            'invoice_refs.*.tax_invoice_id' => 'required_with:invoice_refs|integer',
            'invoice_refs.*.payment_amount' => 'nullable|numeric|min:0',
        ]);

        // 🧾 ใบวางบิล/ใบเสร็จรับเงินที่อ้างอิงใบกำกับภาษี — ทุกใบต้องเป็น tax_invoice ที่อนุมัติแล้วของบริษัทเดียวกันเท่านั้น (เหมือน store())
        if ($hasInvoiceRefs) {
            $refIds = collect($request->invoice_refs)->pluck('tax_invoice_id')->unique();
            $validTaxInvoices = SaleDocument::whereIn('id', $refIds)
                ->where('company_id', auth()->user()->company_id)
                ->where('document_type', 'tax_invoice')
                ->where('status', 'Approved')
                ->pluck('id');
            if ($validTaxInvoices->count() !== $refIds->count()) {
                return response()->json([
                    'message' => 'มีใบกำกับภาษีบางรายการที่เลือกไม่ถูกต้อง หรือยังไม่อนุมัติ',
                    'errors' => ['invoice_refs' => ['กรุณาเลือกเฉพาะใบกำกับภาษีที่อนุมัติแล้ว']],
                ], 422);
            }
        }

        // 🎗️ ใบยืมสินค้าต้องระบุผู้ยืมอย่างน้อยทางใดทางหนึ่งเสมอ (เช็คค่าที่จะมีผลจริงหลังอัปเดต ไม่ใช่แค่ค่าที่ส่งมาในรีเควสต์นี้)
        if ($document->document_type === 'loan_issue') {
            $effectiveContactId = $request->has('contact_id') ? $request->contact_id : $document->contact_id;
            $effectiveBorrowerName = $request->has('borrower_name') ? $request->borrower_name : $document->borrower_name;
            if (!$effectiveContactId && !$effectiveBorrowerName) {
                return response()->json([
                    'message' => $isBorrowIn ? 'กรุณาเลือกลูกค้าจากระบบ หรือระบุชื่อผู้ให้ยืม' : 'กรุณาเลือกลูกค้าจากระบบ หรือระบุชื่อผู้ยืมเอง',
                    'errors' => ['borrower_name' => ['กรุณาระบุคู่สัญญาให้ครบ']],
                ], 422);
            }
        }
        // 🎗️ โหมด "ยืมของจากลูกค้า" ไม่มี product_id ให้ยึด — ต้องมีชื่อรายการกำกับทุกแถวแทน
        if ($isBorrowIn && $request->has('items') && collect($request->items)->contains(fn ($item) => empty($item['item_name'] ?? null))) {
            return response()->json([
                'message' => 'กรุณาระบุชื่อสินค้าที่ยืมมาให้ครบทุกแถว',
                'errors' => ['items' => ['กรุณาระบุชื่อสินค้าที่ยืมมาให้ครบทุกแถว']],
            ], 422);
        }

        DB::beginTransaction();
        try {
            // เช็คสถานะ ถ้าอนุมัติแล้วอาจจะไม่ให้แก้ (ปรับเปลี่ยนได้ตาม Workflow จริง)
            if ($document->status !== 'Pending') {
                DB::rollBack();
                return response()->json(['message' => 'ไม่สามารถแก้ไขเอกสารที่ยืนยันหรือดำเนินการไปแล้วได้'], 400);
            }

            $document->update($request->only([
                'contact_id', 'project_id', 'rental_job_id', 'warehouse_id', 'reference_number',
                'transportation', 'saleman_code', 'payment_method',
                'issue_date', 'credit_days', 'currency', 'tax_type', 'note',
                'discount_amount', 'deposit_amount', 'vat_amount', 'wht_amount',
                'custom_logo_path', 'custom_company_name', 'custom_company_address', 'custom_quoter_name',
                'borrower_name', 'borrower_phone',
            ]));

            // 🎗️ ใบยืมสินค้า — "วันที่ต้องคืน" แก้ไขตรงๆ ได้ (เอกสารประเภทอื่นไม่แตะ due_date ตอนแก้ไข เหมือนพฤติกรรมเดิม)
            if ($document->document_type === 'loan_issue' && $request->has('due_date')) {
                $document->update(['due_date' => $request->due_date]);
            }

            // 🧾 ใบวางบิล/ใบเสร็จรับเงินแบบอ้างอิงใบกำกับภาษีหลายใบ — ลบ-สร้างใหม่ทุกครั้งเหมือน items (Cleanest way)
            if ($hasInvoiceRefs) {
                $document->invoiceRefs()->delete();
                $subtotal = 0;
                $refRows = collect($request->invoice_refs)->keyBy('tax_invoice_id');
                $refTaxInvoices = SaleDocument::whereIn('id', $refRows->keys())->get()->keyBy('id');
                foreach ($refRows as $taxInvoiceId => $refRow) {
                    $taxInvoice = $refTaxInvoices[$taxInvoiceId];
                    $paymentAmount = $document->document_type === 'receipt' ? (float) ($refRow['payment_amount'] ?? 0) : null;
                    $subtotal += $document->document_type === 'receipt' ? ($paymentAmount ?? 0) : (float) $taxInvoice->grand_total;

                    SaleDocumentInvoiceRef::create([
                        'sale_document_id' => $document->id,
                        'tax_invoice_id' => $taxInvoiceId,
                        'payment_amount' => $paymentAmount,
                    ]);
                }
                $document->update(['subtotal' => $subtotal, 'discount_amount' => 0, 'vat_amount' => 0, 'wht_amount' => 0]);
            }

            // อัปเดตรายการสินค้าแบบลบสร้างใหม่ (Cleanest way)
            // 🎗️ เอกสารที่ล็อกรายการตามใบเบิกสินค้า (material_issue) ห้ามแก้ items เด็ดขาด — เมิน items ที่ client ส่งมาแบบเงียบๆ
            // (ตั้งใจ ไม่ error เพื่อไม่ให้ frontend ที่ยังส่ง items เดิมมาแสดงผลด้วยต้อง error โดยไม่จำเป็น)
            if ($request->has('items') && !$materialIssueLock && !$hasInvoiceRefs) {
                $document->items()->delete();
                $subtotal = 0;

                // 🎪 ใบคืนสินค้าต้องรู้ว่า S/N ที่เลือกควรอยู่ในสถานะไหนอยู่ก่อน — ขึ้นกับว่าอ้างอิง "ใบเบิกสินค้า" (rented) หรือ "ใบลดหนี้" (sold)
                // (แก้ไขเอกสารไม่เปิดให้เปลี่ยน reference_document_id — ใช้ค่าเดิมที่บันทึกไว้ตอนสร้างเสมอ)
                $stockReturnExpectedStatus = 'rented';
                if (in_array($document->document_type, ['stock_return', 'rental_stock_return']) && $document->reference_document_id) {
                    $referencedDoc = SaleDocument::find($document->reference_document_id);
                    if ($referencedDoc && $referencedDoc->document_type === 'credit_note') {
                        $stockReturnExpectedStatus = 'sold';
                    }
                }

                // 2-pass เช่นเดียวกับ store() เพื่อรองรับแถวลูก/ส่วนประกอบสินค้าชุดที่ต้องอ้างอิง ID ของแถวแม่ที่เพิ่งสร้าง
                $createdItems = [];
                foreach ($request->items as $index => $item) {
                    $isBundleChild = isset($item['parent_index']);
                    $unitPrice = $isBundleChild ? 0 : $item['unit_price'];
                    $costPrice = $isBundleChild ? 0 : ($item['cost_price'] ?? null);
                    $itemDiscount = $isBundleChild ? 0 : ($item['discount_amount'] ?? 0);
                    $totalPrice = $item['quantity'] * $unitPrice;
                    $netItemPrice = $totalPrice - $itemDiscount;
                    $subtotal += $netItemPrice;

                    $newItem = $document->items()->create([
                        'product_id' => $item['product_id'] ?? null,
                        'item_name' => $item['item_name'] ?? null,
                        'quantity' => $item['quantity'],
                        'unit_name' => $item['unit_name'] ?? 'ชิ้น',
                        'unit_price' => $unitPrice,
                        'cost_price' => $costPrice,
                        'discount_percent' => $isBundleChild ? null : ($item['discount_percent'] ?? null),
                        'discount_amount' => $itemDiscount,
                        'tax_rate' => $isBundleChild ? 0 : ($item['tax_rate'] ?? 0),
                        'tax_amount' => $isBundleChild ? 0 : ($item['tax_amount'] ?? 0),
                        'wht_rate' => $isBundleChild ? null : ($item['wht_rate'] ?? null),
                        'wht_amount' => $isBundleChild ? 0 : ($item['wht_amount'] ?? 0),
                        'total_price' => $netItemPrice,
                    ]);
                    $createdItems[$index] = $newItem;

                    // 📝 ใบเสนอราคา/ใบวางบิล/ใบลดหนี้ ไม่ตัดสต๊อกหรือยึด S/N จริง — ไม่บังคับเลือก S/N ตอนแก้ไข
                    // 🎗️ แถว "ยืมของจากลูกค้า" ไม่มี product_id เลย — ข้าม attachItemSerials ไปเลย
                    if (!empty($item['product_id']) && !in_array($document->document_type, ['quotation', 'custom_quotation', 'billing_invoice', 'credit_note', 'invoice'])) {
                        $this->attachItemSerials($newItem, $item['serials'] ?? [], in_array($document->document_type, ['stock_return', 'rental_stock_return', 'loan_return']) ? $stockReturnExpectedStatus : 'available');
                    }
                }

                foreach ($request->items as $index => $item) {
                    if (isset($item['parent_index']) && isset($createdItems[$item['parent_index']])) {
                        $createdItems[$index]->update(['parent_item_id' => $createdItems[$item['parent_index']]->id]);
                    }
                }

                // 🎨 เอกสารกำหนดเอง (custom_quotation/custom_cash) ผู้ใช้พิมพ์ทับ Subtotal เองได้ (ดู store() สำหรับเหตุผลเต็ม)
                $isCustomOverridable = in_array($document->document_type, ['custom_quotation', 'custom_cash']);
                if ($isCustomOverridable && $request->filled('subtotal_override')) {
                    $subtotal = (float) $request->subtotal_override;
                }
                $document->update(['subtotal' => $subtotal]);
            }

            // 🔄 คำนวณ grand_total จริงเสมอ ไม่เชื่อค่าที่ client ส่งมาตรงๆ (ให้ตรงกับ store())
            $document->refresh();
            $grandTotal = max(0, $document->subtotal - $document->discount_amount + $document->vat_amount);
            $document->update(['grand_total' => $grandTotal]);

            DB::commit();
            return response()->json(['message' => 'อัปเดตเอกสารสำเร็จ', 'data' => $document]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        $document = SaleDocument::find($id);
        if (!$document) return response()->json(['message' => 'ไม่พบเอกสาร'], 404);

        // 🛡️ API Guard ตามประเภทเอกสารจริงของเอกสารนี้
        if (!$this->hasPermission('delete', $document->document_type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ลบเอกสารนี้'], 403);
        }

        try {
            if ($document->status !== 'Pending' && $document->status !== 'Cancelled') {
                return response()->json(['message' => 'ไม่สามารถลบเอกสารที่มีการเคลื่อนไหวแล้วได้'], 400);
            }

            DB::beginTransaction();
            $document->items()->delete(); // ลบ items ออกก่อน
            $document->delete(); // Soft delete
            DB::commit();

            return response()->json(['message' => 'ลบเอกสารเรียบร้อยแล้ว']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาดในการลบ: ' . $e->getMessage()], 500);
        }
    }

    // ==========================================
    // ✅ อนุมัติเอกสารและตัดสต๊อกอัตโนมัติ
    // ==========================================
    public function approve($id)
    {
        $doc = SaleDocument::with('items.serials', 'items.product')->find($id);
        if (!$doc) return response()->json(['message' => 'ไม่พบเอกสาร'], 404);

        if (!$this->hasPermission('approve', $doc->document_type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์อนุมัติเอกสารประเภทนี้'], 403);
        }

        DB::beginTransaction();
        try {
            if ($doc->status !== 'Pending') return response()->json(['message' => 'เอกสารนี้ถูกดำเนินการไปแล้ว'], 400);

            // อัปเดตสถานะ
            $doc->update([
                'status' => 'Approved',
                'approved_by' => auth()->id(),
                'approved_at' => now()
            ]);

            // 📦 ลอจิกสต๊อก:
            // - ขายเงินสด, ใบเสร็จ -> ตัดสต๊อกออกจริง (Out)
            // - ใบกำกับภาษี/ใบส่งสินค้า ที่ไม่ได้อ้างอิงใบเบิกสินค้า (material_issue) -> ตัดสต๊อกออกจริงทันที (เส้นทางเดิม สร้างจากใบเสนอราคาตรงๆ)
            // - ใบกำกับภาษี/ใบส่งสินค้า ที่อ้างอิงใบเบิกสินค้า (material_issue) ที่อนุมัติแล้ว -> "ปลดจอง + ตัดจริง" รวมกันในทีเดียว (แยก branch ด้านล่าง สำคัญ: ต้องเช็คก่อน $stockOutTypes)
            // - ใบเบิกสินค้า(โครงการ)/ใบเบิกสินค้า(งานเช่า)/ใบยืมสินค้า -> "จอง" เท่านั้น (reserved_qty เพิ่ม, qty ไม่ลด) ของยังอยู่ในคลังจริงแค่ถูกล็อกไว้ไม่ให้งานอื่นเบิกซ้ำ
            //   (material_issue เปลี่ยนพฤติกรรมจากตัดสต๊อกจริงทันที มาเป็นจองแบบนี้ — ของจริงจะถูกตัดตอนอนุมัติใบกำกับภาษี/ใบส่งสินค้าที่อ้างอิงแทน กันตัดสต๊อกซ้ำ 2 ครั้ง)
            // - ใบคืนสินค้า(งานเช่า) -> ปลดล็อก (reserved_qty ลด) ของไม่เคยออกจาก qty จริงจึงไม่ต้องเพิ่มคืน ต้องเช็คอ้างอิงกับใบเบิกต้นทาง (แยก branch ด้านล่าง)
            // - ใบลดหนี้ -> ไม่กระทบสต๊อกโดยตรงอีกต่อไป (เดิมเคยเพิ่มสต๊อกกลับอัตโนมัติแบบไม่ระบุ S/N) — ของจริงจะกลับเข้าคลัง
            //   ก็ต่อเมื่อมี "ใบคืนสินค้า" ที่อ้างอิงใบลดหนี้นี้มายืนยันอีกที (กันสต๊อกถูกเพิ่มซ้ำ 2 ครั้ง)
            // - ใบเสนอราคา, ใบวางบิล, ใบเพิ่มหนี้, ใบส่งสินค้าที่ไม่ได้อ้างอิงใบเบิกสินค้า -> ไม่กระทบสต๊อก
            $stockOutTypes = ['tax_invoice', 'cash', 'custom_cash', 'receipt'];
            $warehouseId = Warehouse::resolveFor($doc->company_id, $doc->warehouse_id);

            // 🎗️ "ยืมของจากลูกค้า" (borrow_in) — ของไม่ใช่ของเรา ไม่กระทบสต๊อก/S/N ของเราเลย แค่บันทึกสถานะเอกสารไว้เฉยๆ
            $isBorrowInLoan = $doc->document_type === 'loan_issue' && $doc->loan_direction === 'borrow_in';
            $isBorrowInReturn = $doc->document_type === 'loan_return' && ($doc->referencedDocument->loan_direction ?? null) === 'borrow_in';

            // 🎗️ ใบกำกับภาษี/ใบส่งสินค้า ที่อ้างอิงใบเบิกสินค้า (material_issue) — หา material_issue ต้นทางไว้ล่วงหน้า
            // (เช็คสถานะ/ใช้ตัดสต๊อกจริงในเวลาเดียวกับปลดจอง แทนที่การตัดสต๊อกจะเกิดตอนอนุมัติใบเบิกเหมือนเดิม)
            $materialIssueRef = null;
            if (in_array($doc->document_type, ['tax_invoice', 'delivery_note']) && $doc->reference_document_id) {
                $refDoc = SaleDocument::find($doc->reference_document_id);
                if ($refDoc && $refDoc->document_type === 'material_issue') $materialIssueRef = $refDoc;
            }

            if ($materialIssueRef) {
                // 🛡️ material_issue อาจถูกยกเลิกไปแล้วหลังจากสร้างเอกสารนี้ (เอกสารนี้ยังค้างเป็น Pending อยู่) — กันปลดจอง/ตัดสต๊อกโดยไม่มีจองจริงอยู่
                if ($materialIssueRef->status !== 'Approved') {
                    throw new \Exception("ใบเบิกสินค้าต้นทาง ({$materialIssueRef->document_number}) ไม่ได้อยู่ในสถานะอนุมัติแล้ว ไม่สามารถอนุมัติเอกสารนี้ต่อได้");
                }
                foreach ($doc->items as $item) {
                    if ($item->product->is_bundle) continue;

                    $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                    if ($balance->qty < $item->quantity) {
                        throw new \Exception("สินค้า {$item->product->name} มีสต็อกไม่พอ (คงเหลือ {$balance->qty}, ต้องการ {$item->quantity})");
                    }
                    $balance->reserved_qty = max(0, $balance->reserved_qty - $item->quantity); // ปลดจองที่ material_issue จองไว้
                    $balance->qty -= $item->quantity; // ตัดสต๊อกจริง ณ จุดนี้
                    $balance->save();

                    $movement = \App\Models\StockMovement::create([
                        'product_id' => $item->product_id,
                        'type' => 'out',
                        'quantity' => $item->quantity,
                        'reference_number' => $doc->document_number,
                        'note' => "ตัดสต๊อกจริงจากใบเบิก {$materialIssueRef->document_number} (อ้างอิงผ่าน {$doc->document_number})",
                        'user_id' => auth()->id(),
                        'warehouse_id' => $warehouseId,
                        'company_id' => $doc->company_id
                    ]);

                    if ($item->serials->isNotEmpty()) {
                        $serialIds = $item->serials->pluck('id');
                        $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

                        // ต้องยังอยู่ในสถานะ 'rented' และเช่าออกมาจากใบเบิกที่เอกสารนี้อ้างอิงถึงเท่านั้น
                        $invalid = $lockedSerials->first(fn ($s) => $s->status !== 'rented' || (int) $s->rented_via_sale_document_id !== (int) $materialIssueRef->id);
                        if ($invalid) {
                            throw new \Exception("S/N {$invalid->serial_number} ไม่ได้อยู่ในสถานะเช่าออกจากใบเบิกที่อ้างอิง");
                        }

                        ProductSerial::whereIn('id', $serialIds)->update([
                            'status' => 'sold',
                            'stock_movement_id' => $movement->id,
                            'sold_at' => now(),
                            'sold_to_sale_document_id' => $doc->id,
                            'rented_at' => null,
                            'rented_via_sale_document_id' => null,
                        ]);
                    }
                }
            } elseif (in_array($doc->document_type, $stockOutTypes)) {
                foreach ($doc->items as $item) {
                    // 📦 แถวแม่สินค้าชุด (Bundle) ไม่มีสต๊อกของตัวเอง — ข้ามไปเลย ส่วนประกอบจริงมาเป็นแถวลูก
                    // (parent_item_id ชี้มาที่แถวนี้) ซึ่งเป็นแถว product_id ปกติ ไหลผ่าน logic ด้านล่างตามปกติอยู่แล้ว
                    if ($item->product->is_bundle) continue;

                    // 🛡️ ล็อกแถวยอดคงเหลือก่อนเช็ค/ตัดสต๊อกจริง — จุดนี้เป็นจุดเดียวที่ authoritative
                    // (เดิม approve()/cancel() ไม่เคยแตะ StockBalance เลย สร้างแค่ StockMovement log)
                    $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                    if ($balance->qty < $item->quantity) {
                        throw new \Exception("สินค้า {$item->product->name} มีสต็อกไม่พอ (คงเหลือ {$balance->qty}, ต้องการ {$item->quantity})");
                    }
                    $balance->qty -= $item->quantity;
                    $balance->save();

                    $movement = \App\Models\StockMovement::create([
                        'product_id' => $item->product_id,
                        'type' => 'out',
                        'quantity' => $item->quantity,
                        'reference_number' => $doc->document_number,
                        'note' => 'ตัดสต๊อกจากการขาย (อนุมัติบิล ' . $doc->document_number . ')',
                        'user_id' => auth()->id(),
                        'warehouse_id' => $warehouseId,
                        'company_id' => $doc->company_id
                    ]);

                    // 🔒 ยึด S/N ที่เลือกไว้จริง — ล็อกแถวกันชนกับเอกสารอื่นที่อาจแย่ง S/N เดียวกัน
                    // แล้วเช็คซ้ำว่ายัง available อยู่จริง (จุดนี้เท่านั้นที่ authoritative)
                    if ($item->serials->isNotEmpty()) {
                        $serialIds = $item->serials->pluck('id');
                        $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

                        $notAvailable = $lockedSerials->where('status', '!=', 'available')->first();
                        if ($notAvailable) {
                            throw new \Exception("S/N {$notAvailable->serial_number} ไม่พร้อมขายแล้ว (ถูกขาย/ใช้ไปในเอกสารอื่น) กรุณาแก้ไขเอกสารและเลือก S/N ใหม่");
                        }

                        ProductSerial::whereIn('id', $serialIds)->update([
                            'status' => 'sold',
                            'stock_movement_id' => $movement->id,
                            'sold_at' => now(),
                            'sold_to_sale_document_id' => $doc->id,
                        ]);
                    }
                }
            } elseif (in_array($doc->document_type, ['stock_issue', 'loan_issue', 'material_issue']) && !$isBorrowInLoan) {
                // 🎪 เบิกสินค้า(โครงการ)/เบิกสินค้า(งานเช่า)/ยืมสินค้า = "จอง" เท่านั้น ไม่ตัด qty จริง — ของยังอยู่ในคลังแต่ล็อกไว้ไม่ให้งานอื่นเบิกซ้ำ
                // ไม่สร้าง StockMovement (ไม่ใช่การเคลื่อนไหวสต๊อกทางกายภาพจริง — เอกสารนี้เองเป็น audit trail อยู่แล้ว)
                foreach ($doc->items as $item) {
                    if ($item->product->is_bundle) continue;

                    $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                    $availableQty = $balance->qty - $balance->reserved_qty;
                    if ($availableQty < $item->quantity) {
                        throw new \Exception("สินค้า {$item->product->name} มีสต็อกพร้อมเบิกไม่พอ (พร้อมใช้จริง {$availableQty} ชิ้น, ต้องการ {$item->quantity} ชิ้น)");
                    }
                    $balance->reserved_qty += $item->quantity;
                    $balance->save();

                    if ($item->serials->isNotEmpty()) {
                        $serialIds = $item->serials->pluck('id');
                        $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

                        $notAvailable = $lockedSerials->where('status', '!=', 'available')->first();
                        if ($notAvailable) {
                            throw new \Exception("S/N {$notAvailable->serial_number} ไม่พร้อมเบิกแล้ว (ถูกใช้ไปในเอกสารอื่น) กรุณาแก้ไขเอกสารและเลือก S/N ใหม่");
                        }

                        ProductSerial::whereIn('id', $serialIds)->update([
                            'status' => 'rented',
                            'rented_at' => now(),
                            'rented_via_sale_document_id' => $doc->id,
                        ]);
                    }
                }
            } elseif (in_array($doc->document_type, ['stock_return', 'rental_stock_return', 'loan_return']) && !$isBorrowInReturn) {
                // 🎪 ใบคืนสินค้า/ใบคืนสินค้ายืม — ต้องอ้างอิงเอกสารต้นทางผ่าน reference_document_id เสมอ (บังคับตั้งแต่ตอนสร้างเอกสาร)
                // แยกพฤติกรรม 2 แบบตามประเภทเอกสารต้นทางที่อ้างอิง:
                // - อ้างอิงใบเบิกสินค้า/ใบยืมสินค้า (stock_issue/loan_issue) -> ปลดล็อก (reserved_qty ลด) เท่านั้น ของไม่เคยออกจาก qty จริงตอนเบิก/ยืม
                // - อ้างอิงใบลดหนี้ (credit_note) -> รับคืนสินค้าจริงเข้าคลัง (qty เพิ่มจริง) เพราะเป็นของที่ลูกค้าคืนมาจริงๆ
                $referencedType = $doc->referencedDocument->document_type ?? null;

                if ($referencedType === 'credit_note') {
                    foreach ($doc->items as $item) {
                        if ($item->product->is_bundle) continue;

                        $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                        $balance->qty += $item->quantity;
                        $balance->save();

                        $movement = \App\Models\StockMovement::create([
                            'product_id' => $item->product_id,
                            'type' => 'in',
                            'quantity' => $item->quantity,
                            'reference_number' => $doc->document_number,
                            'note' => 'รับคืนสินค้าเข้าสต๊อก (อนุมัติใบคืนสินค้า ' . $doc->document_number . ')',
                            'user_id' => auth()->id(),
                            'warehouse_id' => $warehouseId,
                            'company_id' => $doc->company_id
                        ]);

                        if ($item->serials->isNotEmpty()) {
                            $serialIds = $item->serials->pluck('id');
                            $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

                            // ต้องยังอยู่ในสถานะ 'sold' และขายออกมาจากใบกำกับภาษีต้นทางของใบลดหนี้ที่อ้างอิงเท่านั้น (กันคืนผิดใบ/คืนซ้ำ)
                            $expectedTaxInvoiceId = $doc->referencedDocument->reference_document_id;
                            $invalid = $lockedSerials->first(fn ($s) => $s->status !== 'sold' || (int) $s->sold_to_sale_document_id !== (int) $expectedTaxInvoiceId);
                            if ($invalid) {
                                throw new \Exception("S/N {$invalid->serial_number} ไม่ได้อยู่ในสถานะขายออกจากใบกำกับภาษีต้นทาง (อาจถูกคืนไปแล้วหรือเลือกผิดรายการ)");
                            }

                            ProductSerial::whereIn('id', $serialIds)->update([
                                'status' => 'available',
                                'stock_movement_id' => $movement->id,
                                'sold_at' => null,
                                'sold_to_sale_document_id' => null,
                            ]);
                        }
                    }
                } else {
                    // 🔓 ปลดล็อก (reserved_qty ลด) เท่านั้น — ของไม่เคยออกจาก qty จริงตอนเบิก (ดู branch 'stock_issue' ด้านบน) จึงไม่ต้องเพิ่มคืน
                    // ไม่สร้าง StockMovement เช่นเดียวกับตอนเบิก (ไม่ใช่การเคลื่อนไหวสต๊อกทางกายภาพจริง)
                    foreach ($doc->items as $item) {
                        if ($item->product->is_bundle) continue;

                        $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                        $balance->reserved_qty = max(0, $balance->reserved_qty - $item->quantity);
                        $balance->save();

                        if ($item->serials->isNotEmpty()) {
                            $serialIds = $item->serials->pluck('id');
                            $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

                            // ต้องยังอยู่ในสถานะ 'rented' และเช่าออกมาจากใบเบิกที่เอกสารคืนนี้อ้างอิงถึงเท่านั้น (กันคืนผิดใบ/คืนซ้ำ)
                            $invalid = $lockedSerials->first(fn ($s) => $s->status !== 'rented' || (int) $s->rented_via_sale_document_id !== (int) $doc->reference_document_id);
                            if ($invalid) {
                                throw new \Exception("S/N {$invalid->serial_number} ไม่ได้อยู่ในสถานะเช่าออกจากใบเบิกที่อ้างอิง (อาจถูกคืนไปแล้วหรือเลือกผิดใบเบิก)");
                            }

                            ProductSerial::whereIn('id', $serialIds)->update([
                                'status' => 'available',
                                'rented_at' => null,
                                'rented_via_sale_document_id' => null,
                            ]);
                        }
                    }
                }
            }

            DB::commit();
            return response()->json(['message' => 'อนุมัติเอกสารและจัดการสต๊อกสำเร็จ', 'status' => 'Approved']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    // ==========================================
    // ❌ ยกเลิกเอกสาร (Void) และคืนสต๊อกอัตโนมัติ
    // ==========================================
    public function cancel(Request $request, $id)
    {
        $doc = SaleDocument::with('items.serials', 'items.product')->find($id);
        if (!$doc) return response()->json(['message' => 'ไม่พบเอกสาร'], 404);

        // 🚀 ยกเลิกใช้สิทธิ์เดียวกับแก้ไข (edit_{type}) เหมือนพฤติกรรมเดิม
        if (!$this->hasPermission('edit', $doc->document_type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ยกเลิกเอกสารนี้'], 403);
        }

        DB::beginTransaction();
        try {
            if ($doc->status === 'Cancelled') return response()->json(['message' => 'เอกสารนี้ถูกยกเลิกไปแล้ว'], 400);

            $oldStatus = $doc->status;
            $doc->update([
                'status' => 'Cancelled',
                'note' => $doc->note . "\n[ยกเลิกเอกสาร]: " . ($request->reason ?? 'ผู้ใช้กดยกเลิกในระบบ')
            ]);

            // 📦 ลอจิกคืนสต๊อก (ทำเฉพาะถ้าบิลเคยถูก Approve และตัดสต๊อกไปแล้ว)
            if ($oldStatus === 'Approved') {
                $stockOutTypes = ['tax_invoice', 'cash', 'custom_cash', 'receipt'];
                $warehouseId = Warehouse::resolveFor($doc->company_id, $doc->warehouse_id);

                // 🎗️ "ยืมของจากลูกค้า" (borrow_in) — ไม่เคยกระทบสต๊อกตอนอนุมัติ จึงไม่มีอะไรต้องย้อนกลับตอนยกเลิกเช่นกัน
                $isBorrowInLoan = $doc->document_type === 'loan_issue' && $doc->loan_direction === 'borrow_in';
                $isBorrowInReturn = $doc->document_type === 'loan_return' && ($doc->referencedDocument->loan_direction ?? null) === 'borrow_in';

                // 🎗️ สมมาตรกับ approve() — ถ้าเอกสารนี้เคยอนุมัติแบบ "ปลดจอง + ตัดจริง" จากใบเบิกสินค้า (material_issue) ต้องย้อนกลับแบบเดียวกัน
                $materialIssueRef = null;
                if (in_array($doc->document_type, ['tax_invoice', 'delivery_note']) && $doc->reference_document_id) {
                    $refDoc = SaleDocument::find($doc->reference_document_id);
                    if ($refDoc && $refDoc->document_type === 'material_issue') $materialIssueRef = $refDoc;
                }

                if ($materialIssueRef) {
                    foreach ($doc->items as $item) {
                        if ($item->product->is_bundle) continue;

                        $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                        $balance->qty += $item->quantity; // คืนสต๊อกจริงที่เคยตัดไป
                        $balance->reserved_qty += $item->quantity; // จองกลับคืนเหมือนตอน material_issue อนุมัติ (ยังไม่ได้ถูกคืนของจริงจนกว่าจะคืน/ยกเลิก material_issue ต้นทางด้วย)
                        $balance->save();

                        \App\Models\StockMovement::create([
                            'product_id' => $item->product_id,
                            'type' => 'in',
                            'quantity' => $item->quantity,
                            'reference_number' => $doc->document_number,
                            'note' => "คืนสต๊อก (ยกเลิกเอกสาร {$doc->document_number} ที่อ้างอิงใบเบิก {$materialIssueRef->document_number})",
                            'user_id' => auth()->id(),
                            'warehouse_id' => $warehouseId,
                            'company_id' => $doc->company_id
                        ]);

                        if ($item->serials->isNotEmpty()) {
                            ProductSerial::whereIn('id', $item->serials->pluck('id'))->update([
                                'status' => 'rented',
                                'sold_at' => null,
                                'sold_to_sale_document_id' => null,
                                'rented_at' => now(),
                                'rented_via_sale_document_id' => $materialIssueRef->id,
                            ]);
                        }
                    }
                } elseif (in_array($doc->document_type, $stockOutTypes)) {
                    foreach ($doc->items as $item) {
                        // 📦 แถวแม่สินค้าชุด (Bundle) ไม่เคยถูกตัดสต๊อกตอนอนุมัติ (ดู approve()) จึงไม่ต้องคืนสต๊อกตอนยกเลิกเช่นกัน
                        if ($item->product->is_bundle) continue;

                        $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                        $balance->qty += $item->quantity;
                        $balance->save();

                        \App\Models\StockMovement::create([
                            'product_id' => $item->product_id,
                            'type' => 'in', // คืนกลับเป็น In
                            'quantity' => $item->quantity,
                            'reference_number' => $doc->document_number,
                            'note' => 'คืนสต๊อก (ยกเลิกบิลขาย ' . $doc->document_number . ')',
                            'user_id' => auth()->id(),
                            'warehouse_id' => $warehouseId,
                            'company_id' => $doc->company_id
                        ]);

                        // 🔄 คืนสถานะ S/N ที่เคยขายไปกลับเป็น available — เก็บแถว pivot ไว้เป็นประวัติ ไม่ลบ
                        if ($item->serials->isNotEmpty()) {
                            ProductSerial::whereIn('id', $item->serials->pluck('id'))->update([
                                'status' => 'available', 'sold_at' => null, 'sold_to_sale_document_id' => null,
                            ]);
                        }
                    }
                } elseif (in_array($doc->document_type, ['stock_issue', 'loan_issue', 'material_issue']) && !$isBorrowInLoan) {
                    // 🎪 ยกเลิกใบเบิกสินค้า(โครงการ)/ใบเบิกสินค้า(งานเช่า)/ใบยืมสินค้า ที่เคยอนุมัติแล้ว — ปลดล็อก (reserved_qty ลด) ไม่แตะ qty จริงเพราะไม่เคยตัดออก
                    foreach ($doc->items as $item) {
                        if ($item->product->is_bundle) continue;

                        $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                        $balance->reserved_qty = max(0, $balance->reserved_qty - $item->quantity);
                        $balance->save();

                        if ($item->serials->isNotEmpty()) {
                            ProductSerial::whereIn('id', $item->serials->pluck('id'))->update([
                                'status' => 'available', 'rented_at' => null, 'rented_via_sale_document_id' => null,
                            ]);
                        }
                    }
                } elseif (in_array($doc->document_type, ['stock_return', 'rental_stock_return', 'loan_return']) && !$isBorrowInReturn) {
                    // 🎪 ยกเลิกใบคืนสินค้า/ใบคืนสินค้ายืม — ย้อนกลับตามประเภทเอกสารต้นทางที่อ้างอิง (สมมาตรกับ approve() ด้านบน)
                    $referencedType = $doc->referencedDocument->document_type ?? null;

                    if ($referencedType === 'credit_note') {
                        // ย้อนกลับการรับคืนสินค้าจริง — ดึง qty ออกอีกครั้ง (เหมือนไม่เคยคืนของ)
                        foreach ($doc->items as $item) {
                            if ($item->product->is_bundle) continue;

                            $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                            $balance->qty = max(0, $balance->qty - $item->quantity);
                            $balance->save();

                            \App\Models\StockMovement::create([
                                'product_id' => $item->product_id,
                                'type' => 'out',
                                'quantity' => $item->quantity,
                                'reference_number' => $doc->document_number,
                                'note' => 'ดึงสต๊อกออก (ยกเลิกใบคืนสินค้า ' . $doc->document_number . ')',
                                'user_id' => auth()->id(),
                                'warehouse_id' => $warehouseId,
                                'company_id' => $doc->company_id
                            ]);

                            if ($item->serials->isNotEmpty()) {
                                $expectedTaxInvoiceId = $doc->referencedDocument->reference_document_id;
                                ProductSerial::whereIn('id', $item->serials->pluck('id'))->update([
                                    'status' => 'sold',
                                    'sold_at' => now(),
                                    'sold_to_sale_document_id' => $expectedTaxInvoiceId,
                                ]);
                            }
                        }
                    } else {
                        // ย้อนกลับเป็น "จอง" อีกครั้ง (reserved_qty เพิ่มกลับ) ไม่แตะ qty จริง
                        // เพราะตอนอนุมัติใบคืนสินค้าก็แค่ปลดล็อก ไม่เคยเพิ่ม qty จริงเข้าไป (ดู approve())
                        foreach ($doc->items as $item) {
                            if ($item->product->is_bundle) continue;

                            $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                            $balance->reserved_qty += $item->quantity;
                            $balance->save();

                            if ($item->serials->isNotEmpty()) {
                                ProductSerial::whereIn('id', $item->serials->pluck('id'))->update([
                                    'status' => 'rented',
                                    'rented_at' => now(),
                                    'rented_via_sale_document_id' => $doc->reference_document_id,
                                ]);
                            }
                        }
                    }
                }
            }

            DB::commit();
            return response()->json(['message' => 'ยกเลิกเอกสารและปรับปรุงสต๊อกสำเร็จ', 'status' => 'Cancelled']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    // ==========================================
    // 📝 สร้างเวอร์ชันใหม่ (Revise Document)
    // ==========================================
    public function revise(Request $request, $id)
    {
        $original = SaleDocument::with('items')->find($id);
        if (!$original) return response()->json(['message' => 'ไม่พบเอกสารต้นฉบับ'], 404);

        // 🛡️ API Guard: revise คือการสร้างเอกสารใหม่ (เวอร์ชันถัดไป) ของประเภทเดิม
        if (!$this->hasPermission('create', $original->document_type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์สร้างเอกสารประเภทนี้'], 403);
        }

        DB::beginTransaction();
        try {
            // 1. เปลี่ยนสถานะใบเดิมให้เป็น "Revised" (เพื่อล็อกไม่ให้อนุมัติซ้ำ)
            $original->update([
                'status' => 'Revised',
                'note' => $original->note . "\n[ระบบ]: ถูกสร้างเวอร์ชันใหม่แล้ว"
            ]);

            // 2. จัดการเลขรันเวอร์ชัน (แยก Base Number ออกจาก -V)
            $newVersion = $original->version + 1;
            $baseNumber = explode('-V', $original->document_number)[0];
            $newDocNumber = $baseNumber . '-V' . $newVersion;

            // 3. สร้างใบใหม่ (Clone ข้อมูลเดิมทั้งหมด)
            $newDoc = $original->replicate();
            $newDoc->document_number = $newDocNumber;
            $newDoc->version = $newVersion;

            // ถ้าใบเดิมเป็น V1 ให้โยงไปหาต้นตระกูล (parent_id) เพื่อให้อยู่ใน Family เดียวกัน
            $newDoc->parent_id = $original->parent_id ?? $original->id;

            $newDoc->status = 'Pending'; // รีเซ็ตสถานะเป็นรออนุมัติ
            $newDoc->created_by = auth()->id();
            $newDoc->approved_by = null;
            $newDoc->approved_at = null;
            $newDoc->created_at = now();
            $newDoc->updated_at = now();
            $newDoc->save();

            // 4. Clone รายการสินค้า (Items) ทั้งหมดมาใส่ใบใหม่
            // 🚫 ตั้งใจไม่คัดลอก sale_document_item_serials (S/N ที่เคยเลือกไว้) มาด้วย —
            // เอกสารที่ revise ได้ต้องเป็น Pending/Revised เท่านั้น ซึ่งไม่เคยตัดสต๊อกจริง (ยังไม่เคย approve())
            // ให้ผู้ใช้เลือก S/N ใหม่เองในเอกสารเวอร์ชันใหม่ ป้องกัน pivot ชี้ไปยัง product_serial_id เดียวกัน
            // จากเอกสารสองเวอร์ชันพร้อมกัน
            // 🛡️ 2 รอบเหมือน store()/update() — replicate() ตรงๆ (แบบเดิม) จะคัดลอก parent_item_id เดิมมาด้วย
            // ซึ่งชี้ไปหา ID ของแถวแม่ใน "ใบเก่า" (คนละ sale_document_id) ทำให้แถวลูกในใบใหม่กลายเป็นแถวลอย
            // หาแม่ในเอกสารเดียวกันไม่เจอ (frontend คำนวณสัดส่วน/อัปเดตจำนวนตามแม่ไม่ได้อีกต่อไป) — รอบแรก clone
            // ทุกแถวก่อน (ล้าง parent_item_id ทิ้งชั่วคราว) พร้อมจด map "ID เก่า -> ID ใหม่" รอบสองค่อยผูก
            // parent_item_id ของแถวลูกด้วย ID ใหม่จาก map
            $oldToNewItemId = [];
            foreach ($original->items as $item) {
                $newItem = $item->replicate();
                $newItem->sale_document_id = $newDoc->id;
                $newItem->parent_item_id = null;
                $newItem->created_at = now();
                $newItem->updated_at = now();
                $newItem->save();
                $oldToNewItemId[$item->id] = $newItem->id;
            }
            foreach ($original->items as $item) {
                if ($item->parent_item_id && isset($oldToNewItemId[$item->parent_item_id])) {
                    SaleDocumentItem::where('id', $oldToNewItemId[$item->id])
                        ->update(['parent_item_id' => $oldToNewItemId[$item->parent_item_id]]);
                }
            }

            DB::commit();
            return response()->json([
                'message' => 'สร้างเอกสารเวอร์ชันใหม่ (' . $newDocNumber . ') สำเร็จ',
                'data' => $newDoc->load('items')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }
}
