<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 📋 ใบคุมสัญญาราชการ — ทะเบียนติดตามสัญญาราชการ + หลักประกันสัญญา ผูกกับโครงการเสมอ (ไม่ใช่งานเช่า)
// เป็นทะเบียนติดตาม (ledger) ไม่มี workflow อนุมัติเหมือนเอกสารขาย/ใบสั่งจ้าง — แก้ไขได้ตรงๆ ทุกเมื่อ
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('government_contracts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            // 🛡️ ผูกกับโครงการเสมอ (required) — ไม่บังคับ FK ตาม convention เดียวกับ sale_documents/purchase_orders/contractor_work_orders
            // "1 แถวสัญญาต้องผูกกับ 1 โครงการเสมอ" ไม่ใช่บังคับ 1 โครงการมีได้แค่ 1 สัญญา (โครงการจริงอาจมีหลายสัญญา/ต่อสัญญา)
            $table->unsignedBigInteger('project_id');
            $table->string('agency_name'); // ชื่อหน่วยงานราชการคู่สัญญา
            $table->string('contract_number');
            $table->date('contract_date')->nullable();
            $table->decimal('contract_amount', 15, 2)->default(0);
            $table->string('guarantee_number')->nullable(); // เลขที่หนังสือค้ำประกัน (bank guarantee)
            $table->decimal('guarantee_amount', 15, 2)->nullable();
            $table->date('guarantee_date')->nullable();
            // 🛡️ STRING ไม่ใช่ date — ข้อมูลจริงมีค่าไม่สม่ำเสมอ เช่น "6/4/2568 , 13/2/2568" (หลายวันในช่องเดียว)
            $table->string('contract_due_date')->nullable();
            $table->date('guarantee_return_requested_date')->nullable();
            $table->date('guarantee_returned_date')->nullable(); // มีค่า = เปิดใช้งานปุ่มพิมพ์ใบสำคัญรับเงิน
            $table->string('receipt_voucher_number')->nullable(); // จองเลขอัตโนมัติครั้งแรกที่ guarantee_returned_date ถูกตั้งค่า
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('government_contracts');
    }
};
