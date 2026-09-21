<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ProductSerial;
use App\Models\InstallationRecord;

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
                // 🚀 ให้หน้าโอนย้ายคลัง (/stock/transfer) เช็คฝั่ง frontend ได้ทันทีว่า S/N นี้อยู่คลังต้นทาง
                // ที่เลือกไว้จริงไหม ก่อนส่ง submit (backend endpoint ยัง validate ซ้ำเป็นด่านสุดท้ายเหมือนเดิม)
                'warehouse_id' => $serial->warehouse_id,
            ];

            // 🆕 [2026-09-21] ข้อมูลประกันของ S/N นี้ (ใช้ที่หน้ารับแจ้งซ่อม repairs/create เพื่อติ๊ก "อยู่ในประกัน"/"หมดประกัน" ให้อัตโนมัติ)
            // ระบบเก็บระยะประกันไว้ที่เดียวคือตอนบันทึกงานติดตั้ง (installation_records.warranty_expires_at) — เอารายการติดตั้งที่ติดตั้งแล้ว
            // และมีวันหมดประกันล่าสุดของ S/N นี้ ถ้าไม่มี = null (หน้าเว็บให้ผู้ใช้เลือกเอง) ไม่ตัดสินสถานะที่นี่
            // เพราะขึ้นกับ "วันที่รับเครื่อง" ที่ผู้ใช้ปรับได้ในฟอร์ม
            $installation = InstallationRecord::where('product_serial_id', $serial->id)
                ->where('status', 'installed')
                ->whereNotNull('warranty_expires_at')
                ->orderByDesc('installed_at')
                ->orderByDesc('id')
                ->first(['id', 'installation_number', 'installed_at', 'warranty_months', 'warranty_expires_at']);
            $data['warranty'] = $installation ? [
                'expires_at' => $installation->warranty_expires_at?->format('Y-m-d'),
                'months' => $installation->warranty_months,
                'installed_at' => $installation->installed_at?->format('Y-m-d'),
                'installation_number' => $installation->installation_number,
            ] : null;

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
