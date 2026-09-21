<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ContactController extends Controller
{
    // ==========================================
    // 1. ดึงข้อมูลทั้งหมด (หุ้มเกราะ Try-Catch ป้องกันขยะ)
    // ==========================================
    public function index(Request $request)
    {
        try {
            $query = Contact::orderBy('created_at', 'desc');

            // รองรับการค้นหา (ทำงานได้ทั้งหน้า Contact หลัก และหน้า Dropdown ของเรา)
            if ($search = $request->input('search')) {
                $query->where(function ($q) use ($search) {
                    $q->where('contact_code', 'like', "%{$search}%")
                        ->orWhere('business_name', 'like', "%{$search}%")
                        ->orWhere('tax_id', 'like', "%{$search}%");
                });
            }

            // 🚀 แก้ไขตรงนี้: เพิ่มการดักจับ $request->has('per_page') เข้าไปด้วย
            // ถ้า Dropdown ส่ง per_page=20 มา มันจะเข้าเงื่อนไขนี้และคืนค่าแค่ 20 รายการ
            if ($request->has('page') || $request->has('per_page')) {
                $perPage = $request->input('per_page', 15);
                return response()->json($query->paginate($perPage));
            }

            // ถ้าไม่ส่ง page หรือ per_page มา ให้ดึงทั้งหมดแบบเดิม (หน้า Contact หลักจะปลอดภัย 100%)
            // 🛡️ แต่ใส่เพดานไว้กันรายการโตไม่มีที่สิ้นสุดทำให้ query/response หนักขึ้นเรื่อยๆ (เดิมไม่มี limit เลย)
            $contacts = $query->limit(2000)->get();
            return response()->json($contacts);
        } catch (\Throwable $e) {
            // ถ้ามี Error เกิดขึ้น ให้ส่งกลับเป็น JSON [cite: 148, 149]
            return response()->json([
                'message' => 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ติดต่อ',
                'error_detail' => $e->getMessage(),
                'line' => $e->getLine(),
                'file' => $e->getFile()
            ], 500);
        }
    }

    // public function index(Request $request)
    // {
    //     try {
    //         $query = Contact::orderBy('created_at', 'desc');

    //         // รองรับการค้นหา (ถ้าหน้าเว็บมีส่งค่า search มา)
    //         if ($search = $request->input('search')) {
    //             $query->where(function ($q) use ($search) {
    //                 $q->where('contact_code', 'like', "%{$search}%")
    //                   ->orWhere('business_name', 'like', "%{$search}%")
    //                   ->orWhere('tax_id', 'like', "%{$search}%");
    //             });
    //         }

    //         // ถ้าหน้าเว็บส่ง page มา แสดงว่าต้องการแบบแบ่งหน้า (Pagination)
    //         if ($request->has('page')) {
    //             $perPage = $request->input('per_page', 15);
    //             return response()->json($query->paginate($perPage));
    //         }

    //         // ถ้าไม่ส่ง page มา ให้ดึงทั้งหมดแบบเดิม
    //         $contacts = $query->get();
    //         return response()->json($contacts);

    //     } catch (\Throwable $e) {
    //         // ถ้ามี Error เกิดขึ้น ให้ส่งกลับเป็น JSON แทนที่จะปล่อย PHP พ่นขยะออกมา
    //         return response()->json([
    //             'message' => 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ติดต่อ',
    //             'error_detail' => $e->getMessage(),
    //             'line' => $e->getLine(),
    //             'file' => $e->getFile()
    //         ], 500);
    //     }
    // }

    // ==========================================
    // 2. บันทึกข้อมูลใหม่
    // ==========================================
    public function store(Request $request)
    {
        $validated = $request->validate([
            'contact_code' => 'required|string|unique:contacts,contact_code',
            'business_name' => 'required|string',
            'contact_type' => 'required|in:company,individual',
            'tax_id' => 'nullable|string|max:13',
            'branch_type' => 'required|in:head_office,branch',
            'branch_code' => 'nullable|string',
            // 🛡️ เดิมไม่มี validation ชนิดไฟล์เลย อัปโหลด .html/.svg ที่ฝัง script ได้ (stored XSS บน storage สาธารณะ)
            'qr_code_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'attachment' => 'nullable|mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx|max:10240',
        ], [
            'contact_code.unique' => 'รหัสผู้ติดต่อนี้มีอยู่ในระบบแล้ว',
        ]);

        if (!empty($request->tax_id)) {
            $existingContacts = Contact::where('tax_id', $request->tax_id)->get();

            if ($existingContacts->isNotEmpty()) {
                if ($request->branch_type === 'head_office') {
                    $hasHeadOffice = $existingContacts->contains('branch_type', 'head_office');
                    if ($hasHeadOffice) {
                        return response()->json([
                            'message' => 'เลขผู้เสียภาษีนี้ ถูกลงทะเบียนเป็นสำนักงานใหญ่ไปแล้ว',
                            'errors' => ['tax_id' => ['เลขผู้เสียภาษีนี้ ถูกลงทะเบียนเป็นสำนักงานใหญ่ไปแล้ว']]
                        ], 422);
                    }
                } elseif ($request->branch_type === 'branch') {
                    if (empty($request->branch_code)) {
                        return response()->json([
                            'message' => 'กรุณาระบุรหัสสาขา',
                            'errors' => ['branch_code' => ['กรุณาระบุรหัสสาขา']]
                        ], 422);
                    }

                    $hasSameBranchCode = $existingContacts->where('branch_type', 'branch')
                        ->where('branch_code', $request->branch_code)
                        ->isNotEmpty();
                    if ($hasSameBranchCode) {
                        return response()->json([
                            'message' => 'รหัสสาขานี้ มีอยู่ในระบบแล้ว',
                            'errors' => ['branch_code' => ['รหัสสาขานี้ มีอยู่ในระบบแล้ว']]
                        ], 422);
                    }
                }
            }
        }

        if ($request->hasFile('qr_code_image')) {
            $validated['qr_code_image'] = $request->file('qr_code_image')->store('contacts/qr_codes', 'public');
        }

        if ($request->hasFile('attachment')) {
            $validated['attachment'] = $request->file('attachment')->store('contacts/attachments', 'public');
        }

        $dataToSave = array_merge($request->all(), $validated);
        $dataToSave['company_id'] = $request->user()->company_id;

        $contact = Contact::create($dataToSave);

        return response()->json([
            'message' => 'บันทึกข้อมูลผู้ติดต่อสำเร็จ!',
            'data' => $contact
        ], 201);
    }

    // ==========================================
    // 2.1 บันทึกผู้ติดต่อแบบย่อ (Quick Create) — สำหรับหน้ารับแจ้งซ่อมเท่านั้น
    // ไม่แตะ store() เดิม เพื่อไม่กระทบฟอร์มสร้างผู้ติดต่อแบบเต็มที่ใช้ที่อื่น
    // ==========================================
    public function quickCreate(Request $request)
    {
        $validated = $request->validate([
            'business_name' => 'required|string|max:255',
        ]);

        // contact_code เป็น unique index แบบ global (ไม่ scope ต่อบริษัท) — ต้องเช็คแบบ withoutGlobalScope('company')
        // ไม่งั้น 2 บริษัทอาจสุ่มรหัสชนกันได้โดยที่ query ปกติ (scope เฉพาะบริษัทตัวเอง) มองไม่เห็น
        do {
            $contactCode = 'WI-' . strtoupper(Str::random(6));
        } while (Contact::withoutGlobalScope('company')->where('contact_code', $contactCode)->exists());

        // ค่า default ตั้งใจให้ต่างจาก default ของ DB (contact_type=company, is_customer=false)
        // เพราะผู้ใช้ endpoint นี้คือลูกค้า walk-in ที่ส่งซ่อมเสมอ ไม่ใช่กรณีทั่วไป
        $contact = Contact::create([
            'company_id' => $request->user()->company_id,
            'contact_code' => $contactCode,
            'business_name' => $validated['business_name'],
            'contact_type' => 'individual',
            'branch_type' => 'head_office',
            'is_customer' => true,
            'is_vendor' => false,
        ]);

        return response()->json(['message' => 'เพิ่มผู้ติดต่อสำเร็จ', 'data' => $contact], 201);
    }

    // ==========================================
    // 3. ดึงข้อมูล 1 รายการ (สำหรับหน้า Edit)
    // ==========================================
    public function show($id)
    {
        $contact = Contact::findOrFail($id);
        return response()->json($contact);
    }

    // ==========================================
    // 4. อัปเดตข้อมูล (สำหรับกด Save ตอน Edit)
    // ==========================================
    public function update(Request $request, $id)
    {
        $contact = Contact::findOrFail($id);

        $validated = $request->validate([
            'contact_code' => 'required|string|unique:contacts,contact_code,' . $id,
            'business_name' => 'required|string',
            'contact_type' => 'required|in:company,individual',
            'tax_id' => 'nullable|string|max:13',
            'branch_type' => 'required|in:head_office,branch',
            'branch_code' => 'nullable|string',
            // 🛡️ เดิมไม่มี validation ชนิดไฟล์เลย อัปโหลด .html/.svg ที่ฝัง script ได้ (stored XSS บน storage สาธารณะ)
            'qr_code_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'attachment' => 'nullable|mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx|max:10240',
        ], [
            'contact_code.unique' => 'รหัสผู้ติดต่อนี้มีอยู่ในระบบแล้ว',
        ]);

        if (!empty($request->tax_id)) {
            $existingContacts = Contact::where('tax_id', $request->tax_id)
                ->where('id', '!=', $id)
                ->get();

            if ($existingContacts->isNotEmpty()) {
                if ($request->branch_type === 'head_office') {
                    $hasHeadOffice = $existingContacts->contains('branch_type', 'head_office');
                    if ($hasHeadOffice) {
                        return response()->json([
                            'message' => 'เลขผู้เสียภาษีนี้ ถูกลงทะเบียนเป็นสำนักงานใหญ่ไปแล้ว',
                            'errors' => ['tax_id' => ['เลขผู้เสียภาษีนี้ ถูกลงทะเบียนเป็นสำนักงานใหญ่ไปแล้ว']]
                        ], 422);
                    }
                } elseif ($request->branch_type === 'branch') {
                    if (empty($request->branch_code)) {
                        return response()->json([
                            'message' => 'กรุณาระบุรหัสสาขา',
                            'errors' => ['branch_code' => ['กรุณาระบุรหัสสาขา']]
                        ], 422);
                    }

                    $hasSameBranchCode = $existingContacts->where('branch_type', 'branch')
                        ->where('branch_code', $request->branch_code)
                        ->isNotEmpty();
                    if ($hasSameBranchCode) {
                        return response()->json([
                            'message' => 'รหัสสาขานี้ มีอยู่ในระบบแล้ว',
                            'errors' => ['branch_code' => ['รหัสสาขานี้ มีอยู่ในระบบแล้ว']]
                        ], 422);
                    }
                }
            }
        }

        if ($request->hasFile('qr_code_image')) {
            if ($contact->qr_code_image) {
                Storage::disk('public')->delete($contact->qr_code_image);
            }
            $validated['qr_code_image'] = $request->file('qr_code_image')->store('contacts/qr_codes', 'public');
        }

        if ($request->hasFile('attachment')) {
            if ($contact->attachment) {
                Storage::disk('public')->delete($contact->attachment);
            }
            $validated['attachment'] = $request->file('attachment')->store('contacts/attachments', 'public');
        }

        $dataToUpdate = array_merge($request->except(['qr_code_image', 'attachment']), $validated);
        $dataToUpdate['company_id'] = $request->user()->company_id;
        $contact->update($dataToUpdate);

        return response()->json([
            'message' => 'อัปเดตข้อมูลสำเร็จ!',
            'data' => $contact
        ]);
    }

    // ==========================================
    // 5. ลบข้อมูล (Restricted Hard Delete)
    // ==========================================
    public function destroy($id)
    {
        $contact = Contact::findOrFail($id);
        $contact->delete();

        return response()->json([
            'message' => 'ลบข้อมูลผู้ติดต่อสำเร็จเรียบร้อย'
        ]);
    }

    // ==========================================
    // 6. สลับสถานะ ระงับ / เปิดใช้งาน
    // ==========================================
    public function toggleStatus($id)
    {
        $contact = Contact::findOrFail($id);
        $contact->is_active = !$contact->is_active;
        $contact->save();

        return response()->json([
            'message' => 'อัปเดตสถานะสำเร็จ',
            'is_active' => $contact->is_active
        ]);
    }
}
