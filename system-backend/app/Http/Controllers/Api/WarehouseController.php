<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Warehouse;

class WarehouseController extends Controller
{
    public function index()
    {
        // 🚀 ระบบจะคัดกรองแยกบริษัทให้อัตโนมัติจาก Trait
        return response()->json(Warehouse::orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'nullable|string',
            'floor' => 'nullable|string',
        ]);

        // 🚀 ท่าไม้ตาย: บังคับยัดค่าตรงๆ ทีละช่องทะลุทุกการบล็อก!
        $warehouse = new Warehouse();
        $warehouse->name = $request->name;
        $warehouse->location = $request->location;
        $warehouse->floor = $request->floor;
        // 🚀 บังคับดึง company_id มาใส่ (ถ้าดึงไม่ได้ให้บังคับใส่เลข 1 เป็นค่าเริ่มต้น)
        $warehouse->company_id = $request->user()->company_id;

        // สั่งบันทึก
        $warehouse->save();

        return response()->json([
            'message' => 'เพิ่มคลังสินค้าสำเร็จ',
            'data' => $warehouse
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'nullable|string',
            'floor' => 'nullable|string',
        ]);

        $warehouse = Warehouse::findOrFail($id);

        $warehouse->name = $request->name;
        $warehouse->location = $request->location;
        $warehouse->floor = $request->floor;
        $warehouse->company_id = $request->user()->company_id;

        $warehouse->save();

        return response()->json([
            'message' => 'อัปเดตคลังสินค้าสำเร็จ',
            'data' => $warehouse
        ]);
    }

    public function destroy($id)
    {
        $warehouse = Warehouse::findOrFail($id);
        $warehouse->delete();
        return response()->json(['message' => 'ลบคลังสินค้าสำเร็จ']);
    }
}
