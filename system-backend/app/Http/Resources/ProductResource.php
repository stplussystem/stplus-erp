<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            // ==========================================
            // 1. ข้อมูลพื้นฐานของสินค้า
            // ==========================================
            'id' => $this->id,
            'product_type' => $this->product_type,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'model_name' => $this->model_name,
            'price' => (float) $this->price,
            'vat_type' => $this->vat_type,
            'has_serial_number' => (bool) $this->has_serial_number,
            'low_stock_threshold' => $this->low_stock_threshold,
            'image_url' => $this->image ? asset('storage/' . $this->image) : null,

            // 🚀 เพิ่มคอลัมน์นี้เข้าไปเพื่อให้ API ส่งสถานะออกไปหาหน้าเว็บได้อย่างถูกต้องครับ
            'is_active' => $this->is_active,

            // 🎪 ป้ายกำกับ ขาย/เช่า/งานติดตั้ง — ใช้กรองสินค้าในหน้าเบิกสินค้างานเช่า
            'can_sell' => (bool) $this->can_sell,
            'can_rent' => (bool) $this->can_rent,
            'is_install_job' => (bool) $this->is_install_job,

            // 📦 สินค้าชุด (Bundle) — ไม่มีสต๊อกของตัวเอง ขายเป็น 1 บรรทัดราคาชุด แต่ตัดสต๊อกตามส่วนประกอบจริง
            // แนบสูตรส่วนประกอบมาด้วยเลยตอน search สินค้า เพื่อให้หน้าเอกสารขายขยายแถวลูกได้ทันทีไม่ต้องยิง request เพิ่ม
            'is_bundle' => (bool) $this->is_bundle,
            'bundle_items' => $this->whenLoaded('bundleItems', function () {
                return $this->bundleItems->map(fn ($bi) => [
                    'component_product_id' => $bi->component_product_id,
                    'name' => $bi->componentProduct?->name,
                    'sku' => $bi->componentProduct?->sku,
                    'unit_name' => $bi->componentProduct?->unit?->name ?? 'ชิ้น',
                    'has_serial_number' => (bool) $bi->componentProduct?->has_serial_number,
                    'quantity' => (float) $bi->quantity,
                ]);
            }),

            // ==========================================
            // 2. ข้อมูล Master Data (ส่ง ID ไปให้หน้าแก้ไขดึงไปตั้งค่า)
            // ==========================================
            'category_id' => $this->category_id,
            'brand_id' => $this->brand_id,
            'unit_id' => $this->unit_id,

            // ==========================================
            // 3. ข้อมูลที่ดึงพ่วงมาด้วย (Relations)
            // ==========================================
            'category' => $this->whenLoaded('category'),
            'brand' => $this->whenLoaded('brand'),
            'unit' => $this->whenLoaded('unit'),

            // ==========================================
            // 4. ข้อมูลสต็อก และ จำนวน S/N (หัวใจสำคัญ!)
            // ==========================================

            // 💡 ส่งข้อมูลสต็อกคงเหลือ (qty) ไปที่หน้าบ้าน
            'stock_balance' => $this->whenLoaded('stockBalance'),

            // ส่งตัวเลขจำนวน S/N จริงๆ ที่นับได้ (จาก withCount ใน Controller) กลับไปด้วย!
            'available_serials_count' => $this->available_serials_count,
        ];
    }
}
