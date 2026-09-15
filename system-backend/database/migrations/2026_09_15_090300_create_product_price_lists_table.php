<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🆕 โมดูล Price List — เก็บราคาที่ผู้จำหน่าย (vendor, contacts.is_vendor=true) แต่ละรายตั้งไว้ต่อสินค้า
// 1 แถวต่อ (สินค้า, ผู้จำหน่าย) เดียว เขียนทับในที่ทุกครั้งที่อัปเดต/นำเข้าใหม่ (ไม่ใช่ประวัติ) — ใช้ตอนดูราคา
// อ้างอิงระหว่างอนุมัติใบเสนอราคา แยกจาก stock_lots/goods_receipt_items โดยสิ้นเชิง (ข้อมูลนี้เป็นราคาที่
// vendor "ตั้งไว้" ไม่ใช่ราคาที่เราซื้อจริง — เทียบได้กับ ReportController::supplierPriceComparisonRows() ที่
// derive ย้อนหลังจากประวัติการรับสินค้าจริง แต่ตารางนี้เป็นแคตตาล็อกที่กรอก/นำเข้าล่วงหน้าเอง)
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_price_lists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained('contacts')->cascadeOnDelete()->comment('ผู้จำหน่าย (vendor)');

            $table->decimal('price', 15, 2)->comment('ราคาที่ผู้จำหน่ายตั้งไว้ล่าสุด');
            $table->decimal('previous_price', 15, 2)->nullable()->comment('ราคาก่อนหน้า — ใช้เทียบคำนวณ price_trend เท่านั้น');
            $table->decimal('discount_percent', 5, 2)->nullable()->comment('ส่วนลดที่ผู้จำหน่ายให้ — แสดงผลอย่างเดียว ไม่นำไปคำนวณราคาใดๆ');
            $table->enum('price_trend', ['up', 'down', 'stable'])->default('stable');
            $table->date('expiry_date')->nullable()->comment('วันสิ้นสุดราคานี้');
            $table->text('note')->nullable();
            $table->unsignedBigInteger('import_batch_id')->nullable()->comment('อ้างอิงรอบนำเข้า Excel ที่สร้าง/แก้แถวนี้ล่าสุด (ไม่มี undo แบบ stock)');
            $table->timestamps();

            $table->unique(['company_id', 'product_id', 'contact_id'], 'product_price_lists_unique_vendor_product');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_price_lists');
    }
};
