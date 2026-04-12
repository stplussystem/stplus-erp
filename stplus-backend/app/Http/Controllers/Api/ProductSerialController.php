<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ProductSerial;

class ProductSerialController extends Controller
{
    // 💡 ฟังก์ชันเช็ค S/N ว่ามีในระบบและพร้อมขายอยู่หรือไม่
    public function check(Request $request)
    {
        $sn = $request->query('sn');

        // ค้นหา S/N ในฐานข้อมูล
        $serial = ProductSerial::where('serial_number', $sn)->first();

        if ($serial) {
            // ถ้าเจอ ส่งสถานะกลับไปบอกหน้าบ้าน
            return response()->json([
                'exists' => true,
                'status' => $serial->status
            ]);
        }

        // ถ้าไม่เจอ แสดงว่า S/N นี้ใหม่เอี่ยม
        return response()->json(['exists' => false]);
    }
}
