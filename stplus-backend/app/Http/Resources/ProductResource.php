<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_type' => $this->product_type,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'model_name' => $this->model_name,
            'price' => (float) $this->price,
            'vat_type' => $this->vat_type,
            'has_serial_number' => (bool) $this->has_serial_number,
            'image_url' => $this->image ? asset('storage/' . $this->image) : null,

            // ส่ง ID ของ Master Data ออกมาด้วย เพื่อให้หน้าแก้ไขดึงไปเช็คค่าได้ง่าย
            'category_id' => $this->category_id,
            'brand_id' => $this->brand_id,
            'unit_id' => $this->unit_id,

            'category' => $this->whenLoaded('category'),
            'brand' => $this->whenLoaded('brand'),
            'unit' => $this->whenLoaded('unit'), // เพิ่มความสัมพันธ์หน่วยนับ
        ];
    }
}
