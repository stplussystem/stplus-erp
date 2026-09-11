<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_document_item_serials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_document_item_id')->constrained('sale_document_items')->cascadeOnDelete();
            $table->foreignId('product_serial_id')->constrained('product_serials')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['sale_document_item_id', 'product_serial_id'], 'sdis_item_serial_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_document_item_serials');
    }
};
