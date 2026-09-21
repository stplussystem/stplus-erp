<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. ตารางหัวบิลเอกสารขาย
        Schema::create('sale_documents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('warehouse_id')->nullable();
            $table->unsignedBigInteger('contact_id'); // ลูกค้า
            $table->unsignedBigInteger('parent_id')->nullable()->comment('รหัสเอกสารต้นฉบับ (กรณี Revise)');
            $table->integer('version')->default(0)->comment('เวอร์ชันการแก้ไข (0=ต้นฉบับ, 1=V1)');

            // 🚀 ประเภทเอกสาร (quotation, billing_invoice, tax_invoice, cash, receipt, credit_note, debit_note)
            $table->string('document_type', 50);
            $table->string('document_number', 50); // เช่น QT-2608-0001

            // 🚀 อ้างอิงเอกสารในระบบ (เช่น ใบเสร็จนี้ ดึงข้อมูลมาจาก ใบกำกับภาษี ID 5)
            $table->unsignedBigInteger('reference_document_id')->nullable();
            $table->string('reference_number')->nullable(); // อ้างอิงเอกสารภายนอก

            $table->string('status', 20)->default('Pending');
            $table->date('issue_date')->nullable();
            $table->integer('credit_days')->default(0);
            $table->date('due_date')->nullable();
            $table->string('currency', 3)->default('THB');
            $table->string('tax_type', 20)->default('exclude'); // include, exclude, none

            // การเงิน
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('vat_amount', 15, 2)->default(0);
            $table->decimal('wht_amount', 15, 2)->default(0);
            $table->decimal('grand_total', 15, 2)->default(0);

            $table->text('note')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });

        // 2. ตารางรายการสินค้าในบิล
        Schema::create('sale_document_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sale_document_id');
            $table->unsignedBigInteger('product_id');

            $table->decimal('quantity', 10, 2);
            $table->string('unit_name', 50)->default('ชิ้น');
            $table->decimal('unit_price', 15, 2);

            $table->decimal('discount_percent', 5, 2)->nullable();
            $table->decimal('discount_amount', 15, 2)->default(0);

            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);

            $table->decimal('wht_rate', 5, 2)->nullable();
            $table->decimal('wht_amount', 15, 2)->default(0);

            $table->decimal('total_price', 15, 2)->default(0);
            $table->timestamps();

            // ลบ items ทันทีถ้าหัวบิลโดนลบถาวร
            $table->foreign('sale_document_id')->references('id')->on('sale_documents')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_document_items');
        Schema::dropIfExists('sale_documents');
    }
};
