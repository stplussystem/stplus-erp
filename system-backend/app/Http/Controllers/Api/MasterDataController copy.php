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

        // 🚀 ลบ $companyId = 1 ทิ้งไปได้เลยครับ ให้ Trait จัดการเอง

        if ($type === 'brand') {
            $item = Brand::firstOrCreate(['name' => $name]);
        } elseif ($type === 'category') {
            $item = ProductCategory::firstOrCreate(['name' => $name]);
        } else {
            // 🚀 ตอนนี้ Unit เป็นระบบ SaaS แล้ว ใช้คำสั่งเหมือนเพื่อนๆ ได้เลย!
            $item = Unit::firstOrCreate(['name' => $name]);
        }

        return response()->json([
            'message' => 'Created successfully',
            'data' => $item
        ]);
    }
}
