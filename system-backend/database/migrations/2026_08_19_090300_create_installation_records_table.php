<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installation_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('installation_number', 50);

            // บังคับเสมอ — ทางเข้าเดียวคือ Project Hub จึงไม่มีเคส "ไม่มีโครงการ" แบบ repair_tickets
            $table->foreignId('project_id')->constrained('projects')->restrictOnDelete();
            // Contact ไม่ใช้ SoftDeletes (ลบจริง) — restrictOnDelete() กันลบลูกค้าที่มีประวัติติดตั้งอยู่
            $table->foreignId('contact_id')->constrained('contacts')->restrictOnDelete();

            // ผูกกับรายการในเอกสารขาย ไม่ใช่ทั้งเอกสาร/โครงการ เพราะ 1 โครงการอาจติดตั้งหลายจุด/หลายห้อง
            $table->foreignId('sale_document_item_id')->constrained('sale_document_items')->restrictOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete(); // denormalize เพื่อ query เร็ว
            // มีค่าเฉพาะสินค้าที่คุม S/N
            $table->foreignId('product_serial_id')->nullable()->constrained('product_serials')->nullOnDelete();

            // สินค้าไม่มี S/N อาจแบ่งติดตั้งหลายจุดจากยอดขายเดียวกัน — สินค้ามี S/N บังคับ = 1 เสมอ (validate ที่ controller)
            $table->decimal('quantity', 10, 2)->default(1);

            $table->string('site_name', 150)->nullable();
            $table->text('site_address')->nullable();
            $table->string('room_location', 150)->nullable();
            $table->text('install_notes')->nullable();

            $table->string('status', 30)->default('scheduled');

            $table->unsignedSmallInteger('warranty_months')->nullable();
            $table->date('warranty_expires_at')->nullable();

            $table->date('scheduled_at')->nullable();
            $table->date('installed_at')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('installed_by')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'warranty_expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installation_records');
    }
};
