<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('doc_type'); // เก็บประเภท เช่น quotation, invoice
            $table->string('period'); // เก็บช่วงเวลา เช่น '2605', '2606', หรือ 'all' (ถ้าไม่ใช้วันที่)
            $table->integer('last_number')->default(0); // เก็บเลขล่าสุดที่รันไปแล้ว
            $table->timestamps();

            // 🚀 ป้องกันการดึงเลขซ้ำกันในเสี้ยววินาทีเดียวกัน (Index)
            $table->unique(['company_id', 'doc_type', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_sequences');
    }
};
