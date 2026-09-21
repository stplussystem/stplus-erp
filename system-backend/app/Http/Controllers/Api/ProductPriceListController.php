<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ImportBatch;
use App\Models\Product;
use App\Models\ProductPriceList;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;

// 🆕 โมดูล Price List — แคตตาล็อกราคาที่ผู้จำหน่ายแต่ละรายตั้งไว้ต่อสินค้า (คนละเรื่องกับ
// ReportController::supplierPriceComparisonRows() ซึ่งเป็นรายงานย้อนหลังจากราคาที่ซื้อจริง) ใช้ดูตอนอนุมัติ
// ใบเสนอราคาเพื่อเทียบราคาขายกับต้นทุนฝั่งผู้จำหน่าย
class ProductPriceListController extends Controller
{
    // GET /api/product-price-lists?search=&vendor_id=&expiring_within_days=&page=
    public function index(Request $request)
    {
        $query = ProductPriceList::with(['product:id,name,sku', 'vendor:id,business_name,contact_person_name']);

        if ($request->filled('vendor_id')) {
            $query->where('contact_id', $request->vendor_id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($request->filled('expiring_within_days')) {
            $days = (int) $request->expiring_within_days;
            $query->whereNotNull('expiry_date')->where('expiry_date', '<=', now()->addDays($days));
        }

        $perPage = $request->input('per_page', 15);
        return response()->json($query->latest('updated_at')->paginate($perPage));
    }

    // POST /api/product-price-lists
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'contact_id' => 'required|exists:contacts,id',
            'price' => 'required|numeric|min:0',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'price_trend' => 'nullable|in:up,down,stable',
            'expiry_date' => 'nullable|date',
            'note' => 'nullable|string',
        ]);

        $validated['company_id'] = $request->user()->company_id;
        $entry = ProductPriceList::applyUpdate($validated);

