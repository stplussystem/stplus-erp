<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            // ไม่ constrain ตรงๆ เหมือน project_id เดิม — ต้องแยกคอลัมน์กัน ไม่ใช้ project_id ซ้ำ
            // เพราะ ProjectController::summary() query ตรงๆ ด้วย project_id จะพังถ้ามี id ชนกัน
            $table->unsignedBigInteger('rental_job_id')->nullable()->after('project_id');
        });
    }

    public function down(): void
    {
        Schema::table('sale_documents', function (Blueprint $table) {
            $table->dropColumn('rental_job_id');
        });
    }
};
