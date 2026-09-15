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
    // 🎨 ถ้าตั้งค่า a4_watermark_grayscale ไว้ ให้แปลงเป็นขาวดำก่อน — ทำฝั่ง backend ด้วย GD เพราะ react-pdf
    // (ฝั่งพิมพ์ PDF จริง) ไม่รองรับ CSS filter/grayscale เลย ต่างจาก preview ในหน้า editor ที่ใช้ CSS filter ได้ตรงๆ
    protected function a4WatermarkBackgroundBase64(): Attribute
    {
        return Attribute::make(
            get: function () {
                $rawPath = $this->document_settings['a4_watermark_background_path'] ?? null;
                if (!$rawPath) return null;

                try {
                    if (Storage::disk('public')->exists($rawPath)) {
                        $file = Storage::disk('public')->get($rawPath);
                        $extension = strtolower(pathinfo($rawPath, PATHINFO_EXTENSION));

                        if (($this->document_settings['a4_watermark_grayscale'] ?? false) && extension_loaded('gd')) {
                            $grayFile = $this->convertImageToGrayscale($file, $extension);
                            if ($grayFile !== null) {
                                $file = $grayFile;
                            }
                        }

                        return 'data:image/' . $extension . ';base64,' . base64_encode($file);
                    }
                } catch (\Exception $e) {
                    return null;
                }

                return null;
            }
        );
    }

    // 🎨 แปลงข้อมูลรูปดิบเป็นขาวดำด้วย GD — คืนค่า null เมื่อแปลงไม่สำเร็จ (รูปเสีย/นามสกุลไม่รองรับ) เพื่อให้
    // caller fallback ไปใช้รูปสีเดิมแทนการพังทั้งฟีเจอร์
    private function convertImageToGrayscale(string $fileContents, string $extension): ?string
    {
        try {
            $image = @imagecreatefromstring($fileContents);
            if (!$image) return null;

            imagefilter($image, IMG_FILTER_GRAYSCALE);

            ob_start();
            switch ($extension) {
                case 'png':
                    imagesavealpha($image, true);
                    imagepng($image);
                    break;
                case 'webp':
                    if (function_exists('imagewebp')) {
                        imagewebp($image);
                    } else {
                        imagepng($image);
                    }
                    break;
                case 'jpg':
                case 'jpeg':
                default:
                    imagejpeg($image, null, 90);
                    break;
            }
            $result = ob_get_clean();
            imagedestroy($image);

            return $result !== false ? $result : null;
        } catch (\Exception $e) {
            return null;
        }
    }
}
