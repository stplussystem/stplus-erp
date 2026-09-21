<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 🛒 อัปเกรดตาราง "หัวบิล" (Purchase Orders)
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('reference_number')->nullable()->after('po_number')->comment('เลขที่อ้างอิง (เช่น ใบเสนอราคา)');
            $table->foreignId('warehouse_id')->nullable()->after('project_id')->constrained('warehouses')->nullOnDelete()->comment('คลังสินค้าที่รับเข้า');

            $table->integer('credit_days')->default(0)->after('expected_date')->comment('เครดิต (วัน)');
            $table->date('due_date')->nullable()->after('credit_days')->comment('วันครบกำหนดชำระ');

            $table->string('currency', 3)->default('THB')->after('due_date')->comment('สกุลเงิน');
            $table->enum('tax_type', ['include', 'exclude', 'none'])->default('exclude')->after('currency')->comment('ประเภทภาษี');

            $table->decimal('discount_amount', 10, 2)->default(0)->after('subtotal')->comment('ส่วนลดรวมท้ายบิล');
            $table->decimal('wht_amount', 10, 2)->default(0)->after('vat_amount')->comment('ยอดหัก ณ ที่จ่ายรวม');
        });

        // 🛍️ อัปเกรดตาราง "รายการสินค้า" (Purchase Order Items)
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->decimal('discount_percent', 5, 2)->nullable()->after('unit_price')->comment('ส่วนลด %');
            $table->decimal('discount_amount', 10, 2)->default(0)->after('discount_percent')->comment('ส่วนลดเป็นเงิน');

            $table->decimal('tax_rate', 5, 2)->default(0)->after('discount_amount')->comment('อัตราภาษี %');
            $table->decimal('tax_amount', 10, 2)->default(0)->after('tax_rate')->comment('ยอดภาษี');

            $table->decimal('wht_rate', 5, 2)->nullable()->after('tax_amount')->comment('อัตราหัก ณ ที่จ่าย %');
            $table->decimal('wht_amount', 10, 2)->default(0)->after('wht_rate')->comment('ยอดหัก ณ ที่จ่าย');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropForeign(['warehouse_id']);
            $table->dropColumn([
                'reference_number',
                'warehouse_id',
                'credit_days',
                'due_date',
                'currency',
                'tax_type',
                'discount_amount',
                'wht_amount'
            ]);
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn([
                'discount_percent',
                'discount_amount',
                'tax_rate',
                'tax_amount',
                'wht_rate',
                'wht_amount'
            ]);
        });
    }
};
