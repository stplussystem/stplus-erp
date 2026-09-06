<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // `purchase_orders.project_id`/`sale_documents.project_id` และ Project model (SoftDeletes, BelongsToCompany)
    // ถูกสร้างไว้รองรับ "Project Center" ล่วงหน้าแล้ว แต่ไม่เคยมี migration สร้างตาราง projects จริงเลย
    // ทำให้ /api/projects พังด้วย "Base table or view not found" ทุกครั้งที่เรียก — สร้างตารางให้ตรงกับ model จริง
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
