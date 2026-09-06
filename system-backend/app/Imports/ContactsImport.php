<?php

namespace App\Imports;

use App\Models\Contact;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithStartRow;

class ContactsImport implements ToModel, WithStartRow
{
    public function startRow(): int
    {
        return 2;
    }

    public function model(array $row)
    {
        if (empty($row[0]) || empty($row[1])) {
            return null;
        }

        /*
        // ========================================================
        // 📦 โค้ดแบบที่ 1 (ซ้ำแล้วอัปเดต): เก็บไว้เผื่อใช้ในอนาคต
        // ========================================================
        $contact = Contact::where('contact_code', $row[0])->first() ?? new Contact();

        $contact->contact_code = (string) $row[0];
        $contact->business_name = (string) $row[1];
        $contact->contact_type = ($row[2] == 'บุคคลธรรมดา') ? 'individual' : 'company';

        // 🚀 เปลี่ยนจากตัว Y มาตรวจหาคำว่า "ลูกค้า" และ "ผู้จำหน่าย" แทน
        $contact->is_customer = (trim($row[3]) === 'ลูกค้า') ? 1 : 0;
        $contact->is_vendor = (trim($row[4]) === 'ผู้จำหน่าย') ? 1 : 0;

        $contact->credit_days = $row[5] ?? 0;
        $contact->tax_id = $row[6] ?? null;

        $contact->branch_type = ($row[7] == 'สาขา') ? 'branch' : 'head_office';
        $contact->branch_code = $row[8] ?? null;

        $contact->email = $row[9] ?? null;
        $contact->office_phone = $row[10] ?? null;
        $contact->address = $row[11] ?? null;

        $contact->company_id = 1;
        $contact->save();

        return $contact;
        // ========================================================
        */



        // ========================================================
        // 🚀 โค้ดแบบที่ 2 (ซ้ำแล้วข้าม): ปลอดภัย ป้องกันข้อมูลโดนเขียนทับ
        // ========================================================

        // เช็คว่ามีรหัสลูกค้านี้อยู่ในระบบแล้วหรือยัง
        $isExist = Contact::where('contact_code', $row[0])->exists();

        // ถ้ารหัสซ้ำ ให้ Return Null (แปลว่าข้ามแถวนี้ไปเลย ไม่ต้องเซฟ)
        if ($isExist) {
            return null;
        }

        // ถ้ายังไม่มีรหัสนี้ ให้สร้างรายชื่อใหม่ (Insert)
        $contact = new Contact();

        $contact->contact_code = (string) $row[0];
        $contact->business_name = (string) $row[1];
        $contact->contact_type = ($row[2] == 'บุคคลธรรมดา') ? 'individual' : 'company';

        $contact->is_customer = (trim($row[3]) === 'ลูกค้า') ? 1 : 0;
        $contact->is_vendor = (trim($row[4]) === 'ผู้จำหน่าย') ? 1 : 0;

        $contact->credit_days = $row[5] ?? 0;
        $contact->tax_id = $row[6] ?? null;

        $contact->branch_type = ($row[7] == 'สาขา') ? 'branch' : 'head_office';
        $contact->branch_code = $row[8] ?? null;

        $contact->email = $row[9] ?? null;
        $contact->office_phone = $row[10] ?? null;
        $contact->address = $row[11] ?? null;

        // 🚀 แสตมป์ company_id เองตรงๆ เพราะ BelongsToCompany trait จะไม่ auto-stamp ให้ถ้าผู้ import เป็น Platform Admin
        $contact->company_id = auth()->user()->company_id;

        $contact->save();

        return $contact;
    }
}
