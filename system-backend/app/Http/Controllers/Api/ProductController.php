<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Http\Resources\ProductResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    // 1. ระบบดึงข้อมูล (เพิ่ม Search และ Pagination)
    public function index(Request $request)
    {
        $query = Product::with(['category', 'brand', 'unit', 'stockBalance', 'bundleItems.componentProduct.unit'])
            ->withCount(['serials as available_serials_count' => function ($q) {
                $q->where('status', 'available');
            }])
            ->latest();

        // 1. ค้นหาข้อความ
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('model_name', 'like', "%{$search}%");
            });
        }

        // 🚀 2. Filter: หมวดหมู่สินค้า
        if ($request->filled('category_id') && $request->category_id !== 'all') {
            $query->where('category_id', $request->category_id);
        }

        // 🚀 3. Filter: สถานะสต็อก
        if ($request->filled('stock_status') && $request->stock_status !== 'all') {
            if ($request->stock_status === 'in_stock') {
                $query->whereHas('stockBalance', function ($q) {
                    $q->where('qty', '>', 0);
                });
            } elseif ($request->stock_status === 'out_of_stock') {
                $query->whereDoesntHave('stockBalance', function ($q) {
                    $q->where('qty', '>', 0);
                });
            }
        }

        // 🚀 4. Filter: ประเภทสินค้า (ค้นหาจากป้ายกำกับใหม่) — รองรับหลายค่าคั่นด้วย comma เช่น type=rent,install
        if ($request->filled('type') && $request->type !== 'all') {
            $types = array_map('trim', explode(',', $request->type));
            $query->where(function ($q) use ($types) {
                foreach ($types as $type) {
                    if ($type === 'rent') {
                        $q->orWhere('can_rent', true);
                    } elseif ($type === 'install') {
                        $q->orWhere('is_install_job', true);
                    } elseif ($type === 'inventory') {
                        $q->orWhere(fn ($qq) => $qq->where('product_type', 'inventory')->where('can_sell', true));
                    } elseif ($type === 'service') {
                        $q->orWhere('product_type', 'service');
                    }
                }
            });
        }

        // 🚀 5. Filter: การใช้งาน (Active/Inactive)
        if ($request->filled('is_active') && $request->is_active !== 'all') {
            $val = $request->is_active === 'active' ? 1 : 0;
            $query->where('is_active', $val);
        }

        $perPage = $request->input('per_page', 10);
        $products = $query->paginate($perPage);

        return ProductResource::collection($products);
    }

    // 2. ระบบบันทึกข้อมูลใหม่ (รองรับรูปภาพ)
    public function store(Request $request)
    {
        // [API Guard] ดักจับสิทธิ์การสร้างสินค้า
        $isSuperAdmin = auth()->user()->isCompanyAdmin();
        if (!auth()->user()->is_platform_admin && !$isSuperAdmin && !auth()->user()->can('manage_products')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์จัดการข้อมูลสินค้า'], 403);
        }

        $validated = $request->validate([
            'product_type' => 'required|in:inventory,non-inventory,service',
            'sku' => 'required|string|unique:products,sku',
            'can_sell' => 'boolean',
            'can_rent' => 'boolean',
            'is_install_job' => 'boolean',
            'name' => 'required|string',
            'model_name' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'vat_type' => 'required|in:7,0,exempt',
            'has_serial_number' => 'required|boolean',
            'category_id' => 'nullable|exists:product_categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:500',
            'barcode' => 'nullable|string',
            'low_stock_threshold' => 'nullable|integer|min:0',
            // 📦 สินค้าชุด (Bundle) — ไม่มีสต๊อกของตัวเอง จึงบังคับ product_type เป็น non-inventory เสมอด้านล่าง
            'is_bundle' => 'nullable|boolean',
            'bundle_items' => 'nullable|array',
            'bundle_items.*.component_product_id' => 'required_with:bundle_items|exists:products,id',
            'bundle_items.*.quantity' => 'required_with:bundle_items|numeric|min:0.01',
        ]);

        if ($request->hasFile('image')) {
            $validated['image'] = $request->file('image')->store('products', 'public');
        }
        $validated['company_id'] = $request->user()->company_id;

        // 🛡️ สินค้าชุดไม่มีสต๊อกของตัวเอง (ยืนยันไว้ตอนออกแบบ) — บังคับ product_type ฝั่ง backend กันหน้าบ้านลืมล็อก
        if (!empty($validated['is_bundle'])) {
            $validated['product_type'] = 'non-inventory';
        }

        $bundleItems = $validated['bundle_items'] ?? [];
        unset($validated['bundle_items']);

        $product = Product::create($validated);
        $this->syncBundleItems($product, $bundleItems);

        return response()->json([
            'message' => 'เพิ่มสินค้าสำเร็จ!',
            'data' => new ProductResource($product->load(['category', 'brand', 'bundleItems.componentProduct.unit']))
        ], 201);
    }

    // 3. ระบบอัปเดตข้อมูล (แก้ไขรูปภาพเก่าได้)
    public function update(Request $request, Product $product)
    {
        // [API Guard] ดักจับสิทธิ์การแก้ไขสินค้า
        $isSuperAdmin = auth()->user()->isCompanyAdmin();
        if (!auth()->user()->is_platform_admin && !$isSuperAdmin && !auth()->user()->can('manage_products')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์จัดการข้อมูลสินค้า'], 403);
        }

        $validated = $request->validate([
            'product_type' => 'required|in:inventory,non-inventory,service',
            'can_sell' => 'boolean',
            'can_rent' => 'boolean',
            'is_install_job' => 'boolean',
            'sku' => 'required|string|unique:products,sku,' . $product->id,
            'barcode' => 'nullable|string',
            'name' => 'required|string',
            'model_name' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'vat_type' => 'required|in:7,0,exempt',
            'has_serial_number' => 'required|boolean',
            'category_id' => 'nullable|exists:product_categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            'unit_id' => 'nullable|exists:units,id',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:500',
            'low_stock_threshold' => 'nullable|integer|min:0',
            // 📦 สินค้าชุด (Bundle) — ไม่มีสต๊อกของตัวเอง จึงบังคับ product_type เป็น non-inventory เสมอด้านล่าง
            'is_bundle' => 'nullable|boolean',
            'bundle_items' => 'nullable|array',
            'bundle_items.*.component_product_id' => 'required_with:bundle_items|exists:products,id',
            'bundle_items.*.quantity' => 'required_with:bundle_items|numeric|min:0.01',
        ]);

        if ($request->hasFile('image')) {
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $validated['image'] = $request->file('image')->store('products', 'public');
        }
        $validated['company_id'] = $request->user()->company_id;

        if (!empty($validated['is_bundle'])) {
            $validated['product_type'] = 'non-inventory';
        }

        $bundleItems = $validated['bundle_items'] ?? [];
        unset($validated['bundle_items']);

        $product->update($validated);
        $this->syncBundleItems($product, $bundleItems);

        return response()->json([
            'message' => 'อัปเดตข้อมูลสำเร็จ!',
            'data' => new ProductResource($product->load(['category', 'brand', 'unit', 'bundleItems.componentProduct.unit']))
        ]);
    }

    // 4. ระบบลบข้อมูล
    public function destroy(Product $product)
    {
        // [API Guard] ดักจับสิทธิ์การลบสินค้า
        $isSuperAdmin = auth()->user()->isCompanyAdmin();
        if (!auth()->user()->is_platform_admin && !$isSuperAdmin && !auth()->user()->can('manage_products')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์จัดการข้อมูลสินค้า'], 403);
        }

        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }
        $product->delete();
        return response()->json(['message' => 'ลบสินค้าเรียบร้อยแล้ว']);
    }

    // 💡 ฟังก์ชันดึง S/N ที่เหลืออยู่ในคลัง
    public function availableSerials($id)
    {
        try {
            $serials = \App\Models\ProductSerial::where('product_id', $id)
                ->where('status', 'available')
                ->pluck('serial_number');

            return response()->json([
                'message' => 'ดึงข้อมูล S/N คงเหลือสำเร็จ',
                'data' => $serials
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // 💰 ต้นทุนถัวเฉลี่ยของสินค้าตัวเดียว — ใช้เป็นค่าเริ่มต้นของช่อง "ราคาต้นทุน" ตอนเลือกสินค้าในฟอร์มใบเสนอราคา
    // (sales/quotations, sales/custom-quotations) มิเรอร์สูตรเดียวกับ
    // ReportController::averageCostByProduct() แต่กรองเหลือสินค้าตัวเดียวแทนการ group ทั้งบริษัท
    public function averageCost($id)
    {
        $companyId = auth()->user()->company_id;

        $row = \App\Models\GoodsReceiptItem::where('product_id', $id)
            ->whereHas('goodsReceipt', fn($q) => $q->where('company_id', $companyId)->where('status', '!=', 'Cancelled'))
            ->whereNotNull('unit_price')
            ->selectRaw('SUM(quantity * unit_price) as total_cost, SUM(quantity) as total_qty')
            ->first();

        $avgCost = ($row && $row->total_qty > 0) ? round($row->total_cost / $row->total_qty, 2) : null;

        return response()->json(['avg_cost' => $avgCost]);
    }

    // 🎗️ รายละเอียดจำนวนที่ "ติดจอง/ติดยืม" อยู่ตอนนี้ — ใช้เปิด popup จากคอลัมน์ในหน้าสร้างใบยืมสินค้า (loan_issue)
    // สินค้าคุม S/N: ไล่จาก ProductSerial สถานะ 'rented' ตรงๆ (แม่นยำระดับชิ้น) — สินค้าไม่คุม S/N: รวมยอดจากเอกสาร
    // stock_issue/loan_issue(lend_out) ที่อนุมัติแล้ว หักด้วยยอดที่ถูกคืนผ่าน stock_return/loan_return ที่อ้างอิงเอกสารนั้นแล้ว
    public function reservationDetails($id)
    {
        $product = \App\Models\Product::find($id);
        if (!$product) return response()->json(['message' => 'ไม่พบสินค้า'], 404);
        $companyId = auth()->user()->company_id;

        if ($product->has_serial_number) {
            $serials = \App\Models\ProductSerial::where('product_id', $id)
                ->where('company_id', $companyId)
                ->where('status', 'rented')
                ->with('rentedViaSaleDocument.contact')
                ->orderBy('rented_at')
                ->get();

            $rows = $serials->map(function ($s) {
                $doc = $s->rentedViaSaleDocument;
                return [
                    'serial_number' => $s->serial_number,
                    'document_number' => $doc->document_number ?? '-',
                    'document_type' => $doc->document_type ?? null,
                    'party' => $doc ? ($doc->contact->business_name ?? $doc->contact->name ?? $doc->borrower_name ?? '-') : '-',
                    'quantity' => 1,
                    'date' => optional($s->rented_at)->format('d/m/Y'),
                ];
            });

            return response()->json(['type' => 'serial', 'data' => $rows]);
        }

        $issueItems = \App\Models\SaleDocumentItem::where('product_id', $id)
            ->whereHas('saleDocument', function ($q) use ($companyId) {
                $q->where('company_id', $companyId)
                    ->where('status', 'Approved')
                    ->whereIn('document_type', ['stock_issue', 'loan_issue'])
                    ->where(function ($qq) {
                        $qq->whereNull('loan_direction')->orWhere('loan_direction', 'lend_out');
                    });
            })
            ->with('saleDocument.contact')
            ->get();

        $rows = [];
        foreach ($issueItems as $item) {
            $doc = $item->saleDocument;
            $returnedQty = (float) \App\Models\SaleDocumentItem::where('product_id', $id)
                ->whereHas('saleDocument', function ($q) use ($doc) {
                    $q->where('reference_document_id', $doc->id)
                        ->where('status', 'Approved')
                        ->whereIn('document_type', ['stock_return', 'loan_return']);
                })
                ->sum('quantity');
            $outstanding = (float) $item->quantity - $returnedQty;
            if ($outstanding > 0) {
                $rows[] = [
                    'document_number' => $doc->document_number,
                    'document_type' => $doc->document_type,
                    'party' => $doc->contact->business_name ?? $doc->contact->name ?? $doc->borrower_name ?? '-',
                    'quantity' => $outstanding,
                    'date' => optional($doc->issue_date)->format('d/m/Y'),
                ];
            }
        }

        return response()->json(['type' => 'aggregate', 'data' => $rows]);
    }

    // 🚀 ฟังก์ชันสำหรับดึงข้อมูลสินค้า 1 รายการ (เอาไปโชว์ในหน้า Edit)
    public function show($id)
    {
        try {
            $product = \App\Models\Product::with(['category', 'unit', 'brand', 'bundleItems.componentProduct.unit'])->find($id);

            if (!$product) {
                return response()->json(['message' => 'ไม่พบข้อมูลสินค้า'], 404);
            }

            return response()->json(['data' => $product]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์: ' . $e->getMessage()], 500);
        }
    }

    // 📦 sync สูตรส่วนประกอบสินค้าชุด (Bundle) — ลบของเดิมทั้งหมดแล้วสร้างใหม่ตามที่ส่งมา (pattern เดียวกับ sale_document_items)
    private function syncBundleItems(Product $product, array $bundleItems): void
    {
        $product->bundleItems()->delete();
        if (empty($bundleItems)) return;

        foreach ($bundleItems as $index => $item) {
            \App\Models\ProductBundleItem::create([
                'company_id' => $product->company_id,
                'bundle_product_id' => $product->id,
                'component_product_id' => $item['component_product_id'],
                'quantity' => $item['quantity'],
                'sort_order' => $index,
            ]);
        }
    }

    // 🚀 ฟังก์ชันสลับสถานะการใช้งาน
    public function toggleActive(Request $request, Product $product)
    {
        // [API Guard] ดักจับสิทธิ์การเปิด/ปิดสถานะสินค้า
        $isSuperAdmin = auth()->user()->isCompanyAdmin();
        if (!auth()->user()->is_platform_admin && !$isSuperAdmin && !auth()->user()->can('manage_products')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์จัดการข้อมูลสินค้า'], 403);
        }

        $request->validate([
            'is_active' => 'required|boolean'
        ]);

        $product->update([
            'is_active' => $request->is_active
        ]);

        return response()->json(['message' => 'เปลี่ยนสถานะเรียบร้อยแล้ว', 'is_active' => $product->is_active]);
    }

    // 🎪 สินค้าที่มักใช้คู่กัน (เช่น เสา Beam คู่กับเสาแกน Beam) — ใช้ตอนเบิกสินค้างานเช่า
    public function relatedProducts($id)
    {
        $product = Product::findOrFail($id);

        return response()->json([
            'data' => $product->relatedProducts()->select('products.id', 'products.name', 'products.sku', 'products.can_rent', 'products.is_install_job')->get(),
        ]);
    }

    public function syncRelatedProducts(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        $request->validate([
            'related_product_ids' => 'array',
            'related_product_ids.*' => 'exists:products,id',
        ]);

        $relatedIds = array_filter($request->related_product_ids ?? [], fn ($rid) => (int) $rid !== (int) $id);
        $companyId = $request->user()->company_id;

        \Illuminate\Support\Facades\DB::transaction(function () use ($product, $relatedIds, $companyId) {
            // ลบความสัมพันธ์เดิมของสินค้านี้ทั้ง 2 ทิศก่อน แล้วค่อยสร้างชุดใหม่แบบสมมาตร
            \App\Models\ProductRelation::where('company_id', $companyId)
                ->where(function ($q) use ($product) {
                    $q->where('product_id', $product->id)->orWhere('related_product_id', $product->id);
                })
                ->delete();

            foreach ($relatedIds as $relatedId) {
                \App\Models\ProductRelation::create([
                    'company_id' => $companyId,
                    'product_id' => $product->id,
                    'related_product_id' => $relatedId,
                ]);
                \App\Models\ProductRelation::create([
                    'company_id' => $companyId,
                    'product_id' => $relatedId,
                    'related_product_id' => $product->id,
                ]);
            }
        });

        return response()->json([
            'message' => 'บันทึกสินค้าที่มักใช้คู่กันสำเร็จ',
            'data' => $product->relatedProducts()->select('products.id', 'products.name', 'products.sku')->get(),
        ]);
    }
}
