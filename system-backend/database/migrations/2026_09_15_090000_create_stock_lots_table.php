<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 🆕 ชั้นข้อมูล "ล็อตที่รับเข้า" สำหรับต้นทุนแบบ FIFO — เพิ่มขนานไปกับ stock_movements/stock_balances เดิม
// (ไม่รื้อของเดิม) เพื่อรู้ว่าสินค้าที่ยังคงเหลืออยู่ตอนนี้มาจากการรับเข้าครั้งไหน ต้นทุนเท่าไร จะได้ตัดจ่าย
// ตามลำดับเก่าสุดก่อน (FIFO) ตอนขาย/เบิกจ่ายจริง แทนการใช้ค่าเฉลี่ยทั้งประวัติแบบเดิม
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses')->cascadeOnDelete();

            // ต้นทางของล็อต — nullable เพราะบางเส้นทาง (นำเข้า Excel ไม่กรอกต้นทุน/ยอดยกมา) ไม่มีใบรับสินค้าจริง
            $table->foreignId('goods_receipt_item_id')->nullable()->constrained('goods_receipt_items')->nullOnDelete();
            // 🛡️ ไม่ใช้ FK constraint — มิเรอร์แพทเทิร์นเดียวกับ product_serials.stock_movement_id เดิม (แค่ reference)
            $table->unsignedBigInteger('stock_movement_id')->nullable()->comment('StockMovement แถวที่รับของเข้าพร้อมล็อตนี้');
            $table->unsignedBigInteger('import_batch_id')->nullable()->comment('มิเรอร์ stock_movements.import_batch_id ให้ undoImportBatch() ย้อนล็อตได้');

            $table->decimal('unit_cost', 15, 2)->default(0)->comment('ต้นทุนต่อหน่วยของล็อตนี้');
            $table->decimal('qty_received', 15, 2)->comment('จำนวนที่รับเข้าตอนสร้างล็อต');
            $table->decimal('qty_remaining', 15, 2)->comment('จำนวนที่ยังเหลือในล็อต (ลดลงตาม FIFO)');

            $table->enum('source_type', [
                'goods_receipt', 'opening_balance', 'manual_in', 'import', 'sales_return', 'transfer_in',
            ])->default('goods_receipt');
            $table->string('reference_number')->nullable()->comment('gr_number / document_number / ref ของ movement');
            $table->timestamp('received_at')->comment('วันที่รับเข้าจริง — คีย์เรียงลำดับ FIFO หลัก');
            $table->boolean('cost_is_estimated')->default(false)->comment('true = ต้นทุนเดามาจาก fallback ไม่ใช่ราคาซื้อจริง');
            $table->text('note')->nullable();
            $table->timestamps();

            // FIFO lookup: หา "ล็อตเก่าสุดที่ยังมีของ" ของ product+warehouse
            $table->index(['company_id', 'product_id', 'warehouse_id', 'qty_remaining'], 'stock_lots_fifo_idx');
            $table->index(['product_id', 'received_at', 'id'], 'stock_lots_fifo_order_idx');
            $table->index('import_batch_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_lots');
    }
};
