<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\PurchaseOrderItem;
use App\Models\StockBalance;
use Illuminate\Http\Request;

class StockCheckController extends Controller
{
    // 🛡️ สถานะ PO ที่ถือว่า "สั่งซื้อไปแล้ว รอของเข้า" — ไม่นับ Completed (ของเข้าคลังแล้ว สะท้อนอยู่ใน qty
    // ปัจจุบันอยู่แล้ว ถ้ายังขาดอีกแปลว่า PO นั้นไม่เกี่ยวกับการขาดครั้งนี้) และไม่นับ Cancelled
    private const OPEN_PO_STATUSES = ['Pending', 'Approved', 'Partial'];

    // 🆕 [2026-09-15] สถานะ PO ที่ใช้แสดงผลบรรทัด "สั่งซื้อแล้ว" ให้ผู้ใช้เห็น — เพิ่ม Completed เข้ามาด้วย
    // (ต่างจาก OPEN_PO_STATUSES ที่ใช้แค่คำนวณยอดขาดสุทธิ) เพื่ออธิบายว่า "สต๊อกพอเพราะเพิ่งรับของจาก PO ครบแล้ว"
    // ไม่รวม Cancelled เพราะไม่ได้สะท้อนสต๊อกจริง
    private const DISPLAY_PO_STATUSES = ['Pending', 'Approved', 'Partial', 'Completed'];

