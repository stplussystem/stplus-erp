<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;

class SaleDocument extends Model
{
    use SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id', 'project_id', 'rental_job_id', 'warehouse_id', 'contact_id',
        'borrower_name', 'borrower_phone', 'loan_direction',
        'parent_id', 'version',
        'document_type', 'document_number', 'reference_document_id', 'reference_number',
        'transportation', 'saleman_code', 'payment_method',
        'status', 'issue_date', 'credit_days', 'due_date',
        'currency', 'tax_type', 'subtotal', 'discount_amount', 'deposit_amount',
        'vat_amount', 'wht_amount', 'grand_total', 'note',
        'custom_logo_path', 'custom_company_name', 'custom_company_address', 'custom_quoter_name',
        'show_serials',
        'created_by', 'approved_by', 'approved_at'
    ];

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function rentalJob()
    {
        return $this->belongsTo(RentalJob::class);
    }

    public function items()
    {
        return $this->hasMany(SaleDocumentItem::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function project()
    {
        return $this->belongsTo(\App\Models\Project::class, 'project_id');
    }

    public function warehouse()
    {
        return $this->belongsTo(\App\Models\Warehouse::class, 'warehouse_id');
    }

    // 🚀 ความสัมพันธ์พิเศษ: เอกสารต้นทางที่อ้างอิงมา (เช่น ใบกำกับภาษีนี้ มาจากใบเสนอราคาใบไหน)
    public function referencedDocument()
    {
        return $this->belongsTo(SaleDocument::class, 'reference_document_id');
    }

    // 🧾 เอกสารนี้ (ใบวางบิล/ใบเสร็จ) อ้างอิงใบกำกับภาษีใบไหนบ้าง — many-to-many ผ่าน sale_document_invoice_refs
    public function invoiceRefs()
    {
        return $this->hasMany(SaleDocumentInvoiceRef::class, 'sale_document_id');
    }

    // 🧾 มุมกลับ: ใบกำกับภาษีนี้ถูกอ้างอิงโดยใบวางบิล/ใบเสร็จใบไหนบ้าง — ใช้คำนวณยอดค้างชำระ (outstanding balance)
    public function invoiceRefsAsTaxInvoice()
    {
        return $this->hasMany(SaleDocumentInvoiceRef::class, 'tax_invoice_id');
    }

    // 🧾 เอกสารนี้ (ใบกำกับภาษี) อ้างอิงใบเบิกสินค้าใบไหนบ้าง — many-to-many ผ่าน sale_document_material_issue_refs
    // (เบิกไม่พร้อมกันเป็นหลายรอบ แต่ออกใบกำกับภาษีรวมใบเดียว)
    public function materialIssueRefs()
    {
        return $this->hasMany(SaleDocumentMaterialIssueRef::class, 'sale_document_id');
    }

    // 🧾 มุมกลับ: ใบเบิกสินค้านี้ถูกอ้างอิงโดยใบกำกับภาษีใบไหนบ้าง
    public function materialIssueRefsAsMaterialIssue()
    {
        return $this->hasMany(SaleDocumentMaterialIssueRef::class, 'material_issue_id');
    }
}
