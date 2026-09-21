<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 🚀 อุปกรณ์ที่เลือกไว้ "จะนำไปติดตั้ง" ต่อโครงการ — บันทึกเป็นข้อมูลอ้างอิงสำหรับสรุปต้นทุนเท่านั้น
        // ไม่ตัดสต๊อก/ไม่ผูกกับ StockMovement ใดๆ (ตามที่ยืนยันไว้ตอนวางแผน — ต่างจาก InstallationRecord ที่ผูกกับ S/N จริง)
        Schema::create('installation_equipment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->restrictOnDelete();
            // ผูกกับแถว "ค่าติดตั้ง" (product_type=service) ที่เป็นจุดเริ่มกดเลือกอุปกรณ์ — nullable เผื่ออนาคตเลือกแบบไม่มีจุดอ้างอิง
            $table->foreignId('sale_document_item_id')->nullable()->constrained('sale_document_items')->nullOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->decimal('quantity', 10, 2)->default(1);
            // snapshot ต้นทุนเฉลี่ยถ่วงน้ำหนัก ณ ตอนเลือก (จากใบรับสินค้า) กันยอดสรุปเพี้ยนถ้าต้นทุนขยับย้อนหลัง
            $table->decimal('unit_cost_snapshot', 15, 2)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'project_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installation_equipment_items');
    }
};
