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

        // ป้องกันกรณีหน้าเว็บไม่ได้ส่งค่า sn มา
        if (!$sn) {
            return response()->json(['message' => 'กรุณาระบุ Serial Number'], 400);
        }

        // ค้นหา S/N ในฐานข้อมูล
        $serial = ProductSerial::where('serial_number', $sn)->first();

        if ($serial) {
            // ถ้าเจอ ส่งสถานะ และ product_id กลับไปบอกหน้าบ้าน
            // 🔧 [เพิ่มใหม่] ถ้าเคยขายไปแล้ว ส่งข้อมูลเอกสารขาย/ลูกค้าที่ผูกไว้ด้วย — ใช้ตอนรับแจ้งซ่อม auto-fill ลูกค้า
            $data = [
                'exists' => true,
                'id' => $serial->id,
                'status' => $serial->status,
                'product_id' => $serial->product_id,
            ];

            if ($serial->sold_to_sale_document_id) {
                $saleDocument = $serial->soldToSaleDocument()->with('contact:id,business_name')->first();
                $data['sold_at'] = $serial->sold_at;
                $data['sold_to_sale_document_id'] = $serial->sold_to_sale_document_id;
                $data['sold_document_number'] = $saleDocument?->document_number;
                $data['contact_id'] = $saleDocument?->contact_id;
                $data['contact_name'] = $saleDocument?->contact?->business_name;
                $data['project_id'] = $saleDocument?->project_id;
            }

            return response()->json($data);
        }

        // ถ้าไม่เจอ แสดงว่า S/N นี้ใหม่เอี่ยม (พร้อมรับเข้าคลัง)
        return response()->json(['exists' => false]);
    }
}
