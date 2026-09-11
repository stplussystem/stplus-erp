<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            // ไม่ constrain ตรงๆ (เหมือน sale_documents.project_id) — เผื่อ nest ใต้โครงการใหญ่ได้ แต่ไม่บังคับ
            $table->unsignedBigInteger('project_id')->nullable();
            $table->foreignId('pic_user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('name');
            $table->string('location')->nullable();
            $table->json('job_types')->nullable();
            $table->string('status', 30)->default('draft');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->text('note')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_jobs');
    }
};
