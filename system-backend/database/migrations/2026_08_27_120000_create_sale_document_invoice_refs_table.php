<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🧾 ใบวางบิล/ใบเสร็จรับเงิน อ้างอิงใบกำกับภาษีที่อนุมัติแล้วได้หลายใบต่อ 1 เอกสาร (many-to-many)
// sale_document_id = เอกสารเจ้าของ (billing_invoice หรือ receipt), tax_invoice_id = ใบกำกับภาษีที่ถูกอ้างอิง
// payment_amount ใช้เฉพาะฝั่ง receipt (ยอดที่จ่ายจริงต่อใบกำกับภาษีนั้นในใบเสร็จนี้) — billing_invoice ปล่อย null (แค่แจ้งยอดที่จะเรียกเก็บ)
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_document_invoice_refs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sale_document_id');
            $table->unsignedBigInteger('tax_invoice_id');
            $table->decimal('payment_amount', 15, 2)->nullable();
            $table->timestamps();

            $table->foreign('sale_document_id')->references('id')->on('sale_documents')->onDelete('cascade');
            // 🛡️ ห้ามลบใบกำกับภาษีที่ถูกวางบิล/รับชำระไปแล้ว กันข้อมูลอ้างอิงขาดหาย
            $table->foreign('tax_invoice_id')->references('id')->on('sale_documents')->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_document_invoice_refs');
    }
};
