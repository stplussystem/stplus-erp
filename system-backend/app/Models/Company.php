<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Facades\Storage; // 🚀 เพิ่มบรรทัดนี้

class Company extends Model
{
    protected $fillable = [
        'name',
        'is_approved',
        'tax_id',
        'phone',
        'address',
        'logo',
        'bank_account',
        'payment_terms'
    ];

    // 🚀 เพิ่มบรรทัดนี้ เพื่อให้ส่งค่า logo_base64 แนบไปกับ API เสมอ
    protected $appends = ['logo_base64', 'quotation_header_background_base64', 'a4_watermark_background_base64'];

    // 🚀 user ทั้งหมดที่ได้รับสิทธิ์เข้าใช้งานบริษัทนี้ (ผ่าน company_user)
    public function users()
    {
        return $this->belongsToMany(User::class, 'company_user')
            ->withPivot('granted_by')
            ->withTimestamps();
    }

    protected function casts(): array
    {
        return [
            'document_settings' => 'array',
            'is_approved' => 'boolean',
        ];
    }

    // Accessor เดิม (เอาไว้แสดงบนเว็บปกติ)
    protected function logo(): Attribute
    {
        return Attribute::make(
            get: function (?string $value) {
                if (!$value) return null;
                if (str_starts_with($value, 'http')) return $value;
                return asset('storage/' . $value);
            },
        );
    }

    // 🚀 Accessor ใหม่ (แปลงรูปเป็นรหัส Base64 สำหรับส่งให้ PDF โดยเฉพาะ)
    protected function logoBase64(): Attribute
    {
        return Attribute::make(
            get: function () {
                // ดึงชื่อไฟล์ดิบๆ จาก Database (เช่น company/1779161324_logo.png)
                $rawLogo = $this->attributes['logo'] ?? null;

                if (!$rawLogo) return null;
                if (str_starts_with($rawLogo, 'http')) return $rawLogo;

                try {
                    // เช็คว่ามีไฟล์รูปอยู่จริงใน Storage ไหม
                    if (Storage::disk('public')->exists($rawLogo)) {
                        $file = Storage::disk('public')->get($rawLogo);
                        $extension = pathinfo($rawLogo, PATHINFO_EXTENSION);

                        // แปลงรูปเป็น Base64
                        return 'data:image/' . $extension . ';base64,' . base64_encode($file);
                    }
                } catch (\Exception $e) {
                    return null;
                }

                return null;
            }
        );
    }

    // 🚀 รูปกราฟิกพื้นหลังหัวกระดาษใบเสนอราคา — แปลงเป็น Base64 เหมือน logoBase64() ด้านบน
    // เหตุผลเดียวกัน: <Image src="..."> ของ @react-pdf/renderer fetch รูปจาก URL ตรงๆ ฝั่ง browser
    // แล้วโดน CORS บล็อก (คนละ origin กับ frontend) ต้องส่งเป็น data URI แนบมากับ API แทน
    protected function quotationHeaderBackgroundBase64(): Attribute
    {
        return Attribute::make(
            get: function () {
                $rawPath = $this->document_settings['quotation_header_background_path'] ?? null;
                if (!$rawPath) return null;

                try {
                    if (Storage::disk('public')->exists($rawPath)) {
                        $file = Storage::disk('public')->get($rawPath);
                        $extension = pathinfo($rawPath, PATHINFO_EXTENSION);

                        return 'data:image/' . $extension . ';base64,' . base64_encode($file);
                    }
                } catch (\Exception $e) {
                    return null;
                }

                return null;
            }
        );
    }

    // 🚀 รูปกราฟิกพื้นหลังจางเต็มหน้า (watermark) ของเอกสารขาย A4 ทุกประเภท — คนละรูปกับ
    // quotationHeaderBackgroundBase64() ด้านบน (คนละ key ใน document_settings) แปลงเป็น Base64 ด้วยเหตุผลเดียวกัน
    protected function a4WatermarkBackgroundBase64(): Attribute
    {
        return Attribute::make(
            get: function () {
                $rawPath = $this->document_settings['a4_watermark_background_path'] ?? null;
                if (!$rawPath) return null;

                try {
                    if (Storage::disk('public')->exists($rawPath)) {
                        $file = Storage::disk('public')->get($rawPath);
                        $extension = pathinfo($rawPath, PATHINFO_EXTENSION);

                        return 'data:image/' . $extension . ';base64,' . base64_encode($file);
                    }
                } catch (\Exception $e) {
                    return null;
                }

                return null;
            }
        );
    }
}
