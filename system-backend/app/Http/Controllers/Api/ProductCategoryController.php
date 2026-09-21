<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ProductCategory;

// 🚀 มิเรอร์ pattern เดียวกับ WarehouseController.php เป๊ะ — ก่อนหน้านี้ product_categories มีแค่ "เพิ่ม"
// ผ่าน MasterDataController::store() (ปุ่ม "+ เพิ่ม..." ใน combobox ตอนสร้างสินค้า) ไม่มีหน้าจัดการ/แก้ไข/
// ลบเลย ต่างจาก warehouses ที่มีครบ CRUD สมบูรณ์ — ไฟล์นี้เติมส่วนที่ขาดให้ครบเหมือนกัน
class ProductCategoryController extends Controller
{
    public function index()
    {
        // 🚀 ระบบจะคัดกรองแยกบริษัทให้อัตโนมัติจาก Trait
        return response()->json(ProductCategory::orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        $companyId = $request->user()->company_id;

        $request->validate([
            // 🛡️ กันชื่อหมวดหมู่ซ้ำภายในบริษัทเดียวกัน — scope ด้วย company_id เพราะคนละบริษัทใช้ชื่อซ้ำกันได้
            'name' => [
                'required', 'string', 'max:255',
                \Illuminate\Validation\Rule::unique('product_categories', 'name')->where('company_id', $companyId),
            ],
        ], [
            'name.unique' => 'มีหมวดหมู่สินค้าชื่อนี้อยู่แล้วในบริษัทนี้ กรุณาตั้งชื่ออื่น',
        ]);

        $category = new ProductCategory();
        $category->name = $request->name;
        $category->company_id = $companyId;
        $category->save();

        return response()->json([
            'message' => 'เพิ่มหมวดหมู่สินค้าสำเร็จ',
            'data' => $category,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $companyId = $request->user()->company_id;

        $request->validate([
            // 🛡️ ignore ตัวเองด้วย ไม่งั้นแก้ไขหมวดหมู่เดิมโดยไม่เปลี่ยนชื่อจะชน validation ตัวเอง
            'name' => [
                'required', 'string', 'max:255',
                \Illuminate\Validation\Rule::unique('product_categories', 'name')->where('company_id', $companyId)->ignore($id),
            ],
        ], [
            'name.unique' => 'มีหมวดหมู่สินค้าชื่อนี้อยู่แล้วในบริษัทนี้ กรุณาตั้งชื่ออื่น',
        ]);

        $category = ProductCategory::findOrFail($id);
        $category->name = $request->name;
        $category->save();

        return response()->json([
            'message' => 'อัปเดตหมวดหมู่สินค้าสำเร็จ',
            'data' => $category,
        ]);
    }

    public function destroy($id)
    {
        // 🛡️ products.category_id -> product_categories เป็น FK แบบ SET NULL (ยืนยันจาก information_schema
        // แล้ว) ลบหมวดหมู่นี้ได้ปลอดภัยเสมอ ไม่ชน constraint — สินค้าที่เคยผูกไว้แค่ category_id กลายเป็น NULL
        $category = ProductCategory::findOrFail($id);
        $category->delete();
        return response()->json(['message' => 'ลบหมวดหมู่สินค้าสำเร็จ']);
    }
}
