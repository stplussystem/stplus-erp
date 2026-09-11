<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Exports\ContactsExport;
use App\Imports\ContactsImport;
use App\Models\Contact;
use Maatwebsite\Excel\Facades\Excel;

class ContactExcelController extends Controller
{
    // โหลด Template เปล่า
    public function exportTemplate()
    {
        return Excel::download(new ContactsExport(true), 'contact_template.xlsx');
    }

    // 🚀 โหลดข้อมูล (อัปเกรดให้รองรับการฟิลเตอร์ตามที่หน้าเว็บส่งมา)
    public function export(Request $request)
    {
        $query = Contact::query();

        // 1. กรองตามประเภท (Customer / Vendor / Active / Inactive)
        if ($request->filled('type') && $request->type !== 'all') {
            if ($request->type === 'customer') {
                $query->where('is_customer', true);
            } elseif ($request->type === 'vendor') {
                $query->where('is_vendor', true);
            } elseif ($request->type === 'active') {
                $query->where('is_active', true);
            } elseif ($request->type === 'inactive') {
                $query->where('is_active', false);
            }
        }

        // 2. กรองตามคำค้นหา (Search)
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('contact_code', 'like', "%{$search}%")
                    ->orWhere('business_name', 'like', "%{$search}%")
                    ->orWhere('contact_person_name', 'like', "%{$search}%")
                    ->orWhere('office_phone', 'like', "%{$search}%")
                    ->orWhere('mobile', 'like', "%{$search}%")
                    ->orWhere('tax_id', 'like', "%{$search}%");
            });
        }

        // 3. ดึงข้อมูลที่ผ่านการกรองแล้ว
        $contacts = $query->orderBy('created_at', 'desc')->get();

        // 4. สร้างชื่อไฟล์แบบไดนามิก ดึงเวลาปัจจุบันมาต่อท้าย (รูปแบบ: ปีเดือนวันชั่วโมงนาที) ผลลัพธ์จะได้หน้าตาแบบนี้: contacts_data_202602111350.xlsx
        $fileName = 'contacts_data_' . now()->format('YmdHi') . '.xlsx';

        // 4. โยน $contacts ที่กรองแล้วเข้าไปให้คลาส Excel ทำงานต่อ
        return Excel::download(new ContactsExport(false, $contacts), $fileName);
    }

    // นำเข้าข้อมูล
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv'
        ]);

        try {
            Excel::import(new ContactsImport, $request->file('file'));
            return response()->json(['message' => 'นำเข้าข้อมูลสำเร็จ!']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }
}
