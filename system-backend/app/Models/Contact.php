<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Contact extends Model
{
    use \App\Traits\BelongsToCompany;

    use HasFactory;

    // 🛡️ เดิม guarded=[] เปิดให้บันทึกได้ทุกฟิลด์แบบไม่มีขอบเขต — ตอนนี้ company_id ถูกเขียนทับเสมอใน
    // ContactController หลัง merge request จึงยังไม่ใช่ช่องโหว่วันนี้ แต่ปิดเป็น whitelist ไว้กันคอลัมน์
    // อ่อนไหวใหม่ในอนาคตกลายเป็น mass-assignable อัตโนมัติโดยไม่มีใครตั้งใจเปิดไว้
    protected $fillable = [
        'company_id', 'contact_type', 'is_customer', 'is_vendor', 'credit_days', 'business_location',
        'contact_code', 'business_name', 'tax_id', 'branch_type', 'branch_code',
        'address', 'zipcode', 'delivery_address', 'office_phone', 'fax', 'website',
        'contact_person_name', 'email', 'mobile',
        'bank_name', 'account_name', 'account_number', 'branch_name', 'account_type',
        'qr_code_image', 'has_foreign_bank', 'swift_code', 'bank_address', 'attachment',
        'note', 'is_active',
    ];

    // ให้ Laravel แปลง 0/1 เป็น false/true ให้อัตโนมัติ
    protected $casts = [
        'is_active' => 'boolean',
    ];
}
