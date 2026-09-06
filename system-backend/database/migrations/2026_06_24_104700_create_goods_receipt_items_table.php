<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('goods_receipt_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('goods_receipt_id');
            $table->unsignedBigInteger('product_id');
            $table->integer('quantity'); // จำนวนที่รับเข้าจริงในรอบนี้
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('goods_receipt_items');
    }
};
