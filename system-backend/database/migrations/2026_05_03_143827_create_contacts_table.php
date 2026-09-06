<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            // 🏢 ระบบ SaaS ต้องมี company_id
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();

            // 📍 ข้อมูลพื้นฐานองค์กร (ด้านซ้าย)
            $table->enum('contact_type', ['company', 'individual'])->default('company');
            $table->boolean('is_customer')->default(false);
            $table->boolean('is_vendor')->default(false);
            $table->integer('credit_days')->default(0)->nullable();
            $table->enum('business_location', ['domestic', 'international'])->default('domestic');
            $table->string('contact_code')->unique();
            $table->string('business_name');
            $table->string('tax_id', 13)->nullable();
            $table->enum('branch_type', ['head_office', 'branch'])->default('head_office');
            $table->string('branch_code')->nullable(); // กรณีเป็นสาขา
            $table->text('address')->nullable();
            $table->string('zipcode', 10)->nullable();
            $table->text('delivery_address')->nullable();
            $table->string('office_phone')->nullable();
            $table->string('fax')->nullable();
            $table->string('website')->nullable();

            // 📍 ข้อมูลบุคคลติดต่อ และ การเงิน (ด้านขวา)
            $table->string('contact_person_name')->nullable();
            $table->string('email')->nullable();
            $table->string('mobile')->nullable();

            $table->string('bank_name')->nullable();
            $table->string('account_name')->nullable();
            $table->string('account_number')->nullable();
            $table->string('branch_name')->nullable(); // รหัส/ชื่อสาขาธนาคาร
            $table->enum('account_type', ['savings', 'current'])->nullable();
            $table->string('qr_code_image')->nullable(); // เก็บ Path รูป QR Code

            // ข้อมูลธนาคารต่างประเทศ
            $table->boolean('has_foreign_bank')->default(false);
            $table->string('swift_code')->nullable();
            $table->text('bank_address')->nullable();

            // ข้อมูลเพิ่มเติม
            $table->string('attachment')->nullable(); // เก็บ Path ไฟล์แนบ
            $table->text('note')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
