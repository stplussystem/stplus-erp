<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🆕 audit trail ของ "การตัดล็อต" แต่ละครั้ง (FIFO) — ทำให้ยกเลิกเอกสารแล้วคืนสต๊อกกลับเข้าล็อตเดิมได้แม่นยำ
// แทนที่จะรู้แค่ว่า StockBalance.qty บวก/ลบเท่าไร (เหมือนระบบเดิม) แต่ไม่รู้ว่าตัดมาจากล็อตไหนบ้าง
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_lot_consumptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            // nullable = แถว "ตัดเกินที่ล็อตมี" (shortfall) ซึ่งไม่ได้ผูกกับล็อตจริง
            $table->foreignId('stock_lot_id')->nullable()->constrained('stock_lots')->nullOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->unsignedBigInteger('warehouse_id');

            $table->decimal('qty', 15, 2);
            $table->decimal('unit_cost', 15, 2)->comment('สำเนาต้นทุนล็อต ณ เวลาที่ตัด (freeze ไว้)');
            $table->decimal('qty_reversed', 15, 2)->default(0)->comment('จำนวนที่คืนกลับเข้าล็อตแล้ว (รองรับคืนสินค้าบางส่วน)');
            $table->boolean('is_shortfall')->default(false);

            // ผู้ใช้ล็อต — เก็บทั้งแบบ generic และแบบเจาะจงเพื่อ query เร็ว
            $table->string('reference_type')->comment('sale_document_item | stock_movement | manual');
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->foreignId('sale_document_id')->nullable()->constrained('sale_documents')->nullOnDelete();
            $table->unsignedBigInteger('stock_movement_id')->nullable();
            $table->foreignId('product_serial_id')->nullable()->constrained('product_serials')->nullOnDelete();

            $table->timestamp('reversed_at')->nullable()->comment('ไม่ null = คืนกลับเข้าล็อตครบแล้ว (ยกเลิกเอกสาร)');
            $table->timestamps();

            $table->index(['reference_type', 'reference_id']);
            $table->index(['sale_document_id', 'reversed_at']);
            $table->index('stock_lot_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_lot_consumptions');
    }
};
