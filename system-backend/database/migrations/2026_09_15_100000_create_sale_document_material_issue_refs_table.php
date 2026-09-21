<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🧾 ใบกำกับภาษี อ้างอิงใบเบิกสินค้า (material_issue) ที่อนุมัติแล้วได้หลายใบต่อ 1 เอกสาร (many-to-many) — กรณีเบิก
// สินค้าไม่พร้อมกันเป็นหลายรอบ (คนละใบเบิก) แต่ต้องออกใบกำกับภาษีรวมใบเดียว ทุกใบเบิกที่เลือกต้องมาจากใบเสนอราคา
// เดียวกันเท่านั้น (เช็คที่ SaleDocumentController::store()) sale_document_id = ใบกำกับภาษีเจ้าของแถวนี้,
// material_issue_id = ใบเบิกสินค้าที่ถูกอ้างอิง — คนละตารางกับ sale_document_invoice_refs ที่ใช้กับ
// billing_invoice/receipt ↔ tax_invoice (คนละคู่เอกสาร คนละความหมาย)
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_document_material_issue_refs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sale_document_id');
            $table->unsignedBigInteger('material_issue_id');
            $table->timestamps();

            $table->foreign('sale_document_id')->references('id')->on('sale_documents')->onDelete('cascade');
            // 🛡️ ห้ามลบใบเบิกสินค้าที่ถูกอ้างอิงไปออกใบกำกับภาษีแล้ว กันข้อมูลอ้างอิงขาดหาย
            $table->foreign('material_issue_id')->references('id')->on('sale_documents')->onDelete('restrict');
            $table->unique(['sale_document_id', 'material_issue_id'], 'sdmir_document_issue_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_document_material_issue_refs');
    }
};
