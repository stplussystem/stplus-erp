<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductPriceList extends Model
{
    use \App\Traits\BelongsToCompany;

    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'expiry_date' => 'date',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Contact::class, 'contact_id');
    }

    // 🚀 จุดเดียวที่สร้าง/แก้แถวราคา — ใช้ร่วมกันทั้ง API แก้ไขเองด้วยมือ และตัวนำเข้า Excel เพื่อไม่ให้ลอจิก
    // "จำราคาก่อนหน้า + คำนวณเทรนด์ขึ้น/ลง/คงที่อัตโนมัติ" ซ้ำกันคนละที่แล้วพลาดไม่ตรงกัน
    //
    // กติกาเทรนด์: ถ้าไฟล์/ฟอร์มระบุ price_trend มาเอง (ไม่ใช่ null/ว่าง) ให้ใช้ค่านั้นตรงๆ (ผู้กรอกตั้งใจ
    // ระบุเอง) — ไม่งั้นคำนวณจากราคาใหม่เทียบกับราคาเดิมของแถวนี้ (ไม่มีแถวเดิม = ครั้งแรก ถือว่า "คงที่")
    public static function applyUpdate(array $data): self
    {
        $existing = static::where('company_id', $data['company_id'])
            ->where('product_id', $data['product_id'])
            ->where('contact_id', $data['contact_id'])
            ->first();

        $previousPrice = $existing->price ?? null;
        $newPrice = (float) $data['price'];

        $trend = $data['price_trend'] ?? null;
        if (!$trend) {
            if ($previousPrice === null || $newPrice == $previousPrice) {
                $trend = 'stable';
            } else {
                $trend = $newPrice > $previousPrice ? 'up' : 'down';
            }
        }

        $payload = [
            'company_id' => $data['company_id'],
            'product_id' => $data['product_id'],
            'contact_id' => $data['contact_id'],
            'price' => $newPrice,
            'previous_price' => $previousPrice,
            'discount_percent' => $data['discount_percent'] ?? null,
            'price_trend' => $trend,
            'expiry_date' => $data['expiry_date'] ?? null,
            'note' => $data['note'] ?? null,
            'import_batch_id' => $data['import_batch_id'] ?? null,
        ];

        if ($existing) {
            $existing->update($payload);
            return $existing;
        }

        return static::create($payload);
    }
}
