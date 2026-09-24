<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SaleDocument;
use App\Models\SaleDocumentItem;
use App\Models\SaleDocumentInvoiceRef;
use App\Models\SaleDocumentMaterialIssueRef;
use App\Models\Product;
use App\Models\ProductSerial;
use App\Models\StockBalance;
use App\Models\Warehouse;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class SaleDocumentController extends Controller
{
    private const DOC_TYPES = ['quotation', 'custom_quotation', 'billing_invoice', 'tax_invoice', 'cash', 'custom_cash', 'receipt', 'credit_note', 'debit_note', 'delivery_note', 'stock_issue', 'stock_return', 'rental_stock_return', 'material_issue', 'loan_issue', 'loan_return', 'invoice', 'packing_list', 'installation_issue'];

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
            throw new \DomainException(
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
            throw new \DomainException($errorMsg);
        }

        foreach ($serialNumbers as $sn) {
            $item->serials()->attach($matchedSerials[$sn]->id);
        }
    }

    // 🆕 หาใบเบิกสินค้าต้นทางทั้งหมดที่ผูกกับเอกสารนี้ (tax_invoice/delivery_note) — เช็คตาราง pivot
    // sale_document_material_issue_refs ก่อน (รองรับได้หลายใบ) ถ้าไม่มีแถวเลย (เอกสารเก่าก่อนมีฟีเจอร์นี้ หรือ cash
    // ที่ยังใช้ทางเดียว) fallback ไปอ่าน reference_document_id ตัวเดียวแบบเดิม — ใช้ร่วมกันใน approve()/cancel()
    private function resolveMaterialIssueRefs(SaleDocument $doc): \Illuminate\Support\Collection
    {
        if (in_array($doc->document_type, ['tax_invoice', 'delivery_note'])) {
            $refs = $doc->materialIssueRefs()->with('materialIssue')->get()->pluck('materialIssue')->filter()->values();
            if ($refs->isNotEmpty()) {
                return $refs;
            }
        }
        if (in_array($doc->document_type, ['tax_invoice', 'delivery_note', 'cash']) && $doc->reference_document_id) {
            $refDoc = SaleDocument::find($doc->reference_document_id);
            if ($refDoc && $refDoc->document_type === 'material_issue') {
                return collect([$refDoc]);
            }
        }
        return collect();
    }

    // 🆕 ตัดล็อตต้นทุน FIFO ให้ 1 แถวสินค้าที่ตัดสต๊อกจริง แล้วเขียนต้นทุนจริงทับ cost_price ที่ผู้ใช้กรอกมา
    // (นโยบายที่ยืนยันไว้: ณ จุดอนุมัติ ต้นทุน FIFO จริงชนะค่าที่กรอกมือเสมอ — cost_price ก่อนหน้านี้เป็นแค่
    // ค่าประมาณจากถัวเฉลี่ยที่ผู้ใช้แก้ไขเองได้ ไม่ผูกกับล็อตที่ตัดจริงเลย)
    private function applyFifoCost(SaleDocumentItem $item, SaleDocument $doc, int $warehouseId, ?\App\Models\StockMovement $movement): float
    {
        $context = [
            'reference_type' => 'sale_document_item',
            'reference_id' => $item->id,
            'sale_document_id' => $doc->id,
            'stock_movement_id' => $movement?->id,
        ];

        $result = ($item->product->has_serial_number && $item->serials->isNotEmpty())
            ? \App\Services\StockLotFifoService::consumeSerials($item->serials, $warehouseId, $doc->company_id, $context)
            : \App\Services\StockLotFifoService::consume($item->product_id, $warehouseId, $doc->company_id, (float) $item->quantity, $context);

        $item->update(['cost_price' => $result['unit_cost']]);

        return $result['total_cost'];
    }

    public function index(Request $request)
    {
        // 🛡️ เพิ่ม project เข้า eager-load — เดิมไม่มี ทำให้หน้ารายการที่โชว์คอลัมน์ "โครงการ" (เช่น
        // material_issue, packing_list) แสดงได้แค่ "#{project_id}" แทนชื่อโครงการจริง เพราะ doc.project
        // เป็น undefined เสมอ (frontend fallback ไปโชว์ id ดิบแทน)
        // 🆕 [2026-09-15] เพิ่ม materialIssueRefs เข้า eager-load ด้วย — หน้าสร้างใบจัดสินค้าใช้เช็คว่าใบเบิกไหน
        // "มีใบจัดสินค้าอยู่แล้ว" บ้าง (ต้องดูทั้ง reference_document_id ตัวแทนเดิม และ pivot ตัวเต็มที่รองรับ
        // เลือกได้หลายใบ ดู SaleDocumentController::store()) ต้นทุนถูกมากเพราะเอกสารส่วนใหญ่ไม่มีแถวในตารางนี้เลย
        $query = SaleDocument::with(['contact', 'creator', 'project', 'materialIssueRefs'])->where('company_id', auth()->user()->company_id);

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
        // 🎯 กรองตามเอกสารต้นทางที่อ้างอิง ถ้ามีการส่งมา (ใช้เช็คว่าใบเบิกสินค้าหนึ่งๆ มีใบจัดสินค้าอยู่แล้วหรือยัง)
        if ($request->filled('reference_document_id')) {
            $query->where('reference_document_id', $request->reference_document_id);
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

        $documents = $query->latest()->get();

        // 🆕 [2026-09-20] ใบเบิกสินค้า — บอกว่าใบเสนอราคาต้นทางยัง "เบิกไม่ครบ" ไหม (ใช้แสดงปุ่ม "เบิกเพิ่ม" เฉพาะที่ยังเหลือ)
        // สูตรเดียวกับ issuableItems(): แถวใบเสนอราคา quantity - ผลรวมที่เบิกไปแล้ว (ไม่นับใบเบิกที่ยกเลิก) > 0 อย่างน้อย 1 แถว
        if ($request->type === 'material_issue') {
            $quotationIds = $documents->pluck('reference_document_id')->filter()->unique();
            $quotationItems = $quotationIds->isEmpty() ? collect() : SaleDocumentItem::whereIn('sale_document_id', $quotationIds)
                ->get(['id', 'sale_document_id', 'quantity']);
            $issuedByItem = $quotationItems->isEmpty() ? collect() : SaleDocumentItem::whereIn('source_item_id', $quotationItems->pluck('id'))
                ->whereHas('saleDocument', fn ($q) => $q->where('status', '!=', 'Cancelled'))
                ->selectRaw('source_item_id, SUM(quantity) as qty')
                ->groupBy('source_item_id')
                ->pluck('qty', 'source_item_id');
            $remainingByQuotation = $quotationItems->groupBy('sale_document_id')->map(
                fn ($rows) => $rows->contains(fn ($i) => (float) $i->quantity - (float) ($issuedByItem[$i->id] ?? 0) > 0)
            );
            $documents->each(fn ($d) => $d->setAttribute(
                'has_remaining_issuable',
                (bool) ($d->reference_document_id && ($remainingByQuotation[$d->reference_document_id] ?? false))
            ));
        }

        // 🆕 [2026-09-20] ใบยืมสินค้า — บอกว่ายังคืนไม่ครบไหม (ใช้แสดงปุ่ม "คืนสินค้า" เฉพาะใบที่อนุมัติแล้วและมีของค้างคืน)
        if ($request->type === 'loan_issue') {
            $outstanding = $this->loanOutstandingByLoan($documents->where('status', 'Approved')->pluck('id'));
            $documents->each(fn ($d) => $d->setAttribute('has_outstanding_return', isset($outstanding[$d->id])));
        }

        // 🆕 ใบเบิกสินค้าเช่า — บอกว่ายังคืนไม่ครบไหม (ใช้แสดงปุ่ม "คืนสินค้าเช่า" เฉพาะใบที่อนุมัติแล้วและมีของค้างคืน)
        if ($request->type === 'stock_issue') {
            $outstanding = $this->loanOutstandingByLoan($documents->where('status', 'Approved')->pluck('id'), ['rental_stock_return']);
            $documents->each(fn ($d) => $d->setAttribute('has_outstanding_return', isset($outstanding[$d->id])));
        }

        return response()->json($documents);
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

        // 🎗️ บิลเงินสด ที่อ้างอิงใบเบิกสินค้า (material_issue) — รายการสินค้าต้อง "ล็อก" ให้ตรงกับใบเบิกทุกประการ
        // items ที่ client ส่งมาจะถูกเมินทั้งหมด (ใช้แค่แสดงผลฝั่ง frontend) แล้วคัดลอกจาก material_issue ตรงๆ แทน กันแก้ไขตัวเลขที่ต้องห้าม
        // 🆕 tax_invoice/packing_list/delivery_note ย้ายไปใช้ $materialIssueLocks (พหูพจน์) ด้านล่างแทนแล้ว — รองรับ
        // เลือกใบเบิกได้หลายใบ (packing_list ย้ายมา [2026-09-15], delivery_note ย้ายมา [2026-09-23] เพื่อรองรับกรณี
        // ใบเบิกค้างเบิกมากกว่า 1 ใบในโครงการเดียวกัน เหมือนหน้าใบกำกับภาษี)
        $materialIssueLock = null;
        if ($request->document_type === 'cash' && $request->reference_document_id) {
            $refDoc = SaleDocument::with('items.serials')->find($request->reference_document_id);
            if ($refDoc && $refDoc->document_type === 'material_issue') {
                $materialIssueLock = $refDoc;
            }
        }

        // 🛡️ บิลเงินสด ต้องอ้างอิงใบเบิกสินค้าที่อนุมัติแล้วเสมอเท่านั้น — ห้ามสร้างจากใบเสนอราคาตรงๆ อีกต่อไป
        // (เดิมเป็นทางเลือกที่ 2 ทำให้ยังมีช่องโหวข้ามการล็อกจำนวน/ราคา/S-N ทั้งชุดที่ผูกกับใบเบิกสินค้าได้อยู่ดี)
        // 🐛 [2026-09-24] ยกเว้นใบกำกับภาษี/บิลเงินสดที่มีแต่ "รายการบริการ" (product_type = service เช่น ค่าซ่อม ค่าแรง) — ไม่มีสต๊อกให้ตัด/จอง
        // จึงไม่ต้องอ้างใบเบิกสินค้า (เดิมบังคับทุกกรณี ทำให้ออกบิลค่าซ่อมจากงานซ่อมไม่ได้เลย ดู RepairTicketController::generateBilling)
        // เงื่อนไขเข้มงวด: ต้องไม่ส่งใบเบิก/เอกสารต้นทางมาเลย และทุกรายการต้องเป็นสินค้าบริการที่ไม่ใช่สินค้าชุด
        $serviceOnlyItems = false;
        if (in_array($request->document_type, ['tax_invoice', 'cash']) && empty($request->material_issue_ids) && !$request->reference_document_id
            && is_array($request->items) && count($request->items) > 0
            && collect($request->items)->every(fn ($i) => !empty($i['product_id']))) {
            $itemProductIds = collect($request->items)->pluck('product_id')->unique()->values();
            $serviceOnlyItems = \App\Models\Product::whereIn('id', $itemProductIds)
                ->where('company_id', auth()->user()->company_id)
                ->where('product_type', 'service')
                ->where(fn ($q) => $q->whereNull('is_bundle')->orWhere('is_bundle', false))
                ->count() === $itemProductIds->count();
        }

        if ($request->document_type === 'cash' && !$materialIssueLock && !$serviceOnlyItems) {
            return response()->json(['message' => 'ต้องเลือกใบเบิกสินค้าที่อนุมัติแล้วเป็นเอกสารต้นทางเท่านั้น'], 422);
        }

        // 🆕 ใบกำกับภาษี/ใบจัดสินค้า/ใบส่งสินค้า — รองรับเลือกใบเบิกสินค้าที่อนุมัติแล้วได้หลายใบพร้อมกัน (กรณีเบิกไม่พร้อมกัน
        // เป็นหลายรอบ คนละใบเบิก หรือมีใบเบิกค้างเบิกมากกว่า 1 ใบในโครงการเดียวกัน) ทุกใบที่เลือกต้องมาจากคลังสินค้าเดียวกันเสมอ
        // (กันตัดสต๊อกผิดคลังตอนอนุมัติ/เลือก S/N ผิดคลัง) — ใบกำกับภาษีเพิ่มเงื่อนไขต้องมาจากใบเสนอราคาเดียวกันด้วย
        // (ล็อกราคาให้ตรงกัน) ส่วนใบจัดสินค้า/ใบส่งสินค้าไม่บังคับเงื่อนไขนี้ เพราะไม่มีเรื่องราคาเกี่ยวข้องเลย/ไม่จำเป็นต้อง
        // มาจากใบเสนอราคาเดียวกัน รายการสินค้าจะถูกรวมสินค้าชนิดเดียวกันเข้าแถวเดียวก่อนบันทึกเสมอ (ใบกำกับภาษีจับคู่ผ่าน
        // source_item_id, ใบจัดสินค้า/ใบส่งสินค้าจับคู่ผ่าน source_item_id ก่อนแล้ว fallback product_id+ราคา — ดู logic ท้าย method)
        $materialIssueLocks = collect();
        if (in_array($request->document_type, ['tax_invoice', 'packing_list', 'delivery_note']) && !($request->document_type === 'tax_invoice' && $serviceOnlyItems)) {
            $ids = collect($request->material_issue_ids ?? [])->filter()->unique()->values();
            if ($ids->isEmpty()) {
                return response()->json(['message' => 'ต้องเลือกใบเบิกสินค้าที่อนุมัติแล้วเป็นเอกสารต้นทางอย่างน้อย 1 ใบ'], 422);
            }
            $materialIssueLocks = SaleDocument::with('items.serials', 'items.product')
                ->whereIn('id', $ids)
                ->where('company_id', auth()->user()->company_id)
                ->where('document_type', 'material_issue')
                ->get();
            if ($materialIssueLocks->count() !== $ids->count()) {
                return response()->json(['message' => 'มีใบเบิกสินค้าบางรายการที่เลือกไม่ถูกต้อง'], 422);
            }
            $notApprovedIssue = $materialIssueLocks->first(fn ($d) => $d->status !== 'Approved');
            if ($notApprovedIssue) {
                return response()->json(['message' => "ใบเบิกสินค้า {$notApprovedIssue->document_number} ยังไม่อนุมัติ ต้องอนุมัติก่อนจึงจะเลือกมาอ้างอิงได้"], 422);
            }
            if ($materialIssueLocks->pluck('warehouse_id')->unique()->count() > 1) {
                return response()->json(['message' => 'ใบเบิกสินค้าที่เลือกต้องมาจากคลังสินค้าเดียวกันเท่านั้น'], 422);
            }
            if ($request->document_type === 'tax_invoice' && $materialIssueLocks->pluck('reference_document_id')->unique()->count() > 1) {
                return response()->json(['message' => 'ใบเบิกสินค้าที่เลือกต้องมาจากใบเสนอราคาเดียวกันเท่านั้น'], 422);
            }
            if ($request->document_type === 'packing_list') {
                $lockedIds = $materialIssueLocks->pluck('id');
                $alreadyPacked = SaleDocument::where('document_type', 'packing_list')
                    ->where('status', '!=', 'Cancelled')
                    ->where(function ($q) use ($lockedIds) {
                        $q->whereIn('reference_document_id', $lockedIds)
                          ->orWhereHas('materialIssueRefs', fn ($q2) => $q2->whereIn('material_issue_id', $lockedIds));
                    })
                    ->first();
                if ($alreadyPacked) {
                    return response()->json(['message' => 'มีใบเบิกสินค้าบางรายการที่เลือกมีใบจัดสินค้าอยู่แล้ว'], 422);
                }
            }
        }

        // 🐛 [2026-09-24] ใบกำกับภาษี/บิลเงินสด ต้องไม่ซ้ำกับเอกสารขายใบอื่นที่ยังไม่ยกเลิกบนใบเบิกเดียวกัน (กันตัดสต๊อกซ้ำ)
        if ($request->document_type === 'tax_invoice' && $materialIssueLocks->isNotEmpty()) {
            if ($err = $this->materialIssueAlreadyInvoicedError($materialIssueLocks->pluck('id'))) {
                return response()->json(['message' => $err], 422);
            }
        } elseif ($request->document_type === 'cash' && $materialIssueLock) {
            if ($err = $this->materialIssueAlreadyInvoicedError([$materialIssueLock->id])) {
                return response()->json(['message' => $err], 422);
            }
        }

        // 🎗️ ใบเบิกสินค้า (material_issue) ที่อ้างอิงใบเสนอราคา (quotation) ที่อนุมัติแล้ว — ล็อกเฉพาะ "ราคา/อัตราส่วนลด-ภาษี"
        // ต่อแถวตามใบเสนอราคาต้นทาง (จับคู่ผ่าน source_item_id) ส่วน "จำนวน" ยังปรับลดได้เอง เพื่อเบิกเป็นรอบๆ ได้ —
        // ต่างจาก $materialIssueLock ด้านบนที่ล็อกทั้งแถวรวมจำนวนด้วย (ยืนยันกับผู้ใช้แล้วว่าต้องการแค่ล็อกราคา)
        $quotationLock = null;
        if ($request->document_type === 'material_issue' && $request->reference_document_id) {
            $refDoc = SaleDocument::with('items')->find($request->reference_document_id);
            if ($refDoc && $refDoc->document_type === 'quotation') {
                $quotationLock = $refDoc;
            }
        }

        // 🎗️ ใบแจ้งหนี้ (invoice) ที่อ้างอิงใบกำกับภาษี (tax_invoice) ที่อนุมัติแล้ว — ล็อกทั้งรายการ (จำนวน/ราคา) ตรงจากใบกำกับภาษี
        // (invoice ไม่มี S/N ให้ต้องจัดการ — excluded จาก attachItemSerials() อยู่แล้ว)
        $taxInvoiceLock = null;
        if ($request->document_type === 'invoice' && $request->reference_document_id) {
            $refDoc = SaleDocument::with('items')->find($request->reference_document_id);
            if ($refDoc && $refDoc->document_type === 'tax_invoice') {
                $taxInvoiceLock = $refDoc;
            }
        }
        if ($request->document_type === 'invoice' && !$taxInvoiceLock) {
            return response()->json(['message' => 'ต้องเลือกใบกำกับภาษีที่อนุมัติแล้วเป็นเอกสารต้นทางเท่านั้น'], 422);
        }

        // 🧾 ใบวางบิล/ใบเสร็จรับเงิน อ้างอิงใบกำกับภาษีที่อนุมัติแล้วได้หลายใบแทนการกรอกรายการสินค้าเอง — ถ้าส่ง invoice_refs
        // มา ไม่บังคับ items เลย (ตารางสินค้าไม่มีความหมายในโหมดนี้ ยอดคำนวณจากใบกำกับภาษีที่เลือกแทน ดู logic ท้ายฟังก์ชัน)
        $hasInvoiceRefs = in_array($request->document_type, ['billing_invoice', 'receipt'])
            && is_array($request->invoice_refs) && count($request->invoice_refs) > 0;

        $request->validate([
            'document_type' => 'required|string|in:' . implode(',', self::DOC_TYPES),
            // 🎗️ ใบยืมสินค้า/ใบคืนสินค้ายืมไม่บังคับผูกกับลูกค้าในระบบ (อาจกรอกผู้ยืมเองผ่าน borrower_name แทน ใบคืนก็สืบทอด
            // สถานะไม่มีลูกค้ามาจากใบยืมต้นทางได้เช่นกัน) — ประเภทอื่นยังบังคับเหมือนเดิม
            // 🛡️ [2026-09-24] exists ทุกตัวกรอง company_id — เดิมเช็คแค่ว่า id มีอยู่จริงในตาราง (ไม่สนบริษัท) ทำให้ผูกเอกสารกับ
            // ผู้ติดต่อ/คลัง/สินค้า/โครงการของบริษัทอื่นได้ถ้ารู้หรือเดา id
            'contact_id' => in_array($request->document_type, ['loan_issue', 'loan_return'])
                ? ['nullable', Rule::exists('contacts', 'id')->where('company_id', auth()->user()->company_id)]
                : ['required', Rule::exists('contacts', 'id')->where('company_id', auth()->user()->company_id)],
            'borrower_name' => 'nullable|string|max:255',
            'borrower_phone' => 'nullable|string|max:50',
            'loan_direction' => 'nullable|in:lend_out,borrow_in',
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->where('company_id', auth()->user()->company_id)],
            'rental_job_id' => ['nullable', 'integer', Rule::exists('rental_jobs', 'id')->where('company_id', auth()->user()->company_id)],
            // 🎗️ ใบเบิกสินค้า(โครงการ) บังคับเลือกคลังสินค้าเสมอ — กันเช็ค/ล็อกสต๊อกผิดคลังตอนอนุมัติ (เดิมไม่บังคับ
            // ระบบจะ resolve ไปใช้คลัง default เงียบๆ ซึ่งอาจไม่ใช่คลังที่มีของจริง)
            'warehouse_id' => [
                in_array($request->document_type, ['material_issue', 'installation_issue']) ? 'required' : 'nullable',
                Rule::exists('warehouses', 'id')->where('company_id', auth()->user()->company_id),
            ],
            'issue_date' => 'nullable|date',
            'credit_days' => 'nullable|integer|min:0',
            // 🎗️ ใบยืมสินค้า — วันที่ต้องคืน กรอกตรงๆ ไม่คำนวณจาก credit_days (ดู logic ด้านล่าง)
            'due_date' => 'nullable|date',
            'tax_type' => 'required|in:include,exclude,none',
            // 🆕 ใบกำกับภาษี/ใบจัดสินค้า — รายการใบเบิกสินค้าที่อ้างอิง (many-to-many รองรับได้หลายใบ) — validate
            // เพิ่มเติม (คลังสินค้าเดียวกันเสมอ, ใบกำกับภาษีต้องมาจากใบเสนอราคาเดียวกันด้วย) ไว้ที่ $materialIssueLocks
            // ด้านบนแล้ว (เช็คก่อนถึงจุดนี้)
            'material_issue_ids' => 'nullable|array',
            'material_issue_ids.*' => 'integer|exists:sale_documents,id',
            'items' => $hasInvoiceRefs ? 'nullable|array' : 'required|array|min:1',
            'items.*.product_id' => $isBorrowIn ? 'nullable' : ['required', Rule::exists('products', 'id')->where('company_id', auth()->user()->company_id)],
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
            // 🎯 ใบเบิกสินค้าที่โหลดมาจากใบเสนอราคา — ชี้กลับไปยัง id ของแถวต้นทางในใบเสนอราคา (ข้ามเอกสาร ใช้คำนวณ
            // จำนวนคงเหลือที่ยังเบิกได้ ดู SaleDocumentController::issuableItems())
            'items.*.source_item_id' => 'nullable|integer|exists:sale_document_items,id',
            // 🧾 ใบวางบิล/ใบเสร็จรับเงิน — รายการใบกำกับภาษีที่อ้างอิง (many-to-many)
            'invoice_refs' => 'nullable|array',
            'invoice_refs.*.tax_invoice_id' => 'required_with:invoice_refs|integer',
            'invoice_refs.*.payment_amount' => 'nullable|numeric|min:0',
            'invoice_refs.*.outstanding_amount' => 'nullable|numeric|min:0',
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
            // 🔖 ใบกำกับภาษี/ใบส่งสินค้า — ติ๊กแสดง/ไม่แสดงเลข S/N ต่อท้ายรายการสินค้าตอนพิมพ์เอกสาร (default แสดง)
            'show_serials' => 'nullable|boolean',
        ]);

        // 🛡️ เช็คสิทธิ์ตามประเภทเอกสารที่ส่งมา (หลัง validate แล้วว่าเป็นค่าที่ถูกต้อง)
        if (!$this->hasPermission('create', $request->document_type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์สร้างเอกสารประเภทนี้'], 403);
        }

        // 🎗️ ใบเบิกสินค้าต้นทางต้องอนุมัติแล้วเท่านั้นถึงจะสร้างเอกสารอ้างอิงต่อได้ (ของยังไม่ถูกจองจริงจนกว่าจะอนุมัติ)
        if ($materialIssueLock && $materialIssueLock->status !== 'Approved') {
            return response()->json(['message' => 'ใบเบิกสินค้าที่อ้างอิงต้องอนุมัติแล้วก่อนจึงจะสร้างเอกสารนี้ได้'], 422);
        }
        if ($quotationLock && $quotationLock->status !== 'Approved') {
            return response()->json(['message' => 'ใบเสนอราคาที่อ้างอิงต้องอนุมัติแล้วก่อนจึงจะสร้างเอกสารนี้ได้'], 422);
        }
        if ($taxInvoiceLock && $taxInvoiceLock->status !== 'Approved') {
            return response()->json(['message' => 'ใบกำกับภาษีที่อ้างอิงต้องอนุมัติแล้วก่อนจึงจะสร้างเอกสารนี้ได้'], 422);
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

        // 🛡️ ใบเสร็จรับเงินต้องอ้างอิงใบกำกับภาษีที่อนุมัติแล้วผ่าน invoice_refs เท่านั้น — ห้ามสร้างจากรายการสินค้าอิสระอีกต่อไป
        // (เดิม validation รับ items แบบอิสระได้ถ้าไม่ส่ง invoice_refs มา ทั้งที่ UI ไม่เคยใช้ทางนั้นเลย ปิดช่องโหวนี้)
        if ($request->document_type === 'receipt' && !$hasInvoiceRefs) {
            return response()->json(['message' => 'ต้องเลือกใบกำกับภาษีที่อนุมัติแล้วอย่างน้อย 1 ใบ'], 422);
        }

        // 🐛 [2026-09-24] ยอดชำระในใบเสร็จต้องไม่เกินยอดค้างชำระของใบกำกับภาษีที่อ้างอิง (เดิมไม่เช็คเลย จ่ายเกินได้)
        if ($request->document_type === 'receipt' && $hasInvoiceRefs && ($err = $this->receiptOverpaymentError($request->invoice_refs))) {
            return response()->json(['message' => $err, 'errors' => ['invoice_refs' => [$err]]], 422);
        }

        // 🐛 [2026-09-24] ใบคืนสินค้ายืม/เช่า: จำนวนคืนต้องไม่เกินที่ยืม/เบิกไป และเอกสารต้นทางต้องอนุมัติแล้ว
        if ($err = $this->returnQuantityError((string) $request->document_type, $request->reference_document_id, $request->items ?? [])) {
            return response()->json(['message' => $err, 'errors' => ['items' => [$err]]], 422);
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
                // 🎗️ ล็อกคลังสินค้าให้ตรงกับใบเบิกต้นทางเสมอ (กันปลดจอง/ตัดสต๊อกผิดคลังตอนอนุมัติ) — ใบเบิกหลายใบ
                // ต้องมาจากคลังเดียวกันอยู่แล้ว (เช็คไว้ด้านบน) ใช้ใบแรกเป็นตัวแทนได้เลย
                'warehouse_id' => $materialIssueLocks->isNotEmpty()
                    ? $materialIssueLocks->first()->warehouse_id
                    : ($materialIssueLock ? $materialIssueLock->warehouse_id : $request->warehouse_id),
                'contact_id' => $request->contact_id,
                'borrower_name' => $request->borrower_name,
                'borrower_phone' => $request->borrower_phone,
                'loan_direction' => $request->document_type === 'loan_issue' ? ($request->loan_direction ?? 'lend_out') : null,
                'document_type' => $request->document_type,
                'document_number' => $docNumber,
                // 🆕 เก็บใบเบิกใบแรกไว้ในคอลัมน์เดิมเพื่อความเข้ากันได้ย้อนหลัง (โค้ด/รายงานอื่นที่ยังอ่านค่านี้ตรงๆ)
                // ส่วนรายการทั้งหมดจริงๆ อยู่ในตาราง sale_document_material_issue_refs (ดูด้านบน/ด้านล่าง)
                'reference_document_id' => $materialIssueLocks->isNotEmpty() ? $materialIssueLocks->first()->id : $request->reference_document_id,
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
                'show_serials' => $request->has('show_serials') ? $request->boolean('show_serials') : true,
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
                        'outstanding_amount' => $request->document_type === 'receipt' && isset($refRow['outstanding_amount']) && $refRow['outstanding_amount'] !== '' ? (float) $refRow['outstanding_amount'] : null,
                    ]);
                }
                // ไม่หัก/บวกส่วนลด-ภาษีเพิ่มเติม — เอกสารประเภทนี้เป็นแค่ตัวรวบรวม/รับชำระยอดจากใบกำกับภาษีที่คิดภาษีไปแล้ว
                $document->update(['discount_amount' => 0, 'vat_amount' => 0, 'wht_amount' => 0]);
            } elseif ($materialIssueLocks->isNotEmpty()) {
                // 🆕 4. ใบกำกับภาษี/ใบจัดสินค้าที่รวมรายการจากใบเบิกสินค้าหลายใบ (คลังสินค้าเดียวกัน เช็คไว้ด้านบนแล้ว) —
                // ใบกำกับภาษี: จับคู่สินค้าชนิดเดียวกันด้วย source_item_id ก่อน (แถวที่มาจากแถวใบเสนอราคาเดียวกัน ราคาต้อง
                // ตรงกันเป๊ะอยู่แล้ว เพราะบังคับมาจากใบเสนอราคาเดียวกัน) ถ้าไม่มี source_item_id (ใบเบิกที่สร้างเองไม่ผ่าน
                // ใบเสนอราคา) fallback มา group ด้วย product_id+unit_price แทน — ถ้าราคาไม่ตรงกันจะไม่ถูกรวมแถว (แยกเป็น
                // คนละแถวไว้ตามที่ผู้ใช้ยืนยัน ไม่เดารวมราคาให้เอง กันตัวเลขผิดแบบเงียบๆ)
                // 🆕 [2026-09-15] ใบจัดสินค้า: จับคู่ด้วย product_id ตรงๆ เท่านั้น (ไม่สนราคา/ใบเสนอราคาต้นทาง) — ใบเบิก
                // ที่เลือกมาอาจมาจากคนละใบเสนอราคากันได้ (ยืนยันกับผู้ใช้แล้วว่าต้องการแค่ "รวมสินค้าเดียวกันไว้แถวเดียว
                // บวกจำนวนกัน" ไม่สนที่มา เพราะใบจัดสินค้าไม่มีเรื่องราคาเกี่ยวข้องเลย)
                $groups = [];
                $groupOrder = [];
                // 🆕 [2026-09-15] จำว่า item.id เดิมของใบเบิกต้นทางแต่ละแถว ตกไปอยู่กลุ่ม (key) ไหนหลัง merge — ใช้หา
                // "กลุ่มแม่" ของแถวลูก Bundle ในรอบถัดไป (แก้บั๊ก: เดิมโค้ดนี้ไม่เคยผูก parent_item_id เลย ทำให้ PDF
                // เห็นแถวลูก Bundle เป็นรายการแยกมีเลขลำดับเอง — ใบเบิกสินค้ารองรับ Bundle ได้จริง ไม่ใช่ตามที่เข้าใจผิดไว้)
                $oldItemIdToGroupKey = [];
                // 🆕 [2026-09-20] ใบจัดสินค้าไม่ต้องมีรายการบริการ (service เช่น ค่าติดตั้ง — ไม่มีของให้จัด) ข้ามทั้งรอบ group
                // และรอบผูกแถวแม่ด้านล่าง (ใบกำกับภาษียังรวมทุกแถวตามเดิม)
                $skipServiceRows = $request->document_type === 'packing_list';
                foreach ($materialIssueLocks as $mi) {
                    foreach ($mi->items as $sourceItem) {
                        if ($skipServiceRows && $sourceItem->product?->product_type === 'service') continue;
                        $key = $request->document_type === 'packing_list'
                            ? 'pl:' . $sourceItem->product_id
                            : ($sourceItem->source_item_id
                                ? 'src:' . $sourceItem->source_item_id
                                : 'pp:' . $sourceItem->product_id . ':' . $sourceItem->unit_price);
                        if (!isset($groups[$key])) {
                            $groups[$key] = [
                                'product_id' => $sourceItem->product_id,
                                'item_name' => $sourceItem->item_name,
                                'unit_name' => $sourceItem->unit_name,
                                'unit_price' => $sourceItem->unit_price,
                                'cost_price' => $sourceItem->cost_price,
                                'discount_percent' => $sourceItem->discount_percent,
                                'tax_rate' => $sourceItem->tax_rate,
                                'wht_rate' => $sourceItem->wht_rate,
                                'source_item_id' => $sourceItem->source_item_id,
                                'quantity' => 0,
                                'discount_amount' => 0,
                                'tax_amount' => 0,
                                'wht_amount' => 0,
                                'serials' => [],
                                'parent_group_key' => null,
                            ];
                            $groupOrder[] = $key;
                        }
                        $groups[$key]['quantity'] += (float) $sourceItem->quantity;
                        $groups[$key]['discount_amount'] += (float) $sourceItem->discount_amount;
                        $groups[$key]['tax_amount'] += (float) $sourceItem->tax_amount;
                        $groups[$key]['wht_amount'] += (float) $sourceItem->wht_amount;
                        $groups[$key]['serials'] = array_merge($groups[$key]['serials'], $sourceItem->serials->pluck('serial_number')->all());
                        $oldItemIdToGroupKey[$sourceItem->id] = $key;
                    }
                }
                // รอบสอง (ก่อนสร้างจริง): resolve ว่ากลุ่มไหนเป็น "กลุ่มแม่" ของกลุ่มไหน จาก parent_item_id เดิมของ
                // แถวต้นทาง (ชี้ไปหา item.id ในใบเบิก) แมปผ่าน $oldItemIdToGroupKey ที่จดไว้จากรอบแรก
                if ($skipServiceRows && empty($groups)) {
                    DB::rollBack();
                    return response()->json(['message' => 'ใบเบิกสินค้าที่เลือกมีแต่รายการบริการ ไม่ต้องจัดสินค้า'], 422);
                }
                foreach ($materialIssueLocks as $mi) {
                    foreach ($mi->items as $sourceItem) {
                        if (!$sourceItem->parent_item_id) continue;
                        $ownKey = $oldItemIdToGroupKey[$sourceItem->id] ?? null;
                        $parentKey = $oldItemIdToGroupKey[$sourceItem->parent_item_id] ?? null;
                        if ($ownKey && $parentKey && $ownKey !== $parentKey) {
                            $groups[$ownKey]['parent_group_key'] = $parentKey;
                        }
                    }
                }

                $groupKeyToNewItemId = [];
                foreach ($groupOrder as $key) {
                    $g = $groups[$key];
                    $netItemPrice = ($g['quantity'] * $g['unit_price']) - $g['discount_amount'];
                    $subtotal += $netItemPrice;

                    $newItem = SaleDocumentItem::create([
                        'sale_document_id' => $document->id,
                        'product_id' => $g['product_id'],
                        'item_name' => $g['item_name'],
                        // 🎯 ยังคงชี้ไปยังแถวต้นทางในใบเสนอราคาเดิม (ไม่ใช่ในใบเบิกสินค้า) — สืบทอดมาจาก source_item_id
                        // ของใบเบิกที่รวมมา ทุกแถวย่อยที่ถูกรวมด้วย key เดียวกันชี้ไปยังแถวใบเสนอราคาเดียวกันอยู่แล้ว
                        'source_item_id' => $g['source_item_id'],
                        'quantity' => $g['quantity'],
                        'unit_name' => $g['unit_name'],
                        'unit_price' => $g['unit_price'],
                        'cost_price' => $g['cost_price'],
                        'discount_percent' => $g['discount_percent'],
                        'discount_amount' => $g['discount_amount'],
                        'tax_rate' => $g['tax_rate'],
                        'tax_amount' => $g['tax_amount'],
                        'wht_rate' => $g['wht_rate'],
                        'wht_amount' => $g['wht_amount'],
                        'total_price' => $netItemPrice,
                    ]);
                    $groupKeyToNewItemId[$key] = $newItem->id;

                    if ($g['product_id'] && !empty($g['serials'])) {
                        // 🛡️ S/N ทุกตัวสืบทอดมาจากใบเบิกสินค้าต้นทางที่อนุมัติแล้วเท่านั้น (เช็คสถานะไว้ด้านบนแล้ว) —
                        // ตอนใบเบิกอนุมัติ S/N จะถูกเปลี่ยนเป็น 'rented' แล้ว จึงต้องเช็คด้วยสถานะนี้ ไม่ใช่ 'available'
                        $this->attachItemSerials($newItem, $g['serials'], 'rented');
                    }
                }
                // รอบสาม: ผูก parent_item_id จริงของแต่ละกลุ่มเข้ากับ ID ใหม่ของกลุ่มแม่ที่เพิ่งสร้าง
                foreach ($groupOrder as $key) {
                    $parentKey = $groups[$key]['parent_group_key'];
                    if ($parentKey && isset($groupKeyToNewItemId[$parentKey])) {
                        SaleDocumentItem::where('id', $groupKeyToNewItemId[$key])
                            ->update(['parent_item_id' => $groupKeyToNewItemId[$parentKey]]);
                    }
                }

                foreach ($materialIssueLocks as $mi) {
                    SaleDocumentMaterialIssueRef::create([
                        'sale_document_id' => $document->id,
                        'material_issue_id' => $mi->id,
                    ]);
                }
            } elseif ($materialIssueLock) {
                // 🎗️ 4. รายการสินค้า "ล็อก" ตรงจากใบเบิกสินค้าต้นทาง — เมิน $request->items ทั้งหมด (client ส่งมาแค่โชว์ผล ไม่มีผลจริง)
                // 🆕 S/N ก็ล็อกตามใบเบิกสินค้าต้นทางเช่นกัน — ย้ายจุดเลือก S/N มาที่ตอนสร้าง/แก้ไขใบเบิกสินค้าแล้ว
                // (ไม่ใช่ที่ใบส่งสินค้า/บิลเงินสดอีกต่อไป) เอกสารที่ล็อกด้วย $materialIssueLock (cash เท่านั้นแล้ว —
                // tax_invoice/packing_list/delivery_note ย้ายไปใช้ $materialIssueLocks พหูพจน์ด้านบนแล้ว) จึงอ่าน S/N ตรงจาก
                // $sourceItem->serials เดียวกันหมด ไม่ต้องดูใบจัดสินค้าซ้อนในอีกชั้นแบบเดิม
                // 🔄 [2026-09-15] ใบเบิกสินค้าต้นทาง "รองรับ" สินค้าชุด (Bundle) ได้จริง (สืบทอดโครงสร้างมาจากใบเสนอราคา
                // ผ่าน quotationLock ตอนสร้างใบเบิกเอง) — คอมเมนต์เดิมที่บอกว่าไม่รองรับเป็นความเข้าใจผิด ทำให้แถวลูก
                // Bundle ของใบเบิกไม่เคยถูกผูก parent_item_id เข้ากับแถวแม่ใหม่เลย แสดงใน PDF เป็นรายการแยกมีเลขลำดับ
                // เอง — แก้ด้วย 2-pass เดียวกับ store()/duplicate() (ดูคอมเมนต์ยาวที่ duplicate() ด้านล่างของไฟล์)
                $oldToNewItemId = [];
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
                    $oldToNewItemId[$sourceItem->id] = $newItem->id;

                    if ($sourceItem->product_id) {
                        // 🛡️ ใบเบิกสินค้าต้นทางต้องอนุมัติแล้วเสมอก่อนจะมาถึง branch นี้ (เช็คไว้ด้านบนแล้ว) — ตอนอนุมัติ
                        // ใบเบิก S/N ที่ถูกเลือกไว้จะถูกเปลี่ยนสถานะเป็น 'rented' ทันที (กันไม่ให้เอกสารอื่นแย่งเลือก
                        // S/N ตัวเดียวกันซ้ำ — ดู approve() branch stock_issue/loan_issue/material_issue) จึงต้อง
                        // ตรวจสอบด้วยสถานะ 'rented' ที่นี่ ไม่ใช่ 'available' เหมือนตอนยังไม่อนุมัติ
                        $sourceSerials = $sourceItem->serials->pluck('serial_number')->all();
                        $this->attachItemSerials($newItem, $sourceSerials, 'rented');
                    }
                }
                // pass สอง: ผูกแถวส่วนประกอบ (Bundle child) เข้ากับ ID ใหม่ของแถวแม่ในเอกสารนี้ (ห้ามใช้ parent_item_id
                // เดิมของใบเบิกตรงๆ — ชี้ไปหา ID ในใบเบิก คนละเอกสารกับใบนี้)
                foreach ($materialIssueLock->items as $sourceItem) {
                    if ($sourceItem->parent_item_id && isset($oldToNewItemId[$sourceItem->parent_item_id])) {
                        SaleDocumentItem::where('id', $oldToNewItemId[$sourceItem->id])
                            ->update(['parent_item_id' => $oldToNewItemId[$sourceItem->parent_item_id]]);
                    }
                }
            } elseif ($taxInvoiceLock) {
                // 🎗️ ใบแจ้งหนี้ที่ล็อกจากใบกำกับภาษี — คัดลอกรายการตรงๆ เหมือน $materialIssueLock ด้านบน แต่ไม่มี S/N ให้จัดการ
                foreach ($taxInvoiceLock->items as $sourceItem) {
                    $netItemPrice = (float) $sourceItem->total_price;
                    $subtotal += $netItemPrice;

                    SaleDocumentItem::create([
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
                }
            } else {
                // 🛒 4. บันทึกรายการสินค้า (2-pass เพื่อรองรับแถวลูก/ส่วนประกอบสินค้าชุดที่ต้องอ้างอิง ID ของแถวแม่ที่เพิ่งสร้าง)
                // pass แรก: สร้างทุกแถวตามเดิม — แถวที่มี parent_index (เป็นส่วนประกอบ) บังคับราคา/ส่วนลด = 0 กันบวกราคาซ้ำ
                // 🎗️ ใบเบิกสินค้าที่อ้างอิงใบเสนอราคา — จับคู่แถวกับใบเสนอราคาต้นทางผ่าน source_item_id เพื่อล็อกราคา (ดู $quotationLock)
                $quotationItemsById = $quotationLock ? $quotationLock->items->keyBy('id') : collect();

                $createdItems = [];
                foreach ($request->items as $index => $item) {
                    $isBundleChild = isset($item['parent_index']);

                    // 🎗️ ถ้าล็อกกับใบเสนอราคา (material_issue เท่านั้น) — หาแถวต้นทางที่ตรงกันผ่าน source_item_id
                    // แล้วยึด "ราคา/อัตราส่วนลด-ภาษี" จากใบเสนอราคาเสมอ (เมินค่าที่ client ส่งมาส่วนนี้) ส่วนจำนวนยังใช้
                    // ของ client เพราะเบิกเป็นรอบๆ ได้ (อาจน้อยกว่าที่เสนอราคาไว้) — ส่วนลด/ภาษี/หัก ณ ที่จ่ายที่เป็นยอด
                    // เงินสัมบูรณ์ (ไม่ใช่ %) ต้อง scale ตามสัดส่วนจำนวนที่เบิกจริงรอบนี้ ไม่ใช่ก็อปยอดเต็มมาตรงๆ
                    $sourceQuotationItem = null;
                    if ($quotationLock && !$isBundleChild) {
                        $sourceQuotationItem = !empty($item['source_item_id']) ? $quotationItemsById->get($item['source_item_id']) : null;
                        if (!$sourceQuotationItem) {
                            DB::rollBack();
                            return response()->json(['message' => 'พบรายการสินค้าที่ไม่ตรงกับใบเสนอราคาต้นทาง กรุณาโหลดข้อมูลจากใบเสนอราคาใหม่อีกครั้ง'], 422);
                        }
                    }

                    if ($sourceQuotationItem) {
                        $ratio = ((float) $sourceQuotationItem->quantity) > 0 ? ($item['quantity'] / (float) $sourceQuotationItem->quantity) : 1;
                        $unitPrice = (float) $sourceQuotationItem->unit_price;
                        $discountPercent = $sourceQuotationItem->discount_percent;
                        $itemDiscount = (float) $sourceQuotationItem->discount_amount * $ratio;
                        $taxRate = $sourceQuotationItem->tax_rate;
                        $taxAmount = (float) $sourceQuotationItem->tax_amount * $ratio;
                        $whtRate = $sourceQuotationItem->wht_rate;
                        $whtAmount = (float) $sourceQuotationItem->wht_amount * $ratio;
                    } else {
                        $unitPrice = $isBundleChild ? 0 : $item['unit_price'];
                        $discountPercent = $isBundleChild ? null : ($item['discount_percent'] ?? null);
                        $itemDiscount = $isBundleChild ? 0 : ($item['discount_amount'] ?? 0);
                        $taxRate = $isBundleChild ? 0 : ($item['tax_rate'] ?? 0);
                        $taxAmount = $isBundleChild ? 0 : ($item['tax_amount'] ?? 0);
                        $whtRate = $isBundleChild ? null : ($item['wht_rate'] ?? null);
                        $whtAmount = $isBundleChild ? 0 : ($item['wht_amount'] ?? 0);
                    }
                    $costPrice = $isBundleChild ? 0 : ($item['cost_price'] ?? null);
                    $totalPrice = $item['quantity'] * $unitPrice;
                    $netItemPrice = $totalPrice - $itemDiscount;

                    $subtotal += $netItemPrice;

                    $newItem = SaleDocumentItem::create([
                        'sale_document_id' => $document->id,
                        'product_id' => $item['product_id'] ?? null,
                        'item_name' => $item['item_name'] ?? null,
                        // 🎯 ใบเบิกสินค้าที่โหลดมาจากใบเสนอราคาผ่าน issuableItems() — เก็บ id แถวต้นทางไว้คำนวณ
                        // จำนวนคงเหลือที่ยังเบิกได้ (ดูเอกสารประเภทอื่นๆ ไม่ส่งค่านี้มา จึงเป็น null ตามปกติ)
                        'source_item_id' => $request->document_type === 'material_issue' ? ($item['source_item_id'] ?? null) : null,
                        'quantity' => $item['quantity'],
                        'unit_name' => $item['unit_name'] ?? 'ชิ้น',
                        'unit_price' => $unitPrice,
                        'cost_price' => $costPrice,
                        'discount_percent' => $discountPercent,
                        'discount_amount' => $itemDiscount,
                        'tax_rate' => $taxRate,
                        'tax_amount' => $taxAmount,
                        'wht_rate' => $whtRate,
                        'wht_amount' => $whtAmount,
                        'total_price' => $netItemPrice,
                    ]);
                    $createdItems[$index] = $newItem;

                    // 📝 ใบเสนอราคา/ใบวางบิล/ใบลดหนี้ ไม่ตัดสต๊อกหรือยึด S/N จริง — ไม่บังคับเลือก S/N ตอนสร้าง
                    // (ใบลดหนี้ไม่ผูก S/N โดยตรงอีกต่อไป — ของจริงจะกลับเข้าคลังแบบระบุ S/N ผ่าน "ใบคืนสินค้า" ที่อ้างอิงใบลดหนี้นี้แทน)
                    // 🆕 ใบเบิกสินค้า (material_issue) ตอนนี้บังคับเลือก S/N ตอนสร้าง/แก้ไขแทน (ย้ายมาจากใบจัดสินค้าเดิม) —
                    // เอกสารดาวน์สตรีม (packing_list/tax_invoice/delivery_note) จึงแค่สืบทอด S/N นี้ต่อ ไม่เลือกซ้ำอีก
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
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], $e instanceof \DomainException ? 422 : 500);
        }
    }

    // 🐛 [2026-09-24] ตรวจว่ายอดชำระรายใบกำกับภาษีใน invoice_refs ของใบเสร็จ ไม่เกินยอดค้างชำระจริง ณ ตอนนี้
    // (สูตรเดียวกับ outstandingBalances(): grand_total - ผลรวม payment_amount ของใบเสร็จที่ Approved ที่อ้างใบนั้นอยู่)
    // $excludeDocId = ใบเสร็จใบที่กำลังตรวจอยู่เอง (กันนับซ้ำตัวเองถ้าเป็น Approved) คืนข้อความ error หรือ null ถ้าผ่าน
    // $lock = true ล็อกแถวใบกำกับภาษีไว้ (ใช้ตอน approve ในทรานแซกชัน กันอนุมัติใบเสร็จ 2 ใบพร้อมกันจ่ายเกิน)
    private function receiptOverpaymentError($invoiceRefs, ?int $excludeDocId = null, bool $lock = false): ?string
    {
        foreach (collect($invoiceRefs) as $ref) {
            $taxInvoiceId = (int) (is_array($ref) ? ($ref['tax_invoice_id'] ?? 0) : $ref->tax_invoice_id);
            $payment = (float) (is_array($ref) ? ($ref['payment_amount'] ?? 0) : ($ref->payment_amount ?? 0));
            if ($taxInvoiceId <= 0 || $payment <= 0) continue;

            $taxInvoiceQuery = SaleDocument::where('id', $taxInvoiceId);
            if ($lock) $taxInvoiceQuery->lockForUpdate();
            $taxInvoice = $taxInvoiceQuery->first();
            if (!$taxInvoice) continue;

            $paid = (float) SaleDocumentInvoiceRef::where('tax_invoice_id', $taxInvoiceId)
                ->whereHas('saleDocument', function ($q) use ($excludeDocId) {
                    $q->where('document_type', 'receipt')->where('status', 'Approved');
                    if ($excludeDocId) $q->where('id', '!=', $excludeDocId);
                })
                ->sum('payment_amount');
            $outstanding = round((float) $taxInvoice->grand_total - $paid, 2);

            if ($payment - $outstanding > 0.005) {
                return sprintf(
                    'ยอดชำระ %s เกินยอดค้างชำระของใบกำกับภาษี %s (ค้างชำระ %s)',
                    number_format($payment, 2),
                    $taxInvoice->document_number,
                    number_format(max(0, $outstanding), 2)
                );
            }
        }
        return null;
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

    // 🐛 [2026-09-24] ตรวจใบคืนสินค้ายืม (loan_return) / ใบคืนสินค้าเช่า (rental_stock_return) ฝั่ง backend — เดิมจำกัดจำนวนที่คืนได้
    // เฉพาะที่หน้าจอ (loanOutstanding) ส่วน API ไม่เช็คเลย: คืนเกินที่ยืม/เบิก หรือคืนซ้ำหลังคืนครบแล้วก็อนุมัติผ่าน และไปปลด
    // "จอง" ของเอกสารอื่นทิ้ง (reserved_qty ลดเกินที่ใบนี้จองไว้) เงื่อนไข:
    //  1) เอกสารต้นทางต้องเป็นใบยืม/ใบเบิกเช่าของบริษัทเดียวกันที่อนุมัติแล้ว
    //  2) จำนวนคืนต่อสินค้า (ทุกใบที่ไม่ยกเลิก + ใบนี้) ต้องไม่เกินจำนวนที่ยืม/เบิกไป (จับคู่ด้วย product_id หรือชื่อรายการ
    //     เหมือน loanOutstandingByLoan())
    // $excludeDocId = ใบคืนใบเดิมที่กำลังแก้/อนุมัติ (ไม่นับซ้ำตัวเอง) คืนข้อความ error หรือ null ถ้าผ่าน
    private function returnQuantityError(string $documentType, $referenceDocumentId, $items, ?int $excludeDocId = null): ?string
    {
        if (!in_array($documentType, ['loan_return', 'rental_stock_return']) || !$referenceDocumentId) return null;

        $sourceType = $documentType === 'loan_return' ? 'loan_issue' : 'stock_issue';
        $source = SaleDocument::where('id', $referenceDocumentId)
            ->where('company_id', auth()->user()->company_id)
            ->where('document_type', $sourceType)
            ->first();
        if (!$source) {
            return 'ไม่พบเอกสารต้นทางที่อ้างอิง (' . ($sourceType === 'loan_issue' ? 'ใบยืมสินค้า' : 'ใบเบิกสินค้าเช่า') . ')';
        }
        if ($source->status !== 'Approved') {
            return "เอกสารต้นทาง {$source->document_number} ยังไม่ได้อยู่ในสถานะอนุมัติ ไม่สามารถทำรายการคืนได้";
        }

        $keyOf = fn ($productId, $itemName) => $productId ? 'p' . $productId : 'n' . mb_strtolower(trim((string) $itemName));
        $rowKey = fn ($row) => $keyOf(
            is_array($row) ? ($row['product_id'] ?? null) : $row->product_id,
            is_array($row) ? ($row['item_name'] ?? null) : $row->item_name
        );
        $rowQty = fn ($row) => (float) (is_array($row) ? ($row['quantity'] ?? 0) : $row->quantity);

        $issued = [];
        foreach (SaleDocumentItem::where('sale_document_id', $source->id)->get(['product_id', 'item_name', 'quantity']) as $row) {
            $issued[$rowKey($row)] = ($issued[$rowKey($row)] ?? 0) + $rowQty($row);
        }

        $returnedByOthers = [];
        $othersQuery = SaleDocumentItem::query()
            ->join('sale_documents', 'sale_documents.id', '=', 'sale_document_items.sale_document_id')
            ->where('sale_documents.document_type', $documentType)
            ->where('sale_documents.status', '!=', 'Cancelled')
            ->where('sale_documents.reference_document_id', $source->id)
            ->whereNull('sale_documents.deleted_at');
        if ($excludeDocId) $othersQuery->where('sale_documents.id', '!=', $excludeDocId);
        foreach ($othersQuery->get(['sale_document_items.product_id', 'sale_document_items.item_name', 'sale_document_items.quantity']) as $row) {
            $returnedByOthers[$rowKey($row)] = ($returnedByOthers[$rowKey($row)] ?? 0) + $rowQty($row);
        }

        $requested = [];
        $names = [];
        foreach (collect($items) as $row) {
            $k = $rowKey($row);
            $requested[$k] = ($requested[$k] ?? 0) + $rowQty($row);
            $names[$k] = is_array($row) ? ($row['item_name'] ?? null) : ($row->item_name ?? null);
        }

        foreach ($requested as $k => $qty) {
            $remaining = ($issued[$k] ?? 0) - ($returnedByOthers[$k] ?? 0);
            if ($qty - $remaining > 0.0001) {
                $label = $names[$k] ?: (str_starts_with($k, 'p') ? optional(\App\Models\Product::find((int) substr($k, 1)))->name : null) ?: 'รายการที่เลือก';
                return sprintf('จำนวนคืนของ "%s" (%s) เกินจำนวนที่ยังคืนได้ (%s) ตามเอกสารต้นทาง %s',
                    $label, rtrim(rtrim(number_format($qty, 2, '.', ''), '0'), '.'),
                    rtrim(rtrim(number_format(max(0, $remaining), 2, '.', ''), '0'), '.'), $source->document_number);
            }
        }
        return null;
    }

    // 🆕 [2026-09-20] จำนวนที่ "ยังไม่ได้คืน" ต่อแถวของใบยืมสินค้า (loan_issue) — ยอดยืม - ยอดที่คืนไปแล้วผ่านใบคืนสินค้ายืม
    // (loan_return ที่ไม่ยกเลิก อ้างอิงใบยืมนี้) จับคู่แถวด้วย product_id (ยืมเข้าไม่มี product_id ใช้ชื่อรายการแทน)
    // คืน [loanId => [['item_id','product_id','item_name','outstanding_quantity'], ...]] เฉพาะแถวที่ยังเหลือ > 0
    // 🆕 [2026-09-20] ใช้ซ้ำกับใบเบิกสินค้าเช่า (stock_issue) ↔ ใบคืนสินค้าเช่า (rental_stock_return) ผ่านพารามิเตอร์ $returnTypes
    private function loanOutstandingByLoan($loanIds, array $returnTypes = ['loan_return']): array
    {
        $loanIds = collect($loanIds)->filter()->unique()->values();
        if ($loanIds->isEmpty()) return [];

        $loanItems = SaleDocumentItem::whereIn('sale_document_id', $loanIds)->orderBy('id')
            ->get(['id', 'sale_document_id', 'product_id', 'item_name', 'quantity']);

        $returnedItems = SaleDocumentItem::query()
            ->join('sale_documents', 'sale_documents.id', '=', 'sale_document_items.sale_document_id')
            ->whereIn('sale_documents.document_type', $returnTypes)
            ->where('sale_documents.status', '!=', 'Cancelled')
            ->whereIn('sale_documents.reference_document_id', $loanIds)
            ->whereNull('sale_documents.deleted_at')
            ->get(['sale_documents.reference_document_id as loan_id', 'sale_document_items.product_id', 'sale_document_items.item_name', 'sale_document_items.quantity']);

        $keyOf = fn ($productId, $itemName) => $productId ? 'p' . $productId : 'n' . mb_strtolower((string) $itemName);
        $returned = [];
        foreach ($returnedItems as $r) {
            $k = $r->loan_id . '|' . $keyOf($r->product_id, $r->item_name);
            $returned[$k] = ($returned[$k] ?? 0) + (float) $r->quantity;
        }

        $result = [];
        foreach ($loanItems as $item) {
            $k = $item->sale_document_id . '|' . $keyOf($item->product_id, $item->item_name);
            $qty = (float) $item->quantity;
            $take = min($qty, $returned[$k] ?? 0);
            $returned[$k] = ($returned[$k] ?? 0) - $take;
            $outstanding = $qty - $take;
            if ($outstanding > 0.0001) {
                $result[$item->sale_document_id][] = [
                    'item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'item_name' => $item->item_name,
                    'outstanding_quantity' => $outstanding,
                ];
            }
        }
        return $result;
    }

    // GET /api/sale-documents/returnable-loans — ใบยืมสินค้าที่อนุมัติแล้วและ "ยังคืนไม่ครบ" (แสดงในหน้าใบคืนสินค้ายืมพร้อมปุ่มคืนสินค้า)
    public function returnableLoans()
    {
        if (!$this->hasPermission('view', 'loan_return')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารประเภทนี้'], 403);
        }

        $loans = SaleDocument::with(['contact'])
            ->where('company_id', auth()->user()->company_id)
            ->where('document_type', 'loan_issue')
            ->where('status', 'Approved')
            ->latest()
            ->get();

        $outstanding = $this->loanOutstandingByLoan($loans->pluck('id'));

        return response()->json(['data' => $loans->filter(fn ($l) => isset($outstanding[$l->id]))->values()]);
    }

    // GET /api/sale-documents/{id}/loan-outstanding — แถวของใบยืมที่ยังคืนไม่ครบ พร้อมจำนวนคงค้าง (หน้าสร้างใบคืนใช้จำกัดจำนวนที่คืนได้)
    public function loanOutstanding($id)
    {
        if (!$this->hasPermission('view', 'loan_return')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารประเภทนี้'], 403);
        }

        $loan = SaleDocument::where('company_id', auth()->user()->company_id)
            ->where('document_type', 'loan_issue')
            ->find($id);
        if (!$loan) return response()->json(['message' => 'ไม่พบใบยืมสินค้า'], 404);

        return response()->json(['data' => $this->loanOutstandingByLoan([$loan->id])[$loan->id] ?? []]);
    }

    // 🆕 [2026-09-20] GET /api/sale-documents/returnable-stock-issues — ใบเบิกสินค้าเช่า (stock_issue) ที่อนุมัติแล้วและ "ยังคืนไม่ครบ"
    // (แสดงในหน้าใบคืนสินค้าเช่าพร้อมปุ่มคืนสินค้า) — สูตรเดียวกับ returnableLoans() แต่นับยอดที่คืนผ่าน rental_stock_return
    public function returnableStockIssues()
    {
        if (!$this->hasPermission('view', 'rental_stock_return')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารประเภทนี้'], 403);
        }

        $issues = SaleDocument::with(['contact', 'rentalJob:id,name'])
            ->where('company_id', auth()->user()->company_id)
            ->where('document_type', 'stock_issue')
            ->where('status', 'Approved')
            ->latest()
            ->get();

        $outstanding = $this->loanOutstandingByLoan($issues->pluck('id'), ['rental_stock_return']);

        return response()->json(['data' => $issues->filter(fn ($d) => isset($outstanding[$d->id]))->values()]);
    }

    // GET /api/sale-documents/{id}/stock-issue-outstanding — แถวของใบเบิกสินค้าเช่าที่ยังคืนไม่ครบ พร้อมจำนวนคงค้าง
    public function stockIssueOutstanding($id)
    {
        if (!$this->hasPermission('view', 'rental_stock_return')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารประเภทนี้'], 403);
        }

        $issue = SaleDocument::where('company_id', auth()->user()->company_id)
            ->where('document_type', 'stock_issue')
            ->find($id);
        if (!$issue) return response()->json(['message' => 'ไม่พบใบเบิกสินค้าเช่า'], 404);

        return response()->json(['data' => $this->loanOutstandingByLoan([$issue->id], ['rental_stock_return'])[$issue->id] ?? []]);
    }

    // GET /api/sale-documents/packable-material-issues — ใบเบิกสินค้าที่อนุมัติแล้วและ "รอจัดสินค้า" (ใช้แสดงในหน้าใบจัดสินค้า)
    // เงื่อนไข: มีโครงการ (หน้าสร้างใบจัดสินค้าต้องเลือกโครงการเสมอ), ยังไม่ถูกใบจัดสินค้าที่ไม่ยกเลิกจองไว้ (เช็ค
    // reference_document_id + pivot materialIssueRefs เหมือน store()), และมีอย่างน้อย 1 แถวที่ไม่ใช่บริการ (service)
    public function packableMaterialIssues()
    {
        if (!$this->hasPermission('view', 'packing_list')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูเอกสารประเภทนี้'], 403);
        }

        $companyId = auth()->user()->company_id;

        $claimedIds = SaleDocument::where('company_id', $companyId)
            ->where('document_type', 'packing_list')
            ->where('status', '!=', 'Cancelled')
            ->with('materialIssueRefs:id,sale_document_id,material_issue_id')
            ->get(['id', 'reference_document_id'])
            ->flatMap(fn ($pl) => $pl->materialIssueRefs->pluck('material_issue_id')->push($pl->reference_document_id))
            ->filter()
            ->unique();

        $issues = SaleDocument::with(['contact', 'project'])
            ->where('company_id', $companyId)
            ->where('document_type', 'material_issue')
            ->where('status', 'Approved')
            ->whereNotNull('project_id')
            ->whereNotIn('id', $claimedIds)
            ->whereHas('items', fn ($q) => $q->whereHas('product', fn ($p) => $p->where('product_type', '!=', 'service')))
            ->latest()
            ->get();

        return response()->json(['data' => $issues]);
    }

    // GET /api/sale-documents/lookup?q= — ค้นเอกสารขายที่อนุมัติแล้ว (เฉพาะ 3 ประเภท stock-out) ด้วยเลขที่เอกสาร/ชื่อลูกค้า/รหัสลูกค้า
    // ใช้สำหรับหน้ารับแจ้งซ่อมกรณีสินค้าไม่มี S/N (ต้องอ้างอิงเอกสารขายเดิมเพื่อผูกกับลูกค้า) — gate ด้วย view_repairs ไม่ใช่สิทธิ์ฝ่ายขาย
    public function lookup(Request $request)
    {
        $request->validate(['q' => 'required|string|min:1']);
        $q = $request->q;

        // 🆕 [2026-09-21] ค้นด้วย "รหัสลูกค้า" (contact_code เช่น SKR) ได้ด้วย นอกจากเลขที่เอกสาร/ชื่อลูกค้า
        $documents = SaleDocument::with('contact:id,contact_code,business_name')
            ->where('company_id', auth()->user()->company_id)
            ->whereIn('document_type', ['tax_invoice', 'cash', 'receipt'])
            ->where('status', 'Approved')
            ->where(function ($query) use ($q) {
                $query->where('document_number', 'like', "%{$q}%")
                    ->orWhereHas('contact', function ($c) use ($q) {
                        $c->where('business_name', 'like', "%{$q}%")
                            ->orWhere('contact_person_name', 'like', "%{$q}%")
                            ->orWhere('contact_code', 'like', "%{$q}%");
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

    // GET /api/sale-documents/{id}/issuable-items — รายการสินค้าในใบเสนอราคา ($id) ที่ยังเบิกได้ (คำนวณ
    // remaining_quantity = จำนวนในใบเสนอราคา - ผลรวมที่เบิกไปแล้วผ่านใบเบิกสินค้าอื่นที่อ้างอิงแถวนี้ ไม่นับใบเบิกที่
    // ถูกยกเลิก) ใช้เป็น data source ตอนเลือกใบเสนอราคามาสร้างใบเบิกสินค้าใหม่ กันโหลดจำนวนเต็มซ้ำ/เบิกเกิน
    // mirror จาก InstallationRecordController::installableItems() แต่เรียบง่ายกว่า (material_issue ไม่มี logic
    // แยก S/N-based/service เหมือนงานติดตั้ง)
    // 🆕 ?exclude_document_id= — ใช้ตอนเปิดหน้า "แก้ไขใบเบิกสินค้า" ที่อ้างอิงใบเสนอราคานี้อยู่แล้ว: ไม่เช่นนั้น
    // ใบเบิกที่กำลังแก้ไขเองจะถูกนับซ้ำเป็น "เบิกไปแล้ว" ทำให้ remaining_quantity ต่ำกว่าความจริง (แก้เอกสารตัวเอง
    // กลับไม่ได้ถ้าเบิกเต็มโควตาไปแล้ว) — เมื่อระบุพารามิเตอร์นี้ จะไม่กรอง remaining_quantity > 0 ทิ้งด้วย (คืนทุกแถว
    // แม้ remaining = 0) เพื่อให้ฝั่ง frontend สร้างเพดานต่อแถวได้ครบทุกแถว ไม่ใช่แค่แถวที่ยังเหลือ
    public function issuableItems($id, Request $request)
    {
        $companyId = auth()->user()->company_id;

        $quotation = SaleDocument::where('id', $id)
            ->where('company_id', $companyId)
            ->whereIn('document_type', ['quotation', 'custom_quotation'])
            ->first();
        if (!$quotation) return response()->json(['message' => 'ไม่พบใบเสนอราคา'], 404);

        $items = SaleDocumentItem::where('sale_document_id', $quotation->id)
            ->with('product', 'serials')
            ->get();
        if ($items->isEmpty()) return response()->json(['data' => []]);

        $itemIds = $items->pluck('id');
        $issuedQtyByItem = SaleDocumentItem::whereIn('source_item_id', $itemIds)
            ->whereHas('saleDocument', fn ($q) => $q->where('status', '!=', 'Cancelled'))
            ->when($request->filled('exclude_document_id'), fn ($q) =>
                $q->where('sale_document_id', '!=', $request->exclude_document_id))
            ->selectRaw('source_item_id, SUM(quantity) as qty')
            ->groupBy('source_item_id')
            ->pluck('qty', 'source_item_id');

        $result = $items->map(function ($item) use ($issuedQtyByItem) {
            $item->source_item_id = $item->id;
            $item->remaining_quantity = (float) $item->quantity - (float) ($issuedQtyByItem[$item->id] ?? 0);
            return $item;
        });

        if (!$request->filled('exclude_document_id')) {
            $result = $result->filter(fn ($item) => $item->remaining_quantity > 0);
        }

        return response()->json(['data' => $result->values()]);
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
        if (in_array($document->document_type, ['tax_invoice', 'delivery_note', 'cash']) && $document->reference_document_id) {
            $refDoc = SaleDocument::find($document->reference_document_id);
            if ($refDoc && $refDoc->document_type === 'material_issue') $materialIssueLock = $refDoc;
        }

        // 🎗️ เอกสารนี้ล็อกราคาตามใบเสนอราคาหรือไม่ (material_issue เท่านั้น) — ทิศทางเดียวกับ store() ตรวจจาก
        // reference_document_id ที่บันทึกไว้แล้ว (immutable หลังสร้าง เหมือน $materialIssueLock ด้านบน)
        $quotationLock = null;
        if ($document->document_type === 'material_issue' && $document->reference_document_id) {
            $refDoc = SaleDocument::with('items')->find($document->reference_document_id);
            if ($refDoc && $refDoc->document_type === 'quotation') $quotationLock = $refDoc;
        }

        // 🎗️ เอกสารนี้ล็อกรายการตามใบกำกับภาษีหรือไม่ (invoice เท่านั้น) — ทิศทางเดียวกับ store() ตรวจจาก
        // reference_document_id ที่บันทึกไว้แล้ว (immutable หลังสร้าง เหมือน $materialIssueLock ด้านบน)
        $taxInvoiceLock = null;
        if ($document->document_type === 'invoice' && $document->reference_document_id) {
            $refDoc = SaleDocument::with('items')->find($document->reference_document_id);
            if ($refDoc && $refDoc->document_type === 'tax_invoice') $taxInvoiceLock = $refDoc;
        }

        // 🧾 ใบวางบิล/ใบเสร็จรับเงิน อ้างอิงใบกำกับภาษีที่อนุมัติแล้วได้หลายใบแทนการกรอกรายการสินค้าเอง (เหมือน store())
        $hasInvoiceRefs = in_array($document->document_type, ['billing_invoice', 'receipt'])
            && is_array($request->invoice_refs) && count($request->invoice_refs) > 0;

        // 🛡️ เพิ่ม validation ที่ขาดหายไป — เดิม update() ไม่ตรวจสอบอะไรเลย รับค่าจาก request ตรงๆ ทุกฟิลด์
        $request->validate([
            // 🎗️ ใบยืมสินค้า/ใบคืนสินค้ายืมไม่บังคับผูกกับลูกค้าในระบบ (เหมือน store()) — ประเภทอื่นยังบังคับเหมือนเดิม
            // 🛡️ [2026-09-24] exists กรอง company_id เหมือน store()
            'contact_id' => in_array($document->document_type, ['loan_issue', 'loan_return'])
                ? ['sometimes', 'nullable', Rule::exists('contacts', 'id')->where('company_id', auth()->user()->company_id)]
                : ['sometimes', Rule::exists('contacts', 'id')->where('company_id', auth()->user()->company_id)],
            'borrower_name' => 'nullable|string|max:255',
            'borrower_phone' => 'nullable|string|max:50',
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->where('company_id', auth()->user()->company_id)],
            'rental_job_id' => ['nullable', 'integer', Rule::exists('rental_jobs', 'id')->where('company_id', auth()->user()->company_id)],
            'warehouse_id' => [
                in_array($document->document_type, ['material_issue', 'installation_issue']) ? 'required' : 'nullable',
                Rule::exists('warehouses', 'id')->where('company_id', auth()->user()->company_id),
            ],
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
            'show_serials' => 'nullable|boolean',
            'items' => 'sometimes|array|min:1',
            'items.*.product_id' => $isBorrowIn ? 'nullable' : ['required_with:items', Rule::exists('products', 'id')->where('company_id', auth()->user()->company_id)],
            'items.*.quantity' => 'required_with:items|numeric|min:0.1',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
            'items.*.cost_price' => 'nullable|numeric|min:0',
            'items.*.serials' => 'nullable|array',
            'items.*.serials.*' => 'string|exists:product_serials,serial_number',
            'items.*.item_name' => 'nullable|string|max:255',
            'items.*.parent_index' => 'nullable|integer|min:0',
            // 🎯 ใบเบิกสินค้าที่โหลดมาจากใบเสนอราคา — ชี้กลับไปยัง id ของแถวต้นทางในใบเสนอราคา (ข้ามเอกสาร ใช้คำนวณ
            // จำนวนคงเหลือที่ยังเบิกได้ ดู SaleDocumentController::issuableItems())
            'items.*.source_item_id' => 'nullable|integer|exists:sale_document_items,id',
            // 🆕 [2026-09-19] id แถวเดิม — ใช้จับคู่ตอนแก้ไขใบกำกับภาษีหลังอนุมัติ (แก้ราคา/ส่วนลดในแถวเดิม ไม่ลบสร้างใหม่)
            'items.*.item_id' => 'nullable|integer',
            // 🧾 ใบวางบิล/ใบเสร็จรับเงิน — รายการใบกำกับภาษีที่อ้างอิง (many-to-many)
            'invoice_refs' => 'nullable|array',
            'invoice_refs.*.tax_invoice_id' => 'required_with:invoice_refs|integer',
            'invoice_refs.*.payment_amount' => 'nullable|numeric|min:0',
            'invoice_refs.*.outstanding_amount' => 'nullable|numeric|min:0',
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

        // 🛡️ ใบเสร็จรับเงินต้องอ้างอิงใบกำกับภาษีที่อนุมัติแล้วผ่าน invoice_refs เท่านั้นเสมอ (เหมือน store())
        if ($document->document_type === 'receipt' && !$hasInvoiceRefs) {
            return response()->json(['message' => 'ต้องเลือกใบกำกับภาษีที่อนุมัติแล้วอย่างน้อย 1 ใบ'], 422);
        }

        // 🐛 [2026-09-24] ยอดชำระต้องไม่เกินยอดค้างชำระของใบกำกับภาษีที่อ้างอิง (เหมือน store())
        if ($document->document_type === 'receipt' && $hasInvoiceRefs && ($err = $this->receiptOverpaymentError($request->invoice_refs, $document->id))) {
            return response()->json(['message' => $err, 'errors' => ['invoice_refs' => [$err]]], 422);
        }

        // 🐛 [2026-09-24] ใบคืนสินค้ายืม/เช่า: จำนวนคืนต้องไม่เกินที่ยืม/เบิกไป (เหมือน store()) ตรวจเมื่อมีการส่ง items มาแก้ไข
        if ($request->has('items') && ($err = $this->returnQuantityError($document->document_type, $document->reference_document_id, $request->items, $document->id))) {
            return response()->json(['message' => $err, 'errors' => ['items' => [$err]]], 422);
        }

        // 🆕 [2026-09-19] ใบกำกับภาษีที่อนุมัติแล้วแก้ไขได้ (ไม่ต้อง revise) — เฉพาะข้อมูลหัวเอกสาร + ราคา/ส่วนลดรายแถว
        // รายการสินค้า/จำนวน/S-N ผูกกับสต๊อก งานติดตั้ง (sale_document_item_id) จึงห้ามลบสร้างใหม่ ต้องแก้ในแถวเดิมเท่านั้น
        $isPostApprovalEdit = $document->document_type === 'tax_invoice' && $document->status === 'Approved';
        if ($isPostApprovalEdit && \App\Models\InstallationDocument::where('sale_document_id', $document->id)->exists()) {
            $changesOwner = ($request->has('project_id') && (int) $request->project_id !== (int) $document->project_id)
                || ($request->has('contact_id') && (int) $request->contact_id !== (int) $document->contact_id);
            if ($changesOwner) {
                return response()->json(['message' => 'ใบกำกับภาษีนี้มีงานติดตั้งอ้างอิงอยู่แล้ว ไม่สามารถเปลี่ยนลูกค้า/โครงการได้'], 422);
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
            if ($document->status !== 'Pending' && !$isPostApprovalEdit) {
                DB::rollBack();
                return response()->json(['message' => 'ไม่สามารถแก้ไขเอกสารที่ยืนยันหรือดำเนินการไปแล้วได้'], 400);
            }

            // 🐛 [2026-09-24] ใบกำกับภาษีที่อนุมัติแล้วห้ามเปลี่ยนวันที่ออกเอกสาร — วันที่นี้กำหนดงวดภาษีมูลค่าเพิ่ม/วันครบกำหนด
            // (เดิมแก้ได้อิสระ ย้ายใบกำกับข้ามงวดที่ยื่นแบบไปแล้วได้ และข้ามการล็อกวันยื่นใน cancel() เพราะ due_date ไม่ถูกคำนวณใหม่)
            // ถ้าวันที่ผิดต้องยกเลิกแล้วออกใบใหม่ (ยังยกเลิกได้ตามเงื่อนไขวันยื่นภาษีเดิม)
            if ($isPostApprovalEdit && $request->filled('issue_date')
                && \Carbon\Carbon::parse($request->issue_date)->toDateString() !== \Carbon\Carbon::parse($document->issue_date)->toDateString()) {
                DB::rollBack();
                return response()->json([
                    'message' => 'ใบกำกับภาษีที่อนุมัติแล้วไม่สามารถเปลี่ยนวันที่ออกเอกสารได้ (กระทบงวดภาษีมูลค่าเพิ่ม) หากวันที่ผิดให้ยกเลิกแล้วออกใบใหม่',
                    'errors' => ['issue_date' => ['ไม่สามารถเปลี่ยนวันที่ของใบกำกับภาษีที่อนุมัติแล้วได้']],
                ], 422);
            }

            // 🐛 [2026-09-24] ใบกำกับภาษีที่อนุมัติแล้วตัดสต๊อกจากคลังใดคลังหนึ่งไปแล้ว ห้ามเปลี่ยนคลัง — เดิมแก้ได้ ทำให้ตอนยกเลิกคืนสต๊อกผิดคลัง
            // (คลังที่ตัดจริงกับคลังที่เอกสารบอกไม่ตรงกัน) เทียบด้วยคลังที่ resolve แล้ว (ค่าว่างใช้คลังหลักเหมือนตอนอนุมัติ)
            if ($isPostApprovalEdit && $request->filled('warehouse_id')
                && Warehouse::resolveFor($document->company_id, $request->warehouse_id) !== Warehouse::resolveFor($document->company_id, $document->warehouse_id)) {
                DB::rollBack();
                return response()->json([
                    'message' => 'ใบกำกับภาษีที่อนุมัติแล้วไม่สามารถเปลี่ยนคลังสินค้าได้ (ตัดสต๊อกจากคลังเดิมไปแล้ว)',
                    'errors' => ['warehouse_id' => ['ไม่สามารถเปลี่ยนคลังของใบกำกับภาษีที่อนุมัติแล้วได้']],
                ], 422);
            }

            $document->update($request->only([
                'contact_id', 'project_id', 'rental_job_id', 'warehouse_id', 'reference_number',
                'transportation', 'saleman_code', 'payment_method',
                'issue_date', 'credit_days', 'currency', 'tax_type', 'note',
                'discount_amount', 'deposit_amount', 'vat_amount', 'wht_amount',
                'custom_logo_path', 'custom_company_name', 'custom_company_address', 'custom_quoter_name',
                'borrower_name', 'borrower_phone', 'show_serials',
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
                        'outstanding_amount' => $document->document_type === 'receipt' && isset($refRow['outstanding_amount']) && $refRow['outstanding_amount'] !== '' ? (float) $refRow['outstanding_amount'] : null,
                    ]);
                }
                $document->update(['subtotal' => $subtotal, 'discount_amount' => 0, 'vat_amount' => 0, 'wht_amount' => 0]);
            }

            // อัปเดตรายการสินค้าแบบลบสร้างใหม่ (Cleanest way)
            // 🎗️ เอกสารที่ล็อกรายการตามใบเบิกสินค้า (material_issue) หรือใบกำกับภาษี (tax_invoice) ห้ามแก้ items เด็ดขาด —
            // เมิน items ที่ client ส่งมาแบบเงียบๆ (ตั้งใจ ไม่ error เพื่อไม่ให้ frontend ที่ยังส่ง items เดิมมาแสดงผลด้วยต้อง error โดยไม่จำเป็น)
            // (ตั้งใจให้แก้ราคาได้แม้เอกสารล็อกรายการตามใบเบิกสินค้า — ผู้ใช้ยืนยันให้แก้ราคา/ส่วนลดรายแถวหลังอนุมัติได้ ราคาไม่กระทบสต๊อก)
            if ($isPostApprovalEdit && $request->has('items')) {
                $existingItems = $document->items()->get()->keyBy('id');
                $incoming = collect($request->items);
                $incomingIds = $incoming->pluck('item_id')->filter()->unique();
                if ($incoming->count() !== $existingItems->count() || $incomingIds->count() !== $existingItems->count()) {
                    DB::rollBack();
                    return response()->json(['message' => 'ใบกำกับภาษีที่อนุมัติแล้วไม่สามารถเพิ่ม/ลบรายการสินค้าได้ (แก้ได้เฉพาะราคา/ส่วนลด)'], 422);
                }

                $subtotal = 0;
                foreach ($incoming as $item) {
                    $row = $existingItems->get($item['item_id'] ?? null);
                    if (!$row
                        || (int) $row->product_id !== (int) ($item['product_id'] ?? 0)
                        || abs((float) $row->quantity - (float) $item['quantity']) > 0.0001) {
                        DB::rollBack();
                        return response()->json(['message' => 'ใบกำกับภาษีที่อนุมัติแล้วไม่สามารถเปลี่ยนสินค้า/จำนวนได้ (แก้ได้เฉพาะราคา/ส่วนลด)'], 422);
                    }
                    // แถวลูกของสินค้าชุด (Bundle) ไม่มีราคาของตัวเอง — ไม่แตะ
                    if ($row->parent_item_id) continue;

                    $unitPrice = (float) $item['unit_price'];
                    $itemDiscount = (float) ($item['discount_amount'] ?? 0);
                    $netItemPrice = (float) $row->quantity * $unitPrice - $itemDiscount;
                    $row->update([
                        'item_name' => $item['item_name'] ?? $row->item_name,
                        'unit_price' => $unitPrice,
                        'discount_percent' => $item['discount_percent'] ?? null,
                        'discount_amount' => $itemDiscount,
                        'tax_rate' => $item['tax_rate'] ?? 0,
                        'tax_amount' => $item['tax_amount'] ?? 0,
                        'wht_rate' => $item['wht_rate'] ?? null,
                        'wht_amount' => $item['wht_amount'] ?? 0,
                        'total_price' => $netItemPrice,
                    ]);
                    $subtotal += $netItemPrice;
                }
                $document->update(['subtotal' => $subtotal]);
            } elseif ($request->has('items') && !$materialIssueLock && !$taxInvoiceLock && !$hasInvoiceRefs && !$isPostApprovalEdit) {
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

                // 🎗️ ใบเบิกสินค้าที่อ้างอิงใบเสนอราคา — จับคู่แถวกับใบเสนอราคาต้นทางผ่าน source_item_id เพื่อล็อกราคา (ดู store())
                $quotationItemsById = $quotationLock ? $quotationLock->items->keyBy('id') : collect();

                // 2-pass เช่นเดียวกับ store() เพื่อรองรับแถวลูก/ส่วนประกอบสินค้าชุดที่ต้องอ้างอิง ID ของแถวแม่ที่เพิ่งสร้าง
                $createdItems = [];
                foreach ($request->items as $index => $item) {
                    $isBundleChild = isset($item['parent_index']);

                    $sourceQuotationItem = null;
                    if ($quotationLock && !$isBundleChild) {
                        $sourceQuotationItem = !empty($item['source_item_id']) ? $quotationItemsById->get($item['source_item_id']) : null;
                        if (!$sourceQuotationItem) {
                            DB::rollBack();
                            return response()->json(['message' => 'พบรายการสินค้าที่ไม่ตรงกับใบเสนอราคาต้นทาง กรุณาโหลดข้อมูลจากใบเสนอราคาใหม่อีกครั้ง'], 422);
                        }
                    }

                    if ($sourceQuotationItem) {
                        $ratio = ((float) $sourceQuotationItem->quantity) > 0 ? ($item['quantity'] / (float) $sourceQuotationItem->quantity) : 1;
                        $unitPrice = (float) $sourceQuotationItem->unit_price;
                        $discountPercent = $sourceQuotationItem->discount_percent;
                        $itemDiscount = (float) $sourceQuotationItem->discount_amount * $ratio;
                        $taxRate = $sourceQuotationItem->tax_rate;
                        $taxAmount = (float) $sourceQuotationItem->tax_amount * $ratio;
                        $whtRate = $sourceQuotationItem->wht_rate;
                        $whtAmount = (float) $sourceQuotationItem->wht_amount * $ratio;
                    } else {
                        $unitPrice = $isBundleChild ? 0 : $item['unit_price'];
                        $discountPercent = $isBundleChild ? null : ($item['discount_percent'] ?? null);
                        $itemDiscount = $isBundleChild ? 0 : ($item['discount_amount'] ?? 0);
                        $taxRate = $isBundleChild ? 0 : ($item['tax_rate'] ?? 0);
                        $taxAmount = $isBundleChild ? 0 : ($item['tax_amount'] ?? 0);
                        $whtRate = $isBundleChild ? null : ($item['wht_rate'] ?? null);
                        $whtAmount = $isBundleChild ? 0 : ($item['wht_amount'] ?? 0);
                    }
                    $costPrice = $isBundleChild ? 0 : ($item['cost_price'] ?? null);
                    $totalPrice = $item['quantity'] * $unitPrice;
                    $netItemPrice = $totalPrice - $itemDiscount;
                    $subtotal += $netItemPrice;

                    $newItem = $document->items()->create([
                        'product_id' => $item['product_id'] ?? null,
                        'item_name' => $item['item_name'] ?? null,
                        'source_item_id' => $document->document_type === 'material_issue' ? ($item['source_item_id'] ?? null) : null,
                        'quantity' => $item['quantity'],
                        'unit_name' => $item['unit_name'] ?? 'ชิ้น',
                        'unit_price' => $unitPrice,
                        'cost_price' => $costPrice,
                        'discount_percent' => $discountPercent,
                        'discount_amount' => $itemDiscount,
                        'tax_rate' => $taxRate,
                        'tax_amount' => $taxAmount,
                        'wht_rate' => $whtRate,
                        'wht_amount' => $whtAmount,
                        'total_price' => $netItemPrice,
                    ]);
                    $createdItems[$index] = $newItem;

                    // 📝 ใบเสนอราคา/ใบวางบิล/ใบลดหนี้ ไม่ตัดสต๊อกหรือยึด S/N จริง — ไม่บังคับเลือก S/N ตอนแก้ไข
                    // 🆕 ใบเบิกสินค้า (material_issue) บังคับเลือก S/N ตอนแก้ไขเช่นกัน (ดู store() สำหรับเหตุผลเต็ม)
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

            // 🆕 ห้ามแก้ให้ยอดรวมต่ำกว่ายอดที่ใบเสร็จ (Approved) ที่อ้างอิงใบกำกับภาษีนี้รับชำระไปแล้ว (คิดแบบเดียวกับ outstandingBalances())
            if ($isPostApprovalEdit) {
                $paid = (float) SaleDocumentInvoiceRef::where('tax_invoice_id', $document->id)
                    ->whereHas('saleDocument', fn ($q) => $q->where('document_type', 'receipt')->where('status', 'Approved'))
                    ->sum('payment_amount');
                if ($grandTotal + 0.005 < $paid) {
                    DB::rollBack();
                    return response()->json([
                        'message' => 'ยอดรวมใหม่ (' . number_format($grandTotal, 2) . ') ต่ำกว่ายอดที่รับชำระแล้ว (' . number_format($paid, 2) . ') ไม่สามารถบันทึกได้',
                    ], 422);
                }
            }

            DB::commit();
            return response()->json(['message' => 'อัปเดตเอกสารสำเร็จ', 'data' => $document]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], $e instanceof \DomainException ? 422 : 500);
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

            // 🐛 [2026-09-24] เอกสารภาษี/การเงินที่เคยอนุมัติ (มีเลขที่ออกไปแล้ว) ห้ามลบแม้ยกเลิกแล้ว — เลขที่ใบกำกับภาษี/ใบเสร็จ/ใบลดหนี้ ฯลฯ
            // ต้องต่อเนื่องและตรวจสอบย้อนหลังได้ (เดิมยกเลิกแล้วลบทิ้งได้ เลขขาดช่วง + รายการสินค้าถูกลบถาวร) ให้คงไว้เป็นสถานะ "ยกเลิก"
            if (!empty($document->approved_at)
                && in_array($document->document_type, ['tax_invoice', 'receipt', 'credit_note', 'debit_note', 'cash', 'custom_cash'])) {
                return response()->json(['message' => 'ไม่สามารถลบเอกสารภาษี/การเงินที่เคยอนุมัติแล้วได้ (เลขที่เอกสารต้องต่อเนื่อง) ให้คงไว้เป็นสถานะยกเลิก'], 400);
            }

            DB::beginTransaction();
            $document->items()->delete(); // ลบ items ออกก่อน
            $document->delete(); // Soft delete
            DB::commit();

            return response()->json(['message' => 'ลบเอกสารเรียบร้อยแล้ว']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาดในการลบ: ' . $e->getMessage()], $e instanceof \DomainException ? 422 : 500);
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
            // 🐛 [2026-09-24] เช็คสถานะ Pending จากแถวที่ "ล็อกแล้วในทรานแซกชัน" (เดิมเช็คจากตัวแปรที่อ่านไว้ก่อนเปิดทรานแซกชัน
            // ไม่ล็อก → กดอนุมัติซ้ำ/พร้อมกันผ่านทั้งคู่แล้วตัดสต๊อก/จองซ้ำได้) และเมื่อไม่ใช่ Pending ต้อง rollBack ก่อน return
            // (เดิม return ทิ้งทรานแซกชันที่เปิดค้างไว้ ไม่ปิด)
            $currentStatus = SaleDocument::where('id', $doc->id)->lockForUpdate()->value('status');
            if ($currentStatus !== 'Pending') {
                DB::rollBack();
                return response()->json(['message' => 'เอกสารนี้ถูกดำเนินการไปแล้ว'], 400);
            }

            // 🐛 [2026-09-24] ใบเสร็จ: ตอนอนุมัติต้องเช็คยอดชำระไม่เกินยอดค้างอีกรอบ (ใบเสร็จ 2 ใบที่สร้างไว้ก่อน จ่ายเต็มยอดทั้งคู่
            // ผ่านตอนสร้างได้ เพราะยอดค้างคิดเฉพาะใบเสร็จที่ Approved) ล็อกแถวใบกำกับภาษีไว้กันอนุมัติพร้อมกัน
            if ($doc->document_type === 'receipt') {
                $overpay = $this->receiptOverpaymentError($doc->invoiceRefs()->get(), $doc->id, true);
                if ($overpay) {
                    DB::rollBack();
                    return response()->json(['message' => $overpay], 422);
                }
            }

            // 🐛 [2026-09-24] ใบคืนสินค้ายืม/เช่า: เช็คจำนวนคืนรวมทุกใบที่ไม่ยกเลิกไม่เกินที่ยืม/เบิกไปอีกรอบตอนอนุมัติ
            // (กันสร้าง Pending ซ้อนกันหลายใบแล้วอนุมัติทีละใบ) ล็อกแถวเอกสารต้นทางไว้กันอนุมัติพร้อมกัน
            if (in_array($doc->document_type, ['loan_return', 'rental_stock_return']) && $doc->reference_document_id) {
                SaleDocument::where('id', $doc->reference_document_id)->lockForUpdate()->first();
                $returnErr = $this->returnQuantityError($doc->document_type, $doc->reference_document_id, $doc->items, $doc->id);
                if ($returnErr) {
                    DB::rollBack();
                    return response()->json(['message' => $returnErr], 422);
                }
            }

            // อัปเดตสถานะ
            $doc->update([
                'status' => 'Approved',
                'approved_by' => auth()->id(),
                'approved_at' => now()
            ]);

            // 📦 ลอจิกสต๊อก:
            // - ขายเงินสด, ใบเสร็จ -> ตัดสต๊อกออกจริง (Out)
            // - ใบกำกับภาษี ที่ไม่ได้อ้างอิงใบเบิกสินค้า (material_issue) -> ตัดสต๊อกออกจริงทันที (เส้นทางเดิม สร้างจากใบเสนอราคาตรงๆ)
            // - ใบกำกับภาษี ที่อ้างอิงใบเบิกสินค้า (material_issue) ที่อนุมัติแล้ว -> "ปลดจอง + ตัดจริง" รวมกันในทีเดียว (แยก branch ด้านล่าง สำคัญ: ต้องเช็คก่อน $stockOutTypes)
            // - ใบเบิกสินค้า(โครงการ)/ใบเบิกสินค้า(งานเช่า)/ใบยืมสินค้า -> "จอง" เท่านั้น (reserved_qty เพิ่ม, qty ไม่ลด) ของยังอยู่ในคลังจริงแค่ถูกล็อกไว้ไม่ให้งานอื่นเบิกซ้ำ
            //   (material_issue เปลี่ยนพฤติกรรมจากตัดสต๊อกจริงทันที มาเป็นจองแบบนี้ — ของจริงจะถูกตัดตอนอนุมัติใบกำกับภาษี/บิลเงินสดที่อ้างอิงแทน กันตัดสต๊อกซ้ำ 2 ครั้ง)
            // - ใบคืนสินค้า(งานเช่า) -> ปลดล็อก (reserved_qty ลด) ของไม่เคยออกจาก qty จริงจึงไม่ต้องเพิ่มคืน ต้องเช็คอ้างอิงกับใบเบิกต้นทาง (แยก branch ด้านล่าง)
            // - ใบลดหนี้ -> ไม่กระทบสต๊อกโดยตรงอีกต่อไป (เดิมเคยเพิ่มสต๊อกกลับอัตโนมัติแบบไม่ระบุ S/N) — ของจริงจะกลับเข้าคลัง
            //   ก็ต่อเมื่อมี "ใบคืนสินค้า" ที่อ้างอิงใบลดหนี้นี้มายืนยันอีกที (กันสต๊อกถูกเพิ่มซ้ำ 2 ครั้ง)
            // 🆕 [2026-09-23] ใบส่งสินค้า (delivery_note) ไม่ตัด/จอง/ปลดจองสต๊อกอีกต่อไป (ตามที่ผู้ใช้ยืนยัน) — เป็นแค่
            // เอกสารบันทึก/พิมพ์อ้างอิงใบเบิกสินค้าเฉยๆ ไม่กระทบสต๊อกจริงเลย จุดตัดสต๊อกจริงจากใบเบิกสินค้ามีจุดเดียวคือ
            // ใบกำกับภาษี/บิลเงินสด (เดิม delivery_note เคย "ปลดจอง+ตัดจริง" เหมือนใบกำกับภาษีทุกประการ ทำให้ถ้าเลือก
            // ใบเบิกสินค้าเดียวกันไปสร้างทั้งใบส่งสินค้าและใบกำกับภาษี ใบที่อนุมัติทีหลังจะชนกับ S/N ที่ถูกใบแรกเปลี่ยนเป็น
            // 'sold' ไปแล้ว) — ดูเงื่อนไขยกเว้น document_type !== 'delivery_note' ใน $materialIssueRefs branch ด้านล่าง
            // - ใบเสนอราคา, ใบวางบิล, ใบเพิ่มหนี้, ใบส่งสินค้า -> ไม่กระทบสต๊อก
            // 🆕 'cash' ตัดออกจากลิสต์นี้แล้ว — ตอนนี้บิลเงินสดต้องอ้างอิงใบเบิกสินค้าที่อนุมัติแล้วเสมอ จึงตัดสต๊อกผ่าน
            // $materialIssueRef branch ด้านล่างแทน (ปลดจอง+ตัดจริงพร้อมกัน เหมือน tax_invoice)
            // 🆕 [2026-09-17] 'installation_issue' (ใบเบิกวัสดุ/บริการสำหรับงานติดตั้ง) เข้ากลุ่มนี้ด้วย — ผู้ใช้ยืนยัน
            // ให้ตัดสต๊อกจริงทันทีหลังอนุมัติ ต่างจาก material_issue ปกติที่แค่ "จอง" (ไม่มีเอกสารขายอื่นมาอ้างอิง
            // ตัดจริงซ้ำภายหลังเหมือน material_issue เพราะนี่คือการใช้ของจริงในโครงการ ไม่ใช่การจองรอส่งลูกค้า)
            $stockOutTypes = ['custom_cash', 'receipt', 'installation_issue'];
            $warehouseId = Warehouse::resolveFor($doc->company_id, $doc->warehouse_id);
            $warehouse = Warehouse::find($warehouseId);

            // 🎗️ "ยืมของจากลูกค้า" (borrow_in) — ของไม่ใช่ของเรา ไม่กระทบสต๊อก/S/N ของเราเลย แค่บันทึกสถานะเอกสารไว้เฉยๆ
            $isBorrowInLoan = $doc->document_type === 'loan_issue' && $doc->loan_direction === 'borrow_in';
            $isBorrowInReturn = $doc->document_type === 'loan_return' && ($doc->referencedDocument->loan_direction ?? null) === 'borrow_in';

            // 🎗️ ใบกำกับภาษี/ใบส่งสินค้า/บิลเงินสด ที่อ้างอิงใบเบิกสินค้า (material_issue) — หา material_issue ต้นทางไว้ล่วงหน้า
            // (เช็คสถานะ/ใช้ตัดสต๊อกจริงในเวลาเดียวกับปลดจอง แทนที่การตัดสต๊อกจะเกิดตอนอนุมัติใบเบิกเหมือนเดิม)
            // 🆕 ใบกำกับภาษีอาจอ้างอิงใบเบิกได้หลายใบ (resolveMaterialIssueRefs คืนทั้งหมด) — logic ปลดจอง/ตัดสต๊อก
            // ด้านล่างวนตาม $doc->items (แถวที่ถูกรวมมาแล้วตอน store()) จึงไม่ต้องแก้อะไรเพิ่มเลย นอกจากข้อความ note
            $materialIssueRefs = $this->resolveMaterialIssueRefs($doc);
            $materialIssueRef = $materialIssueRefs->first();

            // 🆕 [2026-09-23] delivery_note ยกเว้นออกจาก branch นี้เสมอ — ไม่ตัด/จอง/ปลดจองสต๊อกอีกต่อไป (ดูคอมเมนต์ยาวด้านบน)
            if ($materialIssueRefs->isNotEmpty() && $doc->document_type !== 'delivery_note') {
                // 🛡️ material_issue อาจถูกยกเลิกไปแล้วหลังจากสร้างเอกสารนี้ (เอกสารนี้ยังค้างเป็น Pending อยู่) — กันปลดจอง/ตัดสต๊อกโดยไม่มีจองจริงอยู่
                $notApprovedRef = $materialIssueRefs->first(fn ($m) => $m->status !== 'Approved');
                if ($notApprovedRef) {
                    throw new \DomainException("ใบเบิกสินค้าต้นทาง ({$notApprovedRef->document_number}) ไม่ได้อยู่ในสถานะอนุมัติแล้ว ไม่สามารถอนุมัติเอกสารนี้ต่อได้");
                }
                // 🐛 [2026-09-24] ใบเบิก 1 ใบตัดสต๊อกจริงได้ครั้งเดียว — ถ้ามีใบกำกับภาษี/บิลเงินสดอื่นที่ยังไม่ยกเลิกบนใบเบิกเดียวกันอยู่แล้ว
                // (เช่น Pending 2 ใบที่สร้างไว้ก่อนมีการกันตอนสร้าง) ต้องไม่อนุมัติใบนี้ซ้ำ ล็อกแถวใบเบิกไว้กันอนุมัติพร้อมกัน
                if (in_array($doc->document_type, ['tax_invoice', 'cash'])) {
                    SaleDocument::whereIn('id', $materialIssueRefs->pluck('id'))->lockForUpdate()->get();
                    $duplicateInvoice = $this->materialIssueAlreadyInvoicedError($materialIssueRefs->pluck('id'), $doc->id, true);
                    if ($duplicateInvoice) {
                        DB::rollBack();
                        return response()->json(['message' => $duplicateInvoice], 422);
                    }
                }
                $materialIssueNumbers = $materialIssueRefs->pluck('document_number')->implode(', ');
                foreach ($doc->items as $item) {
                    if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

                    $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                    if ($balance->qty < $item->quantity) {
                        throw new \DomainException("สินค้า {$item->product->name} มีสต็อกไม่พอ (คงเหลือ {$balance->qty}, ต้องการ {$item->quantity})");
                    }
                    $balance->reserved_qty = max(0, $balance->reserved_qty - $item->quantity); // ปลดจองที่ material_issue จองไว้
                    $balance->qty -= $item->quantity; // ตัดสต๊อกจริง ณ จุดนี้
                    $balance->save();

                    $movement = \App\Models\StockMovement::create([
                        'product_id' => $item->product_id,
                        'type' => 'out',
                        'quantity' => $item->quantity,
                        'reference_number' => $doc->document_number,
                        'note' => "ตัดสต๊อกจริงจากใบเบิก {$materialIssueNumbers} (อ้างอิงผ่าน {$doc->document_number})",
                        'user_id' => auth()->id(),
                        'warehouse_id' => $warehouseId,
                        'company_id' => $doc->company_id
                    ]);

                    if ($item->serials->isNotEmpty()) {
                        $serialIds = $item->serials->pluck('id');
                        $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

                        // 🆕 S/N ของใบส่งสินค้า/ใบกำกับภาษีที่อ้างอิงใบเบิกสินค้า สืบทอดมาจากใบเบิกสินค้าต้นทางโดยตรง
                        // (เลือกไว้ตั้งแต่ตอนสร้าง/แก้ไขใบเบิกสินค้าแล้ว) — ตอนใบเบิกอนุมัติ S/N เหล่านี้ถูกเปลี่ยนเป็น
                        // 'rented' ไปแล้ว (กันเอกสารอื่นแย่งเลือกซ้ำ — ดู approve() branch stock_issue/loan_issue/
                        // material_issue) จึงต้องยังอยู่ในสถานะ 'rented' ตรงนี้ ไม่ใช่ 'available' เหมือนเอกสารขายทั่วไป
                        $notReserved = $lockedSerials->where('status', '!=', 'rented')->first();
                        if ($notReserved) {
                            throw new \DomainException("S/N {$notReserved->serial_number} ไม่ได้อยู่ในสถานะที่จองไว้จากใบเบิกสินค้าแล้ว (อาจถูกคืน/ใช้ไปในเอกสารอื่น) กรุณาตรวจสอบใบเบิกสินค้าต้นทาง");
                        }

                        ProductSerial::whereIn('id', $serialIds)->update([
                            'status' => 'sold',
                            'stock_movement_id' => $movement->id,
                            'sold_at' => now(),
                            'sold_to_sale_document_id' => $doc->id,
                        ]);
                    }

                    // 🆕 ตัดล็อตต้นทุน FIFO จริง — ของออกจากคลังจริง ณ จุดนี้ (ตัดสต๊อกจริงพร้อมปลดจอง)
                    $this->applyFifoCost($item, $doc, $warehouseId, $movement);
                }
            } elseif (in_array($doc->document_type, $stockOutTypes)) {
                foreach ($doc->items as $item) {
                    // 📦 แถวแม่สินค้าชุด (Bundle) ไม่มีสต๊อกของตัวเอง — ข้ามไปเลย ส่วนประกอบจริงมาเป็นแถวลูก
                    // (parent_item_id ชี้มาที่แถวนี้) ซึ่งเป็นแถว product_id ปกติ ไหลผ่าน logic ด้านล่างตามปกติอยู่แล้ว
                    if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

                    // 🛡️ ล็อกแถวยอดคงเหลือก่อนเช็ค/ตัดสต๊อกจริง — จุดนี้เป็นจุดเดียวที่ authoritative
                    // (เดิม approve()/cancel() ไม่เคยแตะ StockBalance เลย สร้างแค่ StockMovement log)
                    $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                    // 🐛 [2026-09-24] เอกสารกลุ่มนี้ไม่มีใบเบิกจองไว้ให้ ต้องเช็คเฉพาะยอดที่ "ไม่ถูกจอง" (qty - reserved_qty) — เดิมเช็ค qty รวม
                    // ตัดของที่ใบเบิกอื่นจองไว้ไปได้ แล้วเหลือ qty < reserved_qty
                    $availableQty = (float) $balance->qty - (float) $balance->reserved_qty;
                    if ($availableQty < (float) $item->quantity) {
                        throw new \DomainException("สินค้า {$item->product->name} มีสต็อกไม่พอ (คงเหลือที่ไม่ถูกจอง {$availableQty}, ต้องการ {$item->quantity})");
                    }
                    $balance->qty -= $item->quantity;
                    $balance->save();

                    $movement = \App\Models\StockMovement::create([
                        'product_id' => $item->product_id,
                        'type' => 'out',
                        'quantity' => $item->quantity,
                        'reference_number' => $doc->document_number,
                        'note' => $doc->document_type === 'installation_issue'
                            ? 'ตัดสต๊อกเบิกใช้งานติดตั้ง (อนุมัติเอกสาร ' . $doc->document_number . ')'
                            : 'ตัดสต๊อกจากการขาย (อนุมัติบิล ' . $doc->document_number . ')',
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
                            throw new \DomainException("S/N {$notAvailable->serial_number} ไม่พร้อมขายแล้ว (ถูกขาย/ใช้ไปในเอกสารอื่น) กรุณาแก้ไขเอกสารและเลือก S/N ใหม่");
                        }

                        ProductSerial::whereIn('id', $serialIds)->update([
                            'status' => 'sold',
                            'stock_movement_id' => $movement->id,
                            'sold_at' => now(),
                            'sold_to_sale_document_id' => $doc->id,
                        ]);
                    }

                    // 🆕 ตัดล็อตต้นทุน FIFO จริง — ของออกจากคลังจริง ณ จุดนี้
                    $this->applyFifoCost($item, $doc, $warehouseId, $movement);
                }
            } elseif (in_array($doc->document_type, ['stock_issue', 'loan_issue', 'material_issue']) && !$isBorrowInLoan) {
                // 🎪 เบิกสินค้า(โครงการ)/เบิกสินค้า(งานเช่า)/ยืมสินค้า = "จอง" เท่านั้น ไม่ตัด qty จริง — ของยังอยู่ในคลังแต่ล็อกไว้ไม่ให้งานอื่นเบิกซ้ำ
                // ไม่สร้าง StockMovement (ไม่ใช่การเคลื่อนไหวสต๊อกทางกายภาพจริง — เอกสารนี้เองเป็น audit trail อยู่แล้ว)
                foreach ($doc->items as $item) {
                    if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

                    $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                    $availableQty = $balance->qty - $balance->reserved_qty;
                    if ($availableQty < $item->quantity) {
                        throw new \DomainException("สินค้า {$item->product->name} ในคลัง{$warehouse?->name} มีสต็อกพร้อมเบิกไม่พอ (พร้อมใช้จริง {$availableQty} ชิ้น, ต้องการ {$item->quantity} ชิ้น)");
                    }
                    $balance->reserved_qty += $item->quantity;
                    $balance->save();

                    if ($item->serials->isNotEmpty()) {
                        $serialIds = $item->serials->pluck('id');
                        $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

                        $notAvailable = $lockedSerials->where('status', '!=', 'available')->first();
                        if ($notAvailable) {
                            throw new \DomainException("S/N {$notAvailable->serial_number} ไม่พร้อมเบิกแล้ว (ถูกใช้ไปในเอกสารอื่น) กรุณาแก้ไขเอกสารและเลือก S/N ใหม่");
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
                        if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

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

                        // ต้องยังอยู่ในสถานะ 'sold' และขายออกมาจากใบกำกับภาษีต้นทางของใบลดหนี้ที่อ้างอิงเท่านั้น (กันคืนผิดใบ/คืนซ้ำ)
                        $expectedTaxInvoiceId = $doc->referencedDocument->reference_document_id;

                        if ($item->serials->isNotEmpty()) {
                            $serialIds = $item->serials->pluck('id');
                            $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

                            $invalid = $lockedSerials->first(fn ($s) => $s->status !== 'sold' || (int) $s->sold_to_sale_document_id !== (int) $expectedTaxInvoiceId);
                            if ($invalid) {
                                throw new \DomainException("S/N {$invalid->serial_number} ไม่ได้อยู่ในสถานะขายออกจากใบกำกับภาษีต้นทาง (อาจถูกคืนไปแล้วหรือเลือกผิดรายการ)");
                            }

                            ProductSerial::whereIn('id', $serialIds)->update([
                                'status' => 'available',
                                'stock_movement_id' => $movement->id,
                                'sold_at' => null,
                                'sold_to_sale_document_id' => null,
                            ]);
                        }

                        // 🆕 คืนต้นทุนจริงกลับเข้าล็อตเดิมที่เคยตัดไปตอนขาย (ดูเหตุผลเต็มที่ StockLotFifoService::
                        // returnToOriginalLots()) — เรียกหลังอัปเดต S/N เสร็จแล้วเสมอ เพื่อให้ $item->serials
                        // (โหลดไว้ตั้งแต่ต้น approve()) มี stock_lot_id ของแต่ละชิ้นให้ใช้งานถูกต้อง
                        \App\Services\StockLotFifoService::returnToOriginalLots(
                            $item->product_id, $warehouseId, $doc->company_id, (float) $item->quantity,
                            $expectedTaxInvoiceId, $item->serials, ['reference_number' => $doc->document_number],
                        );
                    }
                } else {
                    // 🔓 ปลดล็อก (reserved_qty ลด) เท่านั้น — ของไม่เคยออกจาก qty จริงตอนเบิก (ดู branch 'stock_issue' ด้านบน) จึงไม่ต้องเพิ่มคืน
                    // ไม่สร้าง StockMovement เช่นเดียวกับตอนเบิก (ไม่ใช่การเคลื่อนไหวสต๊อกทางกายภาพจริง)
                    foreach ($doc->items as $item) {
                        if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

                        $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                        $balance->reserved_qty = max(0, $balance->reserved_qty - $item->quantity);
                        $balance->save();

                        if ($item->serials->isNotEmpty()) {
                            $serialIds = $item->serials->pluck('id');
                            $lockedSerials = ProductSerial::whereIn('id', $serialIds)->lockForUpdate()->get();

                            // ต้องยังอยู่ในสถานะ 'rented' และเช่าออกมาจากใบเบิกที่เอกสารคืนนี้อ้างอิงถึงเท่านั้น (กันคืนผิดใบ/คืนซ้ำ)
                            $invalid = $lockedSerials->first(fn ($s) => $s->status !== 'rented' || (int) $s->rented_via_sale_document_id !== (int) $doc->reference_document_id);
                            if ($invalid) {
                                throw new \DomainException("S/N {$invalid->serial_number} ไม่ได้อยู่ในสถานะเช่าออกจากใบเบิกที่อ้างอิง (อาจถูกคืนไปแล้วหรือเลือกผิดใบเบิก)");
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

            // 🆕 สินค้าชุด (Bundle): แถวแม่ไม่มีสต๊อกของตัวเอง (ทุก branch ข้ามแถวแม่ตั้งแต่ต้นลูป) จึงไม่เคยได้
            // cost_price จาก applyFifoCost() เลย — roll-up ต้นทุนจริงของแถวลูกขึ้นแถวแม่ทีหลัง ไม่งั้นรายงานกำไร
            // จะเห็นแถวแม่ต้นทุน 0 เสมอ (รายได้ทั้งหมดอยู่ที่แถวแม่ แต่ต้นทุนไปกระจายอยู่แถวลูก) — ทำหลัง branch
            // ทั้งหมดข้างบนเสร็จเสมอ ไม่ว่าเอกสารจะเป็นประเภทไหน (no-op ถ้าเอกสารนี้ไม่มีสินค้าชุดเลย)
            foreach ($doc->items->where('product.is_bundle', true) as $parent) {
                $childCost = $doc->items->where('parent_item_id', $parent->id)
                    ->sum(fn ($c) => (float) $c->cost_price * (float) $c->quantity);
                $parent->update(['cost_price' => $parent->quantity > 0 ? round($childCost / $parent->quantity, 2) : 0]);
            }

            // 🪜 [2026-09-24] เอกสารที่บอกว่างานก้าวหน้า (ใบเสนอราคา/ใบเบิก/ใบจัดสินค้า/ใบส่งสินค้า/ใบเบิกวัสดุติดตั้ง) อนุมัติแล้ว —
            // เลื่อนขั้นตอนงานของโครงการ/งานเช่าไปข้างหน้าอย่างเดียว (ดู WorkStageService)
            if ($stageForDoc = \App\Services\WorkStageService::SALE_DOCUMENT_STAGE[$doc->document_type] ?? null) {
                \App\Services\WorkStageService::advance($doc->project_id ? (int) $doc->project_id : null, $doc->rental_job_id ? (int) $doc->rental_job_id : null, $stageForDoc);
            }

            DB::commit();
            return response()->json(['message' => 'อนุมัติเอกสารและจัดการสต๊อกสำเร็จ', 'status' => 'Approved']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], $e instanceof \DomainException ? 422 : 500);
        }
    }

    // 🐛 [2026-09-24] หาเอกสารปลายทางที่ "ยังไม่ยกเลิก/ไม่ถูก revise" และอ้างอิงเอกสารนี้อยู่ — ใช้กันการยกเลิก/revise เอกสารต้นทาง
    // ที่มีเอกสารตามมาแล้ว (ต้นเหตุ S/N ที่ขายไปแล้วกลับเป็นพร้อมขาย, จองค้างถาวร, ใบเสร็จ/ใบลดหนี้ชี้ไปหาใบกำกับที่ยกเลิก)
    // คืนข้อความ error (ระบุเลขที่เอกสารที่ต้องจัดการก่อน) หรือ null ถ้าไม่มี $action = 'ยกเลิก' | 'สร้างเวอร์ชันใหม่ของ'
    private function activeDependentsError(SaleDocument $doc, string $action): ?string
    {
        $base = SaleDocument::where('company_id', $doc->company_id)
            ->whereNotIn('status', ['Cancelled', 'Revised'])
            ->where('id', '!=', $doc->id);
        $numbers = collect();

        switch ($doc->document_type) {
            case 'material_issue':
                // ใบกำกับภาษี/บิลเงินสด/ใบจัดสินค้า/ใบส่งสินค้า ที่อ้างใบเบิกนี้ (ทั้ง reference_document_id และ pivot หลายใบ)
                $numbers = (clone $base)->where(function ($q) use ($doc) {
                    $q->where('reference_document_id', $doc->id)
                        ->orWhereHas('materialIssueRefs', fn ($q2) => $q2->where('material_issue_id', $doc->id));
                })->pluck('document_number');
                break;
            case 'stock_issue':
                $numbers = (clone $base)->where('document_type', 'rental_stock_return')->where('reference_document_id', $doc->id)->pluck('document_number');
                break;
            case 'loan_issue':
                $numbers = (clone $base)->where('document_type', 'loan_return')->where('reference_document_id', $doc->id)->pluck('document_number');
                break;
            case 'credit_note':
                $numbers = (clone $base)->where('document_type', 'stock_return')->where('reference_document_id', $doc->id)->pluck('document_number');
                break;
            case 'tax_invoice':
                $numbers = (clone $base)->where(function ($q) use ($doc) {
                    $q->where(fn ($q2) => $q2->whereIn('document_type', ['credit_note', 'debit_note', 'invoice'])->where('reference_document_id', $doc->id))
                        ->orWhere(fn ($q2) => $q2->where('document_type', 'receipt')->whereHas('invoiceRefs', fn ($q3) => $q3->where('tax_invoice_id', $doc->id)));
                })->pluck('document_number');
                $installations = \App\Models\InstallationDocument::where('sale_document_id', $doc->id)->pluck('installation_number');
                $numbers = $numbers->merge($installations);
                break;
        }

        if ($numbers->isEmpty()) return null;

        return "ไม่สามารถ{$action}เอกสารนี้ได้ เพราะมีเอกสารที่อ้างอิงเอกสารนี้อยู่และยังไม่ยกเลิก: "
            . $numbers->take(5)->implode(', ') . ($numbers->count() > 5 ? ' ...' : '')
            . ' — กรุณายกเลิกเอกสารเหล่านั้นก่อน';
    }

    // 🐛 [2026-09-24] ใบเบิกสินค้า 1 ใบออกใบกำกับภาษี/บิลเงินสดได้ครั้งเดียว (รายการถูกล็อกตามใบเบิกทั้งใบ) — เดิมกันไว้เฉพาะใบจัดสินค้า
    // ทำให้ออกใบกำกับ 2 ใบจากใบเบิกเดียวแล้วอนุมัติทั้งคู่ตัดสต๊อกซ้ำ (และกินยอดจองของเอกสารอื่น) คืนข้อความ error หรือ null
    // $approvedOnly = true ตอนอนุมัติ: นับเฉพาะใบที่ Approved ไปแล้ว (ใบ Pending คู่แข่งไม่ควรบล็อกกันเอง — ใครอนุมัติก่อนได้ก่อน)
    private function materialIssueAlreadyInvoicedError($materialIssueIds, ?int $excludeDocId = null, bool $approvedOnly = false): ?string
    {
        $ids = collect($materialIssueIds)->filter()->unique()->values();
        if ($ids->isEmpty()) return null;

        $query = SaleDocument::where('company_id', auth()->user()->company_id)
            ->whereIn('document_type', ['tax_invoice', 'cash'])
            ->whereIn('status', $approvedOnly ? ['Approved'] : ['Pending', 'Approved'])
            ->where(function ($q) use ($ids) {
                $q->whereIn('reference_document_id', $ids)
                    ->orWhereHas('materialIssueRefs', fn ($q2) => $q2->whereIn('material_issue_id', $ids));
            });
        if ($excludeDocId) $query->where('id', '!=', $excludeDocId);

        $existing = $query->first(['document_number']);
        return $existing
            ? "ใบเบิกสินค้าที่เลือกมีการออกเอกสารขายไว้แล้ว ({$existing->document_number}) — ใบเบิก 1 ใบออกใบกำกับภาษี/บิลเงินสดได้ 1 ใบ หากต้องการออกใหม่ให้ยกเลิกใบเดิมก่อน"
            : null;
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

        // 🐛 [2026-09-24] เอกสารที่อนุมัติแล้ว (ตัดสต๊อก/จอง/มีผลทางภาษีไปแล้ว) ต้องมีสิทธิ์อนุมัติของเอกสารประเภทนั้นด้วยจึงยกเลิกได้
        // — เดิมใช้แค่สิทธิ์แก้ไข ทำให้พนักงานที่ไม่มีสิทธิ์อนุมัติยกเลิกใบกำกับภาษีที่อนุมัติแล้ว (คืนสต๊อกกลับ) ได้เอง
        if ($doc->status === 'Approved' && !$this->hasPermission('approve', $doc->document_type)) {
            return response()->json(['message' => 'การยกเลิกเอกสารที่อนุมัติแล้วต้องมีสิทธิ์อนุมัติเอกสารประเภทนี้'], 403);
        }

        // 🛡️ [2026-09-23] ห้ามยกเลิก (Void) ใบกำกับภาษีที่อนุมัติแล้วและพ้นกำหนดยื่นภาษี (ภ.พ.30) ของงวดนั้นไปแล้ว —
        // ตามหลักปฏิบัติระบบใหญ่ที่ไทยใช้ ถ้ายังไม่ถึงกำหนดยื่นให้ยกเลิกตรงๆ ได้ (เอกสารยังไม่มีผลทางภาษีจริง) แต่ถ้า
        // เลยกำหนดยื่นแล้วต้องออกใบลดหนี้/เพิ่มหนี้แทนเท่านั้น (ห้ามแก้ไข/ลบเอกสารที่มีผลทางภาษีไปแล้ว) เช็คเฉพาะตอน
        // เอกสารเคย Approved (มีผลทางภาษีจริง) เอกสาร Pending ยกเลิกได้ตามปกติไม่ติดเงื่อนไขนี้ วันครบกำหนดยื่นตั้งค่า
        // ได้เองที่หน้า /company (เผื่อกรมสรรพากรเปลี่ยนกำหนด เช่น e-filing ขยายเป็นวันที่ 23) ค่าเริ่มต้น 15
        if ($doc->document_type === 'tax_invoice' && $doc->status === 'Approved') {
            $company = \App\Models\Company::find($doc->company_id);
            // 🛡️ Company::document_settings cast เป็น 'array' อยู่แล้ว (ดู Company::casts()) ไม่ต้อง json_decode ซ้ำ
            $docSettings = $company->document_settings ?? [];
            // 🆕 [2026-09-23] เปิด/ปิดเงื่อนไขนี้ได้เองที่หน้า /company — ปิดไว้เป็นค่าเริ่มต้น (opt-in)
            $filingLockEnabled = (bool) ($docSettings['tax']['vatFilingLockEnabled'] ?? false);
            $filingDay = min((int) ($docSettings['tax']['vatFilingDay'] ?? 15), 28);
            $deadline = Carbon::parse($doc->issue_date)->addMonthNoOverflow()->day(max(1, $filingDay))->endOfDay();
            if ($filingLockEnabled && now()->greaterThan($deadline)) {
                return response()->json([
                    'message' => "ไม่สามารถยกเลิกใบกำกับภาษีนี้ได้ เนื่องจากพ้นกำหนดยื่นภาษีของงวดนี้แล้ว (ครบกำหนดวันที่ {$deadline->format('d/m/Y')}) กรุณาออกใบลดหนี้/ใบเพิ่มหนี้แทน",
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            // 🐛 [2026-09-24] เช็คสถานะจากแถวที่ล็อกในทรานแซกชัน (กันกดยกเลิกซ้ำ/พร้อมกันแล้วคืนสต๊อกซ้ำ) และ rollBack ก่อน return
            // (เดิม return ทิ้งทรานแซกชันที่เปิดค้างไว้)
            $oldStatus = SaleDocument::where('id', $doc->id)->lockForUpdate()->value('status');
            if ($oldStatus === 'Cancelled') {
                DB::rollBack();
                return response()->json(['message' => 'เอกสารนี้ถูกยกเลิกไปแล้ว'], 400);
            }

            // 🐛 [2026-09-24] เอกสารที่อนุมัติแล้วและมีเอกสารอื่นอ้างอิงต่ออยู่ (ยังไม่ยกเลิก) ห้ามยกเลิก — เดิมไม่เช็คเลย ทำให้
            // ยกเลิกใบเบิกหลังออกใบกำกับภาษีแล้วปล่อย S/N ที่ขายไปแล้วกลับเป็นพร้อมขาย ยกเลิกใบกำกับที่มีใบเสร็จ/ใบลดหนี้/งานติดตั้ง
            // ตามมา ฯลฯ ต้องยกเลิกเอกสารปลายทางก่อนจากปลายทางย้อนขึ้นมา
            if ($oldStatus === 'Approved') {
                $dependentsError = $this->activeDependentsError($doc, 'ยกเลิก');
                if ($dependentsError) {
                    DB::rollBack();
                    return response()->json(['message' => $dependentsError], 422);
                }
            }

            $doc->update([
                'status' => 'Cancelled',
                'note' => $doc->note . "\n[ยกเลิกเอกสาร]: " . ($request->reason ?? 'ผู้ใช้กดยกเลิกในระบบ')
            ]);

            // 📦 ลอจิกคืนสต๊อก (ทำเฉพาะถ้าบิลเคยถูก Approve และตัดสต๊อกไปแล้ว)
            if ($oldStatus === 'Approved') {
                // 🆕 'cash' ตัดออกจากลิสต์นี้แล้ว เหมือนใน approve() — ย้อนกลับผ่าน $materialIssueRef branch ด้านล่างแทน
                // 🆕 [2026-09-17] 'installation_issue' สมมาตรกับ approve() — ย้อนกลับสต๊อกจริงเหมือน custom_cash/receipt
                $stockOutTypes = ['custom_cash', 'receipt', 'installation_issue'];
                $warehouseId = Warehouse::resolveFor($doc->company_id, $doc->warehouse_id);

                // 🎗️ "ยืมของจากลูกค้า" (borrow_in) — ไม่เคยกระทบสต๊อกตอนอนุมัติ จึงไม่มีอะไรต้องย้อนกลับตอนยกเลิกเช่นกัน
                $isBorrowInLoan = $doc->document_type === 'loan_issue' && $doc->loan_direction === 'borrow_in';
                $isBorrowInReturn = $doc->document_type === 'loan_return' && ($doc->referencedDocument->loan_direction ?? null) === 'borrow_in';

                // 🎗️ สมมาตรกับ approve() — ถ้าเอกสารนี้เคยอนุมัติแบบ "ปลดจอง + ตัดจริง" จากใบเบิกสินค้า (material_issue) ต้องย้อนกลับแบบเดียวกัน
                // 🆕 ใบกำกับภาษีอาจอ้างอิงใบเบิกได้หลายใบ — ใช้ resolveMaterialIssueRefs() เดียวกับ approve()
                // 🆕 [2026-09-23] delivery_note ยกเว้นออกเหมือน approve() — ไม่เคยตัด/จองสต๊อกไว้เลย จึงไม่มีอะไรต้องย้อนกลับ
                $materialIssueRefs = $this->resolveMaterialIssueRefs($doc);

                if ($materialIssueRefs->isNotEmpty() && $doc->document_type !== 'delivery_note') {
                    $materialIssueNumbers = $materialIssueRefs->pluck('document_number')->implode(', ');
                    // 🐛 [2026-09-24] ถ้าใบเบิกต้นทางไม่ได้อนุมัติอยู่แล้ว (ถูกยกเลิก/revise ไปก่อน — ข้อมูลเก่าที่หลุดการกันไว้) ห้ามจองกลับ
                    // หรือตั้ง S/N เป็น 'rented' ให้ใบเบิกที่ไม่มีอยู่จริง (เดิมทำให้จองค้างถาวรไม่มีเอกสารเจ้าของ) — คืนแค่ qty/ล็อต
                    // และปล่อย S/N กลับเป็นพร้อมขาย
                    $sourceIssuesApproved = $materialIssueRefs->every(fn ($m) => $m->status === 'Approved');
                    foreach ($doc->items as $item) {
                        if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

                        $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                        $balance->qty += $item->quantity; // คืนสต๊อกจริงที่เคยตัดไป
                        if ($sourceIssuesApproved) {
                            $balance->reserved_qty += $item->quantity; // จองกลับคืนเหมือนตอน material_issue อนุมัติ (ยังไม่ได้ถูกคืนของจริงจนกว่าจะคืน/ยกเลิก material_issue ต้นทางด้วย)
                        }
                        $balance->save();

                        \App\Models\StockMovement::create([
                            'product_id' => $item->product_id,
                            'type' => 'in',
                            'quantity' => $item->quantity,
                            'reference_number' => $doc->document_number,
                            'note' => "คืนสต๊อก (ยกเลิกเอกสาร {$doc->document_number} ที่อ้างอิงใบเบิก {$materialIssueNumbers})",
                            'user_id' => auth()->id(),
                            'warehouse_id' => $warehouseId,
                            'company_id' => $doc->company_id
                        ]);

                        // 🆕 S/N ของเอกสารนี้สืบทอดมาจากใบเบิกสินค้าต้นทาง ซึ่งยังคงอนุมัติอยู่ (แค่ยกเลิกเอกสารนี้ ไม่ได้ยกเลิก
                        // ใบเบิก) — ต้องย้อนกลับเป็น 'rented' (สถานะที่จองไว้จากใบเบิก) ให้ตรงกับ reserved_qty ที่คืนกลับไป
                        // ด้านบน ไม่ใช่ 'available' เพราะใบเบิกต้นทางยังจองสิทธิ์ S/N ตัวนี้ไว้อยู่ (จะกลับเป็น 'available'
                        // จริงๆ ก็ต่อเมื่อใบเบิกต้นทางเองถูกยกเลิก/คืนด้วยเท่านั้น)
                        if ($item->serials->isNotEmpty()) {
                            ProductSerial::whereIn('id', $item->serials->pluck('id'))->update([
                                'status' => $sourceIssuesApproved ? 'rented' : 'available',
                                'sold_at' => null,
                                'sold_to_sale_document_id' => null,
                            ]);
                        }
                    }
                    // 🆕 คืนล็อตต้นทุน FIFO ที่เคยตัดไปตอนอนุมัติกลับเข้าล็อตเดิมทั้งหมด (ดู applyFifoCost() ใน approve())
                    \App\Services\StockLotFifoService::reverse(['sale_document_id' => $doc->id]);
                } elseif (in_array($doc->document_type, $stockOutTypes)) {
                    foreach ($doc->items as $item) {
                        // 📦 แถวแม่สินค้าชุด (Bundle) ไม่เคยถูกตัดสต๊อกตอนอนุมัติ (ดู approve()) จึงไม่ต้องคืนสต๊อกตอนยกเลิกเช่นกัน
                        if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

                        $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                        $balance->qty += $item->quantity;
                        $balance->save();

                        \App\Models\StockMovement::create([
                            'product_id' => $item->product_id,
                            'type' => 'in', // คืนกลับเป็น In
                            'quantity' => $item->quantity,
                            'reference_number' => $doc->document_number,
                            'note' => $doc->document_type === 'installation_issue'
                                ? 'คืนสต๊อก (ยกเลิกใบเบิกวัสดุติดตั้ง ' . $doc->document_number . ')'
                                : 'คืนสต๊อก (ยกเลิกบิลขาย ' . $doc->document_number . ')',
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
                    // 🆕 คืนล็อตต้นทุน FIFO ที่เคยตัดไปตอนอนุมัติกลับเข้าล็อตเดิมทั้งหมด (ดู applyFifoCost() ใน approve())
                    \App\Services\StockLotFifoService::reverse(['sale_document_id' => $doc->id]);
                } elseif (in_array($doc->document_type, ['stock_issue', 'loan_issue', 'material_issue']) && !$isBorrowInLoan) {
                    // 🎪 ยกเลิกใบเบิกสินค้า(โครงการ)/ใบเบิกสินค้า(งานเช่า)/ใบยืมสินค้า ที่เคยอนุมัติแล้ว — ปลดล็อก (reserved_qty ลด) ไม่แตะ qty จริงเพราะไม่เคยตัดออก
                    foreach ($doc->items as $item) {
                        if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

                        $balance = StockBalance::lockedFor($item->product_id, $doc->company_id, $warehouseId);
                        $balance->reserved_qty = max(0, $balance->reserved_qty - $item->quantity);
                        $balance->save();

                        if ($item->serials->isNotEmpty()) {
                            // 🐛 [2026-09-24] ปล่อยเฉพาะ S/N ที่ยัง 'rented' อยู่จากเอกสารนี้จริงๆ — เดิมตั้ง 'available' ทุกตัวไม่ดูสถานะ
                            // ทำให้ S/N ที่ถูกขาย/คืนไปแล้วกลับมาพร้อมขายซ้ำได้
                            ProductSerial::whereIn('id', $item->serials->pluck('id'))
                                ->where('status', 'rented')
                                ->where('rented_via_sale_document_id', $doc->id)
                                ->update(['status' => 'available', 'rented_at' => null, 'rented_via_sale_document_id' => null]);
                        }
                    }
                } elseif (in_array($doc->document_type, ['stock_return', 'rental_stock_return', 'loan_return']) && !$isBorrowInReturn) {
                    // 🎪 ยกเลิกใบคืนสินค้า/ใบคืนสินค้ายืม — ย้อนกลับตามประเภทเอกสารต้นทางที่อ้างอิง (สมมาตรกับ approve() ด้านบน)
                    $referencedType = $doc->referencedDocument->document_type ?? null;

                    if ($referencedType === 'credit_note') {
                        // ย้อนกลับการรับคืนสินค้าจริง — ดึง qty ออกอีกครั้ง (เหมือนไม่เคยคืนของ)
                        foreach ($doc->items as $item) {
                            if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

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

                            // 🆕 ตัดล็อตต้นทุน FIFO อีกครั้ง (เหมือนไม่เคยคืนของ) — ไม่ใช่การ "undo" การคืนล็อตแบบเป๊ะๆ
                            // ย้อนกลับ (เช่น re-consume ล็อตเดิมเป๊ะที่เพิ่งคืนไป) แต่ใช้ FIFO ปกติซ้ำ ซึ่งในกรณีทั่วไป
                            // (ไม่มีธุรกรรมอื่นคั่นกลาง) จะได้ล็อตเดิมกลับมาอยู่ดีเพราะยังเป็นล็อตเก่าสุดที่มีของอยู่
                            $item->product->has_serial_number && $item->serials->isNotEmpty()
                                ? \App\Services\StockLotFifoService::consumeSerials($item->serials, $warehouseId, $doc->company_id, [
                                    'reference_type' => 'sale_document_item', 'reference_id' => $item->id, 'sale_document_id' => $doc->id,
                                ])
                                : \App\Services\StockLotFifoService::consume($item->product_id, $warehouseId, $doc->company_id, (float) $item->quantity, [
                                    'reference_type' => 'sale_document_item', 'reference_id' => $item->id, 'sale_document_id' => $doc->id,
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
                            if ($item->product->is_bundle || $item->product->product_type === 'service') continue;

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
            return response()->json(['message' => $e->getMessage()], $e instanceof \DomainException ? 422 : 500);
        }
    }

    // ==========================================
    // 📝 สร้างเวอร์ชันใหม่ (Revise Document)
    // ==========================================
    public function revise(Request $request, $id)
    {
        $original = SaleDocument::with('items.serials', 'items.product')->find($id);
        if (!$original) return response()->json(['message' => 'ไม่พบเอกสารต้นฉบับ'], 404);

        // 🛡️ API Guard: revise คือการสร้างเอกสารใหม่ (เวอร์ชันถัดไป) ของประเภทเดิม
        if (!$this->hasPermission('create', $original->document_type)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์สร้างเอกสารประเภทนี้'], 403);
        }

        // 🆕 [2026-09-19] ใบกำกับภาษีไม่ใช้ Revise แล้ว — แก้ไขหลังอนุมัติได้ตรงๆ ผ่าน update() แทน
        if ($original->document_type === 'tax_invoice') {
            return response()->json(['message' => 'ใบกำกับภาษีไม่รองรับการสร้างเวอร์ชันใหม่ ให้แก้ไขเอกสารเดิมได้เลย'], 400);
        }

        // 🆕 [2026-09-23] ใบเสร็จรับเงินไม่ใช้ Revise แล้ว (เป็นหลักฐานรับเงินจริง เลขที่ต้องไม่หาย/ซ้ำ) — Pending แก้ไขตรงๆ,
        // ผิดพลาดหลังอนุมัติให้ยกเลิกแล้วออกใบใหม่
        if ($original->document_type === 'receipt') {
            return response()->json(['message' => 'ใบเสร็จรับเงินไม่รองรับการสร้างเวอร์ชันใหม่ ให้แก้ไขเอกสารเดิม หรือยกเลิกแล้วออกใบใหม่'], 400);
        }

        // 🆕 [2026-09-19] ใบเบิกวัสดุติดตั้ง revise ได้เฉพาะ Pending/Approved (ที่ยกเลิก/revise ไปแล้วไม่มีอะไรให้ทำต่อ)
        // 🐛 [2026-09-24] ขยายเป็นทุกประเภทเอกสาร — เดิมเช็คเฉพาะใบเบิกวัสดุติดตั้ง ทำให้ revise เอกสารที่ยกเลิก/revise ไปแล้วซ้ำได้
        // สร้างเลขเวอร์ชันซ้ำ (-V1 หลายใบ) และชุบชีวิตเอกสารที่ยกเลิกไปแล้ว
        if (!in_array($original->status, ['Pending', 'Approved'])) {
            return response()->json(['message' => 'สร้างเวอร์ชันใหม่ได้เฉพาะเอกสารที่รออนุมัติหรืออนุมัติแล้วเท่านั้น (เอกสารที่ยกเลิก/แก้ไขเวอร์ชันไปแล้วทำไม่ได้)'], 400);
        }

        // 🐛 [2026-09-24] เอกสารที่อนุมัติแล้วและกระทบสต๊อก/จอง แต่ revise ไม่มีลอจิกย้อนกลับ (มีแค่ใบเบิกสินค้า/ใบเบิกวัสดุติดตั้ง) ห้าม revise —
        // เดิมต้นฉบับกลายเป็น 'Revised' โดยสต๊อก/จองที่ตัด/ล็อกไปแล้วไม่ถูกย้อนกลับ พออนุมัติเวอร์ชันใหม่ก็ตัด/จองซ้ำอีกรอบ
        // (ต้นฉบับที่ Revised แล้ว cancel() ก็ไม่ปลดให้อีก จองค้างถาวร) ให้ยกเลิกแล้วออกใบใหม่แทน
        $revisableWhenApproved = !in_array($original->document_type, ['cash', 'custom_cash', 'stock_issue', 'loan_issue', 'stock_return', 'rental_stock_return', 'loan_return']);
        if ($original->status === 'Approved' && !$revisableWhenApproved) {
            return response()->json(['message' => 'เอกสารประเภทนี้ที่อนุมัติแล้วไม่รองรับการสร้างเวอร์ชันใหม่ (กระทบสต๊อก) กรุณายกเลิกแล้วออกใบใหม่'], 400);
        }

        DB::beginTransaction();
        try {
            // 🔒 ล็อกแถวต้นฉบับแล้วเช็คสถานะซ้ำ กันกด revise ซ้ำพร้อมกัน (สร้างเวอร์ชันซ้ำ/ปลดจองซ้ำ)
            $lockedStatus = SaleDocument::where('id', $original->id)->lockForUpdate()->value('status');
            if (!in_array($lockedStatus, ['Pending', 'Approved'])) {
                DB::rollBack();
                return response()->json(['message' => 'เอกสารนี้ถูกยกเลิก/สร้างเวอร์ชันใหม่ไปแล้ว'], 400);
            }

            // 🐛 ใบเบิกสินค้าที่อนุมัติแล้วและมีเอกสารปลายทางตามมาอยู่ (ใบกำกับภาษี/บิลเงินสด ฯลฯ) ห้าม revise (ปลดจอง/S/N ทั้งที่ของถูกใช้แล้ว)
            if ($lockedStatus === 'Approved' && $original->document_type === 'material_issue') {
                $dependentsError = $this->activeDependentsError($original, 'สร้างเวอร์ชันใหม่ของ');
                if ($dependentsError) {
                    DB::rollBack();
                    return response()->json(['message' => $dependentsError], 422);
                }
            }

            // 🆕 [2026-09-19] ใบเบิกวัสดุติดตั้งที่อนุมัติแล้วตัดสต๊อกจริงไปแล้ว (ต่างจากใบเบิกสินค้าที่แค่จอง) — ต้องคืนสต๊อก/S/N/ล็อต FIFO
            // ก่อนเปลี่ยนใบเดิมเป็น 'Revised' แบบเดียวกับ cancel() ไม่งั้นสต๊อกจะถูกตัดค้างและเวอร์ชันใหม่อนุมัติซ้ำแล้วตัดสองรอบ
            if ($original->document_type === 'installation_issue' && $original->status === 'Approved') {
                $warehouseId = Warehouse::resolveFor($original->company_id, $original->warehouse_id);
                foreach ($original->items as $item) {
                    if ($item->product->is_bundle || $item->product->product_type === 'service') continue;
                    $balance = StockBalance::lockedFor($item->product_id, $original->company_id, $warehouseId);
                    $balance->qty += $item->quantity;
                    $balance->save();

                    \App\Models\StockMovement::create([
                        'product_id' => $item->product_id,
                        'type' => 'in',
                        'quantity' => $item->quantity,
                        'reference_number' => $original->document_number,
                        'note' => 'คืนสต๊อก (แก้ไขเวอร์ชันใบเบิกวัสดุติดตั้ง ' . $original->document_number . ')',
                        'user_id' => auth()->id(),
                        'warehouse_id' => $warehouseId,
                        'company_id' => $original->company_id,
                    ]);

                    if ($item->serials->isNotEmpty()) {
                        ProductSerial::whereIn('id', $item->serials->pluck('id'))->update([
                            'status' => 'available', 'sold_at' => null, 'sold_to_sale_document_id' => null,
                        ]);
                    }
                }
                \App\Services\StockLotFifoService::reverse(['sale_document_id' => $original->id]);
            }

            // 🆕 ถ้าเอกสารต้นฉบับเป็นใบเบิกสินค้าที่อนุมัติไปแล้ว ต้องปลดจอง reserved_qty/คืนสถานะ S/N ก่อน
            // (เหมือน cancel() ทำกับกิ่ง material_issue) ไม่งั้นจองสต๊อกจะค้างตลอดไปเพราะใบเดิมกลายเป็น 'Revised'
            // ซึ่ง cancel() จะไม่ปลดจองให้อีกต่อไป (เช็คแค่ oldStatus === 'Approved')
            if ($original->document_type === 'material_issue' && $original->status === 'Approved') {
                $warehouseId = Warehouse::resolveFor($original->company_id, $original->warehouse_id);
                foreach ($original->items as $item) {
                    if ($item->product->is_bundle || $item->product->product_type === 'service') continue;
                    $balance = StockBalance::lockedFor($item->product_id, $original->company_id, $warehouseId);
                    $balance->reserved_qty = max(0, $balance->reserved_qty - $item->quantity);
                    $balance->save();
                    if ($item->serials->isNotEmpty()) {
                        // ปล่อยเฉพาะ S/N ที่ยัง 'rented' อยู่จากใบนี้จริงๆ (เหมือน cancel())
                        ProductSerial::whereIn('id', $item->serials->pluck('id'))
                            ->where('status', 'rented')
                            ->where('rented_via_sale_document_id', $original->id)
                            ->update(['status' => 'available', 'rented_at' => null, 'rented_via_sale_document_id' => null]);
                    }
                }
            }

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

            // 🐛 [2026-09-24] คัดลอกตารางอ้างอิงใบกำกับภาษี (ใบวางบิล) และใบเบิกสินค้าที่อ้างอิง (ใบจัดสินค้า/ใบส่งสินค้า) มาด้วย —
            // เดิมคัดลอกแต่ items ทำให้ใบวางบิลเวอร์ชันใหม่ไม่มีรายการอ้างอิงเลย (ใบวางบิลไม่มี items ของตัวเอง เหลือเอกสารเปล่า)
            // และใบจัดสินค้า/ใบส่งสินค้าเวอร์ชันใหม่หลุดการผูกกับใบเบิกเดิม
            foreach ($original->invoiceRefs as $ref) {
                $newRef = $ref->replicate();
                $newRef->sale_document_id = $newDoc->id;
                $newRef->save();
            }
            foreach ($original->materialIssueRefs as $ref) {
                $newRef = $ref->replicate();
                $newRef->sale_document_id = $newDoc->id;
                $newRef->save();
            }

            DB::commit();
            return response()->json([
                'message' => 'สร้างเอกสารเวอร์ชันใหม่ (' . $newDocNumber . ') สำเร็จ',
                'data' => $newDoc->load('items')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], $e instanceof \DomainException ? 422 : 500);
        }
    }
}