        return response()->json(['message' => 'บันทึกราคาสำเร็จ', 'data' => $entry->load(['product:id,name,sku', 'vendor:id,business_name'])]);
    }

    // PUT /api/product-price-lists/{productPriceList}
    public function update(Request $request, ProductPriceList $productPriceList)
    {
        $validated = $request->validate([
            'price' => 'required|numeric|min:0',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'price_trend' => 'nullable|in:up,down,stable',
            'expiry_date' => 'nullable|date',
            'note' => 'nullable|string',
        ]);

        $validated['company_id'] = $productPriceList->company_id;
        $validated['product_id'] = $productPriceList->product_id;
        $validated['contact_id'] = $productPriceList->contact_id;
        $entry = ProductPriceList::applyUpdate($validated);

        return response()->json(['message' => 'บันทึกราคาสำเร็จ', 'data' => $entry->load(['product:id,name,sku', 'vendor:id,business_name'])]);
    }

    // DELETE /api/product-price-lists/{productPriceList}
    public function destroy(ProductPriceList $productPriceList)
    {
        $productPriceList->delete();
        return response()->json(['message' => 'ลบรายการราคาสำเร็จ']);
    }

    // GET /api/products/{id}/price-lists — ใช้ตอนอนุมัติใบเสนอราคา ดูราคาที่ทุก vendor ตั้งไว้สำหรับสินค้านี้
    // 🆕 ถ้าสินค้านี้เป็นสินค้าชุด (is_bundle=true) แม่ไม่มี Price List ของตัวเอง — แสดง Price List ของสินค้า
    // ลูกทุกตัวแทน (1 กลุ่มต่อ 1 ลูก) เพื่อให้ยังเทียบราคาต้นทุนได้แม้เป็นการขายแบบชุด
    public function forProduct($productId)
    {
        try {
            $product = Product::findOrFail($productId);

            $targets = $product->is_bundle
                ? $product->bundleItems()->with('componentProduct:id,name,sku')->get()
                    ->map(fn ($item) => $item->componentProduct)->filter()->values()
                : collect([$product]);

            $groups = $targets->map(function ($target) {
                $rows = ProductPriceList::where('product_id', $target->id)
                    ->with('vendor:id,business_name,contact_person_name')
                    ->orderBy('price')
                    ->get()
                    ->map(function ($row) {
                        return [
                            'id' => $row->id,
                            'vendor_name' => $row->vendor->business_name ?? $row->vendor->contact_person_name ?? '-',
                            'price' => (float) $row->price,
                            'discount_percent' => $row->discount_percent !== null ? (float) $row->discount_percent : null,
                            'price_trend' => $row->price_trend,
                            'updated_at' => $row->updated_at->format('d/m/Y'),
                            'expiry_date' => $row->expiry_date?->format('d/m/Y'),
                            'is_expired' => $row->expiry_date ? $row->expiry_date->isPast() : false,
                        ];
                    });

                return [
                    'product_id' => $target->id,
                    'product_name' => $target->name,
                    'sku' => $target->sku,
                    'rows' => $rows,
                ];
            })->values();

            return response()->json(['data' => ['is_bundle' => (bool) $product->is_bundle, 'groups' => $groups]]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // GET /api/product-price-lists/export?vendor_id=
    public function export(Request $request)
    {
        $request->validate(['vendor_id' => 'required|exists:contacts,id']);

        try {
            $companyId = $request->user()->company_id;
            $products = Product::where('company_id', $companyId)->orderBy('name')->get(['id', 'sku', 'name']);
            $existingByProduct = ProductPriceList::where('contact_id', $request->vendor_id)
                ->whereIn('product_id', $products->pluck('id'))
                ->get()
                ->keyBy('product_id');

            $fileName = 'price_list_' . now()->format('YmdHi') . '.xlsx';
            return Excel::download(new \App\Exports\ProductPriceListExport($products, $existingByProduct), $fileName);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Export Failed: ' . $e->getMessage()], 500);
        }
    }

    // POST /api/product-price-lists/import (file + vendor_id)
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv',
            'vendor_id' => 'required|exists:contacts,id',
        ]);

        try {
            // 🛡️ กัน upload ไฟล์ผิดหน้า (เช่นไฟล์ปรับปรุงสต๊อก) เหมือน ProductExcelController::importAdjust()
            try {
                $filePath = $request->file('file')->getRealPath();
                $reader = IOFactory::createReaderForFile($filePath);
                $reader->setReadDataOnly(true);
                $spreadsheet = $reader->load($filePath);
                $headerRow = $spreadsheet->getSheet(0)->rangeToArray('A1:H1', null, true, false)[0] ?? [];
                $headerRow = array_map(fn ($v) => trim((string) $v), $headerRow);
                $isPriceListFile = in_array('Product ID (ห้ามแก้)', $headerRow, true);
            } catch (\Throwable $e) {
                $isPriceListFile = true;
            }

            if (!$isPriceListFile) {
                return response()->json([
                    'message' => 'ไฟล์นี้ดูเหมือนไม่ใช่ไฟล์ Price List กรุณาใช้ไฟล์จากปุ่ม "ดาวน์โหลดข้อมูลสินค้า" ก่อนแล้วจึงอัปโหลดกลับเข้ามา',
                ], 422);
            }

            $companyId = $request->user()->company_id;

            $batch = ImportBatch::create([
                'company_id' => $companyId,
                'user_id' => $request->user()->id,
                'type' => 'price_list',
                'file_name' => $request->file('file')->getClientOriginalName(),
            ]);

            $import = new \App\Imports\ProductPriceListImport($companyId, (int) $request->vendor_id, $batch->id);
            Excel::import($import, $request->file('file'));

            $batch->update(['affected_count' => $import->processedCount]);

            $message = "นำเข้า Price List สำเร็จ {$import->processedCount} รายการ";
            if ($import->skippedNotFoundCount > 0) {
                $message .= " (ไม่พบสินค้า {$import->skippedNotFoundCount} รายการ)";
            }

            return response()->json(['message' => $message]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }
}
