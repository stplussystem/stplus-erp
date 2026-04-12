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
        // เริ่มต้น Query พร้อมดึงข้อมูล หมวดหมู่, ยี่ห้อ, และ หน่วยนับ มาด้วย
        $query = Product::with(['category', 'brand', 'unit', 'stockBalance'])->latest();

        // ระบบค้นหา (จาก SKU, ชื่อ, หรือ รุ่น)
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('model_name', 'like', "%{$search}%");
            });
        }

        // ระบบแบ่งหน้า (ค่าเริ่มต้น 10 รายการต่อหน้า)
        $perPage = $request->input('per_page', 10);
        $products = $query->paginate($perPage);

        return ProductResource::collection($products);
    }

    // 2. ระบบบันทึกข้อมูลใหม่ (รองรับรูปภาพ)
    public function store(Request $request)
    {
        $validated = $request->validate([
            'sku' => 'required|string|unique:products,sku',
            'name' => 'required|string',
            'model_name' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'vat_type' => 'required|in:7,0,exempt',
            'has_serial_number' => 'required|boolean',
            'category_id' => 'nullable|exists:product_categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            // กฎเหล็ก: ไฟล์ต้องเป็นรูปภาพ และขนาดห้ามเกิน 500 KB (500 kilobytes)
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:500',
            'barcode' => 'nullable|string',
        ]);

        $validated['company_id'] = 1; // อนาคตเปลี่ยนเป็นดึงจาก User Login

        // จัดการบันทึกไฟล์รูปภาพ
        if ($request->hasFile('image')) {
            $validated['image'] = $request->file('image')->store('products', 'public');
        }

        $product = Product::create($validated);

        return response()->json([
            'message' => 'เพิ่มสินค้าสำเร็จ!',
            'data' => new ProductResource($product->load(['category', 'brand']))
        ], 201);
    }

    // 3. ระบบอัปเดตข้อมูล (แก้ไขรูปภาพเก่าได้)
    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'product_type' => 'required|in:service,inventory,non-inventory',
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
        ]);

        if ($request->hasFile('image')) {
            if ($product->image) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($product->image);
            }
            $validated['image'] = $request->file('image')->store('products', 'public');
        }

        $product->update($validated);

        return response()->json([
            'message' => 'อัปเดตข้อมูลสำเร็จ!',
            'data' => new ProductResource($product->load(['category', 'brand', 'unit']))
        ]);
    }

    // 4. ระบบลบข้อมูล
    public function destroy(Product $product)
    {
        // ลบรูปภาพออกจากเซิร์ฟเวอร์ด้วยก่อนลบข้อมูลจาก Database
        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }

        $product->delete();

        return response()->json([
            'message' => 'ลบสินค้าเรียบร้อยแล้ว'
        ]);
    }
}
