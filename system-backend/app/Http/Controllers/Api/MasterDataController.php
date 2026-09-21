<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\ProductCategory;
use App\Models\Unit;
use Illuminate\Http\Request;

class MasterDataController extends Controller
{
    // ==========================================
    // 1. ฟังก์ชันดึงข้อมูล (เพิ่ม where ป้องกันข้อมูลบริษัทอื่นปนมา)
    // ==========================================
    public function getProductOptions(Request $request)
    {
        $companyId = $request->user()->company_id; // 🚀 ดึงเฉพาะของบริษัทตัวเอง

        return response()->json([
            'brands' => Brand::select('id', 'name')->where('company_id', $companyId)->get(),
            'categories' => ProductCategory::select('id', 'name')->where('company_id', $companyId)->get(),
            'units' => Unit::select('id', 'name')->where('company_id', $companyId)->get(),
        ]);
    }

    // ==========================================
    // 2. ฟังก์ชันบันทึกข้อมูลใหม่ (ยัด company_id ลงไปตรงๆ)
    // ==========================================
    public function store(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:brand,category,unit',
            'name' => 'required|string|max:255'
        ]);

        $type = $validated['type'];
        $name = $validated['name'];

        // 🚀 พระเอกของเรา! ดึงมาประกาศไว้เลย
        $companyId = $request->user()->company_id;

        if ($type === 'brand') {
            $item = Brand::firstOrCreate(
                ['name' => $name, 'company_id' => $companyId], // 🔍 หาจากชื่อและบริษัทนี้
                ['company_id' => $companyId]                   // 💾 ถ้าไม่มี ให้สร้างใหม่โดยยัดบริษัทนี้ลงไป
            );
        } elseif ($type === 'category') {
            $item = ProductCategory::firstOrCreate(
                ['name' => $name, 'company_id' => $companyId],
                ['company_id' => $companyId]
            );
        } else {
            $item = Unit::firstOrCreate(
                ['name' => $name, 'company_id' => $companyId],
                ['company_id' => $companyId]
            );
        }

        return response()->json([
            'message' => 'Created successfully',
            'data' => $item
        ]);
    }
}
