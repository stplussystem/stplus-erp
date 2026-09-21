<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// 🧾 แถวอ้างอิง "ใบเบิกสินค้า" (material_issue) ที่ถูกรวมเข้าใบกำกับภาษี 1 เอกสาร อ้างอิงได้หลายใบ (many-to-many
// ผ่านตารางนี้) — ใช้เมื่อโครงการเบิกสินค้าไม่พร้อมกันเป็นหลายรอบ แต่ต้องออกใบกำกับภาษีรวมใบเดียว
class SaleDocumentMaterialIssueRef extends Model
{
    protected $fillable = ['sale_document_id', 'material_issue_id'];

    // เอกสารเจ้าของแถวนี้ (ใบกำกับภาษี)
    public function saleDocument()
    {
        return $this->belongsTo(SaleDocument::class, 'sale_document_id');
    }

    // ใบเบิกสินค้าที่ถูกอ้างอิง
    public function materialIssue()
    {
        return $this->belongsTo(SaleDocument::class, 'material_issue_id');
    }
}
