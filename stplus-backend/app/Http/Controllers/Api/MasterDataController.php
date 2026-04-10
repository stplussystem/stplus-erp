<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\ProductCategory;
use App\Models\Unit;
use Illuminate\Http\Request;

class MasterDataController extends Controller
{
    // ฟังก์ชันสำหรับดึงข้อมูล (ที่เราทำไว้รอบที่แล้ว)
    public function getProductOptions()
    {
        return response()->json([
            'brands' => Brand::select('id', 'name')->get(),
            'categories' => ProductCategory::select('id', 'name')->get(),
            'units' => Unit::select('id', 'name')->get(),
        ]);
    }

    // 💡 ฟังก์ชันใหม่! สำหรับบันทึกข้อมูลที่กด "+ เพิ่ม..." จากหน้าเว็บ
    public function store(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:brand,category,unit',
            'name' => 'required|string|max:255'
        ]);

        $type = $validated['type'];
        $name = $validated['name'];
        $companyId = 1; // ในอนาคตดึงจากบริษัทที่ Login

        if ($type === 'brand') {
            // firstOrCreate คือ ถ้ามีชื่อนี้อยู่แล้วให้ดึงมา ถ้าไม่มีให้สร้างใหม่
            $item = Brand::firstOrCreate(['name' => $name, 'company_id' => $companyId]);
        } elseif ($type === 'category') {
            $item = ProductCategory::firstOrCreate(['name' => $name, 'company_id' => $companyId]);
        } else {
            // Unit ไม่มี company_id
            $item = Unit::firstOrCreate(['name' => $name]);
        }

        return response()->json([
            'message' => 'Created successfully',
            'data' => $item
        ]);
    }
}
