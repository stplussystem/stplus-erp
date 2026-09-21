<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('goods_receipts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable();
            $table->unsignedBigInteger('purchase_order_id'); // อ้างอิงว่ามาจาก PO ใบไหน
            $table->string('gr_number')->unique(); // เลขที่เอกสารใบรับสินค้า เช่น GR-2606-0001
            $table->string('reference_number')->nullable(); // เลขที่ใบส่งของของซัพพลายเออร์ (Do/Invoice No.)
            $table->date('received_date'); // วันที่รับของจริง
            $table->enum('status', ['Completed', 'Cancelled'])->default('Completed');
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('goods_receipts');
    }
};
