<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Unit;

// 🚀 มิเรอร์ pattern เดียวกับ WarehouseController.php/ProductCategoryController.php เป๊ะ — เติมส่วนแก้ไข/ลบ
// ที่ units ยังไม่เคยมีเลย (เดิมมีแค่ "เพิ่ม" ผ่าน MasterDataController::store())
class UnitController extends Controller
{
    public function index()
    {
        // 🚀 ระบบจะคัดกรองแยกบริษัทให้อัตโนมัติจาก Trait
        return response()->json(Unit::orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        $companyId = $request->user()->company_id;

        $request->validate([
            // 🛡️ กันชื่อหน่วยนับซ้ำภายในบริษัทเดียวกัน — scope ด้วย company_id เพราะคนละบริษัทใช้ชื่อซ้ำกันได้
            'name' => [
                'required', 'string', 'max:255',
                \Illuminate\Validation\Rule::unique('units', 'name')->where('company_id', $companyId),
            ],
        ], [
            'name.unique' => 'มีหน่วยนับชื่อนี้อยู่แล้วในบริษัทนี้ กรุณาตั้งชื่ออื่น',
        ]);

        $unit = new Unit();
        $unit->name = $request->name;
        $unit->company_id = $companyId;
        $unit->save();

        return response()->json([
            'message' => 'เพิ่มหน่วยนับสำเร็จ',
            'data' => $unit,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $companyId = $request->user()->company_id;

        $request->validate([
            // 🛡️ ignore ตัวเองด้วย ไม่งั้นแก้ไขหน่วยนับเดิมโดยไม่เปลี่ยนชื่อจะชน validation ตัวเอง
            'name' => [
                'required', 'string', 'max:255',
                \Illuminate\Validation\Rule::unique('units', 'name')->where('company_id', $companyId)->ignore($id),
            ],
        ], [
            'name.unique' => 'มีหน่วยนับชื่อนี้อยู่แล้วในบริษัทนี้ กรุณาตั้งชื่ออื่น',
        ]);

        $unit = Unit::findOrFail($id);
        $unit->name = $request->name;
        $unit->save();

        return response()->json([
            'message' => 'อัปเดตหน่วยนับสำเร็จ',
            'data' => $unit,
        ]);
    }

    public function destroy($id)
    {
        // 🛡️ products.unit_id -> units เป็น FK แบบ SET NULL (ยืนยันจาก information_schema แล้ว) ลบหน่วยนับนี้
        // ได้ปลอดภัยเสมอ ไม่ชน constraint — สินค้าที่เคยผูกไว้แค่ unit_id กลายเป็น NULL
        $unit = Unit::findOrFail($id);
        $unit->delete();
        return response()->json(['message' => 'ลบหน่วยนับสำเร็จ']);
    }
}
