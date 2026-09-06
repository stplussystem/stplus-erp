<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete(); // 🏢 ระบบ SaaS

            // 🔗 The Magic Link: เตรียมรองรับระบบ Project Center ในอนาคต
            $table->unsignedBigInteger('project_id')->nullable()->comment('รหัสโครงการ (ถ้ามี)');

            $table->foreignId('contact_id')->constrained('contacts')->restrictOnDelete(); // ผู้จำหน่าย
            $table->string('po_number')->unique();
            $table->enum('status', ['Draft', 'Pending', 'Approved', 'Completed', 'Cancelled'])->default('Draft');
            $table->date('expected_date')->nullable();

            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('vat_amount', 10, 2)->default(0);
            $table->decimal('grand_total', 10, 2)->default(0);
            $table->text('note')->nullable();

            $table->foreignId('created_by')->constrained('users'); // คนสร้างบิล
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
