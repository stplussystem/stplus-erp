<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Throwable;

class CompanyController extends Controller
{
    public function index()
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json(Company::all());
    }

    public function show()
    {
        try {
            $company = Company::find(auth()->user()->company_id);
            if (!$company) {
                return response()->json(null);
            }
            return response()->json($company);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        }
    }

    public function update(Request $request)
    {
        try {
            $company = Company::find(auth()->user()->company_id);
            if (!$company) {
                $company = new Company();
            }

            $company->name = $request->name;
            $company->tax_id = $request->tax_id;
            $company->phone = $request->phone;
            $company->address = $request->address;

            if ($request->has('document_settings')) {
                $company->document_settings = is_string($request->document_settings)
                    ? json_decode($request->document_settings, true)
                    : $request->document_settings;
            }

            // จัดการลบ/เพิ่มรูปภาพด้วย Regex ที่ชาญฉลาด (รองรับทั้ง URL เก่าและ Path ใหม่)
            if ($request->has('remove_logo') && $request->remove_logo == '1') {
                $rawLogo = $company->getRawOriginal('logo');
                if ($rawLogo) {
                    $oldPath = preg_replace('/^.*\/storage\//', '', $rawLogo);
                    if (Storage::disk('public')->exists($oldPath)) {
                        Storage::disk('public')->delete($oldPath);
                    }
                }
                $company->logo = null;
            } elseif ($request->hasFile('logo')) {
                $rawLogo = $company->getRawOriginal('logo');
                if ($rawLogo) {
                    $oldPath = preg_replace('/^.*\/storage\//', '', $rawLogo);
                    if (Storage::disk('public')->exists($oldPath)) {
                        Storage::disk('public')->delete($oldPath);
                    }
                }
                $file = $request->file('logo');
                $filename = time() . '_logo.' . $file->getClientOriginalExtension();
                $path = $file->storeAs('company', $filename, 'public');

                // 🚀 เซฟแค่ Relative Path ลงฐานข้อมูล
                $company->logo = $path;
            }

            $company->save();

            return response()->json([
                'message' => 'บันทึกข้อมูลบริษัทและตั้งค่าสำเร็จ',
                'data' => $company
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        }
    }

    // POST /api/company/letter-layout-background/{group}/{paperSize} — อัปโหลดรูปถ่ายกระดาษหัวจดหมายตัวจริงของแต่ละกลุ่มเอกสาร
    // × แต่ละขนาดกระดาษ (A4/Letter คนละรูปกันได้ เพราะเป็นกระดาษคนละใบจริงๆ) ใช้เป็นพื้นหลังอ้างอิงบนหน้าจอเท่านั้น (ไม่พิมพ์ลง PDF จริง)
    // path เก็บแยกอยู่ใน document_settings.a4_layout_background_paths[group] / letter_layout_background_paths[group] ตามขนาดกระดาษ
    // 🛡️ validate ชนิดไฟล์เข้มงวดตาม pattern เดียวกับ SaleDocumentController::uploadCustomLogo()
    // 🛡️ $group/$paperSize default เป็น "shared"/"Letter" เพื่อ backward-compat กับโค้ด/คำเรียกเก่าที่ไม่ส่ง param มา (route เก่าไม่มี {group}/{paperSize})
    public function uploadLetterLayoutBackground(Request $request, string $group = 'shared', string $paperSize = 'Letter')
    {
        if (!in_array($group, ['shared', 'delivery_note', 'purchase_order', 'goods_receipt', 'contractor_work_order', 'receipt_voucher', 'stock_movement'])) {
            return response()->json(['message' => 'ประเภทเอกสารไม่ถูกต้อง'], 422);
        }
        if (!in_array($paperSize, ['A4', 'Letter', 'HalfLetter'])) {
            return response()->json(['message' => 'ขนาดกระดาษไม่ถูกต้อง'], 422);
        }

        $request->validate([
            'background' => 'required|image|mimes:jpeg,png,jpg,webp|max:4096',
        ]);

        $path = $request->file('background')->store("company/letter_layout_backgrounds/{$paperSize}/{$group}", 'public');

        return response()->json(['path' => $path, 'url' => Storage::disk('public')->url($path)]);
    }

    // POST /api/company/quotation-header-background — อัปโหลดรูปกราฟิกพื้นหลังหัวกระดาษใบเสนอราคา (พิมพ์ลง PDF จริง)
    // แสดงฝั่งขวาของหัวกระดาษ ใต้ข้อความ "ใบเสนอราคา" — path เก็บแยกอยู่ใน document_settings.quotation_header_background_path
    public function uploadQuotationHeaderBackground(Request $request)
    {
        $request->validate([
            'background' => 'required|image|mimes:jpeg,png,jpg,webp|max:4096',
        ]);

        $path = $request->file('background')->store('company/quotation_header_backgrounds', 'public');

        return response()->json(['path' => $path, 'url' => Storage::disk('public')->url($path)]);
    }

    // POST /api/company/print-layout-background/{group} — อัปโหลดรูปถ่ายกระดาษหัวจดหมายตัวจริงของแต่ละกลุ่มเอกสาร
    // (tax_invoice/receipt คนละใบกัน — delivery_note ย้ายไปใช้ uploadLetterLayoutBackground() แล้ว) ใช้เป็นพื้นหลังอ้างอิงบนหน้าจอเท่านั้น (ไม่พิมพ์ลง PDF จริง)
    // pattern เดียวกับ uploadLetterLayoutBackground() ด้านบน แต่แยกโฟลเดอร์ต่อกลุ่มเพราะแต่ละกลุ่มมีรูปพื้นหลังอ้างอิงคนละรูป
    public function uploadPrintLayoutBackground(Request $request, string $group, string $paperSize = 'Letter')
    {
        if (!in_array($group, ['tax_invoice', 'receipt'])) {
            return response()->json(['message' => 'ประเภทเอกสารไม่ถูกต้อง'], 422);
        }
        if (!in_array($paperSize, ['A4', 'Letter', 'HalfLetter'])) {
            return response()->json(['message' => 'ขนาดกระดาษไม่ถูกต้อง'], 422);
        }

        $request->validate([
            'background' => 'required|image|mimes:jpeg,png,jpg,webp|max:4096',
        ]);

        $path = $request->file('background')->store("company/print_layout_backgrounds/{$paperSize}/{$group}", 'public');

        return response()->json(['path' => $path, 'url' => Storage::disk('public')->url($path)]);
    }

    // POST /api/company/a4-watermark-background — อัปโหลดรูปพื้นหลังจางเต็มหน้า (watermark) ของเอกสารขาย A4 ทุกประเภท
    // คนละรูปกับพื้นหลังหัวกระดาษใบเสนอราคา (uploadQuotationHeaderBackground ด้านบน) — path เก็บแยกที่ document_settings.a4_watermark_background_path
    public function uploadA4WatermarkBackground(Request $request)
    {
        $request->validate([
            'background' => 'required|image|mimes:jpeg,png,jpg,webp|max:4096',
        ]);

        $path = $request->file('background')->store('company/a4_watermark_backgrounds', 'public');

        return response()->json(['path' => $path, 'url' => Storage::disk('public')->url($path)]);
    }

    // GET /api/register-company-visibility — 🌐 public (ไม่ต้อง auth) หน้า /login ต้องเรียกได้ก่อน login
    // เพื่อรู้ว่าจะโชว์ลิงก์ "สร้างระบบสำหรับบริษัทคุณ" ไหม — คุมจาก Platform Admin ผ่านหน้า
    // /company/register-settings (ดู getRegisterCompanySetting/updateRegisterCompanySetting ด้านล่าง)
    public function getRegisterCompanyVisibility()
    {
        return response()->json([
            'visible' => SystemSetting::getBool('show_register_company_link', true),
        ]);
    }

    // GET /api/settings/register-company-visibility — เฉพาะ Platform Admin (เจ้าของระบบ) เท่านั้น ไม่ใช่
    // Super Admin ของ tenant ไหนก็ได้ — ตั้งใจไม่ผูกกับระบบ permission ปกติ เพราะ Super Admin ของทุกบริษัท
    // ได้ permission ครบทุกตัวเท่ากันหมด (ดู UserSessionFormatter::format()) ถ้าทำเป็น permission ธรรมดา
    // จะเห็นเมนูนี้ไปด้วยทั้งที่ควรเห็นเฉพาะเจ้าของระบบ
    public function getRegisterCompanySetting()
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin เท่านั้น'], 403);
        }
        return response()->json([
            'show_register_company_link' => SystemSetting::getBool('show_register_company_link', true),
        ]);
    }

    // PATCH /api/settings/register-company-visibility
    public function updateRegisterCompanySetting(Request $request)
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin เท่านั้น'], 403);
        }
        $request->validate(['enabled' => 'required|boolean']);
        SystemSetting::setBool('show_register_company_link', $request->boolean('enabled'));

        return response()->json(['message' => 'บันทึกการตั้งค่าสำเร็จ']);
    }
}