    // POST /api/stock-balances/check
    // เช็คสต๊อกแบบ bulk: รับรายการ product_id + จำนวนที่ต้องการ คืนยอดคงเหลือรวมทุกคลัง (แยกคงเหลือ/ติดจอง/
    // พร้อมใช้จริง) breakdown รายคลังต่อสินค้า และ PO ที่สั่งซื้อไปแล้ว (ถ้าสินค้านั้นขาด) ใช้สำหรับปุ่ม
    // "เช็คสินค้า" ในหน้าโครงการ (เทียบกับใบเสนอราคา)
    public function check(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1|max:200',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0',
            // 🆕 [2026-09-15] โครงการที่กำลังดูอยู่ — ใช้แยกยอด "ติดจอง" ว่าเป็นของโครงการนี้เอง (จองแล้ว, สีเขียว)
            // หรือของโครงการอื่น (ติดจอง, สีแดง) ดู logic ด้านล่าง — optional เพื่อไม่กระทบจุดเรียกอื่นที่ไม่ส่งมา
            'project_id' => 'nullable|integer',
        ]);

        $companyId = $request->user()->company_id;
        $productIds = collect($request->items)->pluck('product_id')->unique()->values();

        // 🆕 ยอดจอง "โดยโครงการนี้" — นับเฉพาะใบเบิกสินค้า (material_issue) ที่อนุมัติแล้วที่ project_id ตรงกับ
        // โครงการที่กำลังดู (stock_issue/loan_issue ผูกกับ rental_job ไม่ใช่ project จึงนับเป็น "โครงการอื่น" เสมอ
        // โดยธรรมชาติ ถูกต้องอยู่แล้วถ้าไม่รวมมาที่นี่) กลุ่มตาม product_id + warehouse_id ในคิวรีเดียว ไม่วนทีละสินค้า
        $reservedByProjectByProduct = collect();
        $reservedByProjectByWarehouse = collect(); // key: "productId:warehouseId"
        if ($request->filled('project_id')) {
            $rows = \App\Models\SaleDocumentItem::whereIn('sale_document_items.product_id', $productIds)
                ->whereHas('saleDocument', function ($q) use ($companyId, $request) {
                    $q->where('company_id', $companyId)
                        ->where('status', 'Approved')
                        ->where('document_type', 'material_issue')
                        ->where('project_id', $request->project_id);
                })
                ->join('sale_documents', 'sale_documents.id', '=', 'sale_document_items.sale_document_id')
                ->selectRaw('sale_document_items.product_id, sale_documents.warehouse_id, SUM(sale_document_items.quantity) as qty')
                ->groupBy('sale_document_items.product_id', 'sale_documents.warehouse_id')
                ->get();
            foreach ($rows as $r) {
                $reservedByProjectByProduct[$r->product_id] = ($reservedByProjectByProduct[$r->product_id] ?? 0) + (float) $r->qty;
                $reservedByProjectByWarehouse["{$r->product_id}:{$r->warehouse_id}"] = (float) $r->qty;
            }
        }

        // 🛡️ เดิมรวมแค่ qty ทำให้ของที่ "ติดจอง" ไปแล้ว (reserved_qty จากใบเบิก/ใบยืมอื่นที่อนุมัติแล้ว) ยังถูก
        // นับว่า "มีพร้อมใช้" อยู่ — เหมือนกับ ReportController::inventoryValuationRows()/lowStockRows() และ
        // กฎที่บังคับจริงตอนเบิกสินค้าใน SaleDocumentController::approve() (available = qty - reserved_qty)
        $totalsByProduct = StockBalance::whereIn('product_id', $productIds)
            ->where('company_id', $companyId)
            ->selectRaw('product_id, SUM(qty) as total_qty, SUM(reserved_qty) as total_reserved_qty')
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id');

        $balancesByProduct = StockBalance::whereIn('product_id', $productIds)
            ->where('company_id', $companyId)
            ->with('warehouse:id,name')
            ->get()
            ->groupBy('product_id');

        $products = Product::whereIn('id', $productIds)->get(['id', 'name', 'sku'])->keyBy('id');

        $result = collect($request->items)->map(function ($item) use ($totalsByProduct, $balancesByProduct, $products, $reservedByProjectByProduct, $reservedByProjectByWarehouse) {
            $productId = $item['product_id'];
            $requestedQty = (float) $item['quantity'];
            $totals = $totalsByProduct[$productId] ?? null;
            $qty = (float) ($totals->total_qty ?? 0);
            $reservedQty = (float) ($totals->total_reserved_qty ?? 0);
            // 🛡️ clamp ไม่ให้เกินยอดจองจริง — กันกรณี query สดของ material_issue คลาดจากยอด reserved_qty สะสม
            // (เช่น บางส่วนถูกตัดจริงไปแล้วผ่านเอกสารดาวน์สตรีมที่อ้างอิงใบเบิกนี้ ทำให้ reserved_qty ลดลงแล้ว)
            $reservedSameProject = min($reservedQty, (float) ($reservedByProjectByProduct[$productId] ?? 0));
            $reservedOtherProjects = max(0, $reservedQty - $reservedSameProject);
            // 🔄 [2026-09-15] เปลี่ยนจาก qty - reservedQty (ยอดจองรวม) เป็น qty - reservedOtherProjects เท่านั้น —
            // ยอดที่โครงการนี้จองไว้เอง (reservedSameProject) ไม่ถือเป็น "ของที่ขาด" เพราะกันไว้ให้โครงการนี้อยู่แล้ว
            // (พิสูจน์ทางคณิตศาสตร์: remaining_need = requested-reservedSameProject, free_stock = qty-reservedQty
            // รวม, shortfall = remaining_need - free_stock ลดรูปเหลือ requested - (qty - reservedOtherProjects)
            // พอดี — reservedSameProject หักล้างกันเองในสูตรสุดท้าย ไม่ต้องปรากฏตรงๆ)
            $availableQty = $qty - $reservedOtherProjects;

            return [
                'product_id' => $productId,
                'product_name' => $products[$productId]->name ?? null,
                'sku' => $products[$productId]->sku ?? null,
                'requested_qty' => $requestedQty,
                'qty' => $qty,
                'reserved_qty' => $reservedQty,
                // 🆕 [2026-09-15] แยกยอดจองตามที่มา — ใช้แค่ตอนแสดงผล (สีเขียว/แดง) ไม่กระทบ available_qty/
                // shortfall_qty ด้านล่างเลย ยังคำนวณจาก reserved_qty รวมเหมือนเดิมทุกประการ
                'reserved_qty_same_project' => $reservedSameProject,
                'reserved_qty_other_projects' => $reservedOtherProjects,
                'available_qty' => $availableQty,
                'in_stock' => $availableQty >= $requestedQty,
                'shortfall_qty' => max(0, $requestedQty - $availableQty),
                // 🆕 ยอดขาดสุทธิหลังหักยอด PO ที่เปิดอยู่ (สั่งไปแล้วแต่ยังไม่ได้รับ) — ค่าเริ่มต้นเท่ากับ
                // shortfall_qty ไปก่อน จะถูกคำนวณใหม่ด้านล่างถ้าสินค้านี้มี PO เปิดอยู่ (ดู $shortageProductIds)
                'net_shortfall_after_po' => max(0, $requestedQty - $availableQty),
                'warehouses' => ($balancesByProduct[$productId] ?? collect())->map(function ($balance) use ($productId, $reservedByProjectByWarehouse) {
                    $whReserved = (float) $balance->reserved_qty;
                    $whReservedSameProject = min($whReserved, (float) ($reservedByProjectByWarehouse["{$productId}:{$balance->warehouse_id}"] ?? 0));
                    return [
                        'warehouse_id' => $balance->warehouse_id,
                        'warehouse_name' => $balance->warehouse?->name,
                        'qty' => (float) $balance->qty,
                        'reserved_qty' => $whReserved,
                        'reserved_qty_same_project' => $whReservedSameProject,
                        // 🔄 [2026-09-15] เหมือนระดับสินค้ารวมด้านบน — หักเฉพาะยอดติดจองโครงการอื่นของคลังนี้
                        'available_qty' => (float) $balance->qty - ($whReserved - $whReservedSameProject),
                    ];
                })->values(),
                'existing_purchase_orders' => [],
            ];
        });

        // 🆕 ดึงข้อมูล PO ที่เกี่ยวข้องกับสินค้าที่เช็คทุกตัว (ไม่ใช่แค่ตัวที่ขาด) เพื่อโชว์ "สั่งซื้อแล้ว" ให้เห็น
        // แม้ตอนสต๊อกพอแล้ว (อธิบายว่าทำไมถึงพอ เพราะเพิ่งรับของจาก PO เข้ามาครบ)
        // 🔄 [2026-09-15] เดิมโชว์ทุกโครงการ (เพราะของจาก PO เข้าคลังกลาง ไม่ได้ผูกเฉพาะโครงการที่สั่ง) แต่ทำให้
        // เข้าใจผิดว่า "โครงการนี้สั่งไปแล้ว" ทั้งที่จริงเป็น PO ของอีกโครงการ — จำกัดแค่ project_id เดียวกับที่กำลังดูอยู่
        // เท่านั้น (ถ้าไม่ได้ส่ง project_id มา คงพฤติกรรมเดิมไว้ ไม่กรอง กันกระทบจุดเรียกอื่นที่อาจยังไม่ส่งมา)
        $openPOsByProduct = PurchaseOrderItem::join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->where('purchase_orders.company_id', $companyId)
            ->whereIn('purchase_orders.status', self::DISPLAY_PO_STATUSES)
            ->whereIn('purchase_order_items.product_id', $productIds)
            ->when($request->filled('project_id'), fn ($q) => $q->where('purchase_orders.project_id', $request->project_id))
            ->orderByDesc('purchase_orders.created_at')
            ->get([
                'purchase_order_items.product_id',
                'purchase_orders.id as po_id',
                'purchase_orders.po_number',
                'purchase_orders.status',
                'purchase_order_items.quantity',
                'purchase_order_items.received_quantity',
            ])
            ->groupBy('product_id');

        $result = $result->map(function ($row) use ($openPOsByProduct) {
            $pos = ($openPOsByProduct[$row['product_id']] ?? collect())->map(fn ($po) => [
                'po_id' => $po->po_id,
                'po_number' => $po->po_number,
                'status' => $po->status,
                'quantity' => (float) $po->quantity,
                'received_quantity' => (float) $po->received_quantity,
            ])->values();
            $row['existing_purchase_orders'] = $pos;
            // 🆕 ยอดที่ยังไม่ได้รับจาก PO ที่ "เปิดอยู่" เท่านั้น (ไม่นับ Completed เพราะรับครบแล้วไม่มียอดค้าง)
            // เทียบกับยอดขาด เพื่อรู้ว่ายอดขาดที่เหลือ "ถูกสั่งซื้อไปครบแล้ว" หรือยัง
            $openOutstandingQty = $pos->filter(fn ($po) => in_array($po['status'], self::OPEN_PO_STATUSES))
                ->sum(fn ($po) => max(0, $po['quantity'] - $po['received_quantity']));
            $row['net_shortfall_after_po'] = max(0, $row['shortfall_qty'] - $openOutstandingQty);
            return $row;
        });

        return response()->json(['data' => $result]);
    }
}
