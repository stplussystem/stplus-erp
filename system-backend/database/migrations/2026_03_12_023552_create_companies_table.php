<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name')->comment('ชื่อบริษัท');
            $table->string('logo')->nullable()->comment('โลโก้บริษัท');
            $table->longText('document_settings')->nullable()->comment('การตั้งค่าเอกสาร');
            $table->string('tax_id')->nullable()->comment('เลขผู้เสียภาษี');

            $table->text('address')->nullable();
            $table->string('phone', 50)->nullable();

            $table->text('bank_account')->nullable()->comment('บัญชีธนาคาร');
            $table->text('payment_terms')->nullable()->comment('เงื่อนไขการชำระเงิน');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
