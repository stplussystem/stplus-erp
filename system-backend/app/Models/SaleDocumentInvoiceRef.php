<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// 🧾 แถวอ้างอิง "ใบกำกับภาษี" ที่ถูกรวมเข้าใบวางบิล/ใบเสร็จรับเงิน 1 เอกสาร อ้างอิงได้หลายใบ (many-to-many ผ่านตารางนี้)
class SaleDocumentInvoiceRef extends Model
{
    protected $fillable = ['sale_document_id', 'tax_invoice_id', 'payment_amount'];

    // เอกสารเจ้าของแถวนี้ (billing_invoice หรือ receipt)
    public function saleDocument()
    {
        return $this->belongsTo(SaleDocument::class, 'sale_document_id');
    }

    // ใบกำกับภาษีที่ถูกอ้างอิง
    public function taxInvoice()
    {
        return $this->belongsTo(SaleDocument::class, 'tax_invoice_id');
    }
}
