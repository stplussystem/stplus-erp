<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repair_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('ticket_number', 50);

            // ลูกค้าบังคับเสมอ — Contact ไม่ใช้ SoftDeletes และ ContactController::destroy() ลบจริง (hard delete)
            // ดังนั้น restrictOnDelete() ที่นี่คือตัวกันไม่ให้ลบ contact ที่มีประวัติงานซ่อมอยู่
            $table->foreignId('contact_id')->constrained('contacts')->restrictOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();

            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            // มีค่าเมื่อสินค้ามี S/N — อ้างอิงหน่วยที่ขายจริง
            $table->foreignId('product_serial_id')->nullable()->constrained('product_serials')->nullOnDelete();
            // บังคับเมื่อไม่มี S/N — อ้างอิงเอกสารขายเดิมเพื่อผูกกับลูกค้า/งาน
            $table->foreignId('reference_sale_document_id')->nullable()->constrained('sale_documents')->nullOnDelete();

            $table->string('status', 30)->default('received');
            $table->text('reported_issue')->nullable();
            $table->text('diagnosis_notes')->nullable();
            $table->decimal('repair_cost', 15, 2)->nullable();
            $table->boolean('is_under_warranty')->default(false);

            $table->date('received_at')->nullable();
            $table->date('returned_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('assigned_to')->nullable();

            // เอกสารบิลที่ออกจากงานซ่อมนี้ (แยกจาก reference_sale_document_id ซึ่งคือที่มาของงานซ่อม)
            $table->foreignId('billing_sale_document_id')->nullable()->constrained('sale_documents')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repair_tickets');
    }
};
