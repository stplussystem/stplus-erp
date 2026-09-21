<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🛠️ ใบสั่งซื้อ/ใบสั่งจ้าง สำหรับจ้างช่าง/ผู้รับเหมารายตัว — แยกจากใบสั่งซื้อ (Purchase Order) เดิมที่ใช้ซื้อสินค้าเข้าสต๊อกโดยสิ้นเชิง
// ผูกได้ทั้งโครงการ (project_id) และงานเช่า (rental_job_id) — ไม่บังคับ FK ตาม convention เดียวกับ sale_documents/purchase_orders
// (project_id/rental_job_id เป็น soft reference ระดับแอปเท่านั้น ไม่มี FK constraint ในฐานข้อมูล)
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contractor_work_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('rental_job_id')->nullable();
            $table->foreignId('contact_id')->constrained('contacts')->restrictOnDelete(); // ผู้รับเหมา/ช่างที่ถูกจ้าง
            $table->string('order_number')->unique();
            $table->string('site_reference')->nullable(); // ช่อง "หน่วยงาน" — ลูกค้าปลายทาง/สถานที่ทำงาน (free text)
            $table->enum('status', ['Pending', 'Approved', 'Cancelled'])->default('Pending');
            $table->date('order_date')->nullable();
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('wht_rate', 5, 2)->nullable();
            $table->decimal('wht_amount', 15, 2)->default(0);
            // 🛡️ ตั้งใจ: grand_total = subtotal - discount_amount - wht_amount (หัก ณ ที่จ่ายถูกลบออกจากยอดสุทธิ)
            // ต่างจากเอกสารอื่นทุกประเภทในระบบ (SaleDocument/PurchaseOrder ไม่เคยหัก WHT ออกจาก grand_total)
            // เป็นความตั้งใจตามแบบฟอร์มจริงที่บริษัทใช้จ้างช่าง (ดู logic คำนวณใน ContractorWorkOrderController)
            $table->decimal('grand_total', 15, 2)->default(0);
            $table->boolean('show_footer_note')->default(true); // สลับซ่อน/แสดงข้อความท้ายฟอร์ม 2 บรรทัดตอนพิมพ์
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('contractor_work_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contractor_work_order_id')->constrained('contractor_work_orders')->cascadeOnDelete();
            $table->text('description'); // งาน/รายการจ้าง เป็นข้อความอิสระ — ไม่มี product_id เลย (ไม่ใช่สินค้าจากคลัง)
            $table->decimal('quantity', 10, 2)->default(1);
            $table->string('unit_name', 50)->default('งาน');
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('total_price', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contractor_work_order_items');
        Schema::dropIfExists('contractor_work_orders');
    }
};
