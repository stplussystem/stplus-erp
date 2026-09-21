<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🚀 บันทึกประวัติทุกครั้งที่นำเข้า Excel สินค้า (ทั้ง "นำเข้าสินค้าใหม่" และ "ปรับปรุงสต๊อก/S/N")
// เพื่อให้ย้อนกลับ/ลบข้อมูลที่นำเข้าล่าสุดได้ ถ้าเผลอเลือกไฟล์ผิด — ก่อนหน้านี้ระบบไม่มีการบันทึกใดๆ เลยว่า
// การนำเข้าแต่ละครั้งสร้าง/แก้ไขแถวไหนบ้าง ทำให้ไม่มีทางย้อนกลับได้เลยถ้าอัปโหลดผิดไฟล์
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('type', ['master', 'adjust'])->comment('master=นำเข้าสินค้าใหม่, adjust=ปรับปรุงสต๊อก/S/N');
            $table->string('file_name')->nullable();
            $table->unsignedInteger('affected_count')->default(0);
            $table->enum('status', ['completed', 'partially_undone', 'undone'])->default('completed');
            $table->timestamp('undone_at')->nullable();
            $table->foreignId('undone_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_batches');
    }
};
