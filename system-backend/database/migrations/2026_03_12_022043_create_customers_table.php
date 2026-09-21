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
    Schema::create('customers', function (Blueprint $table) {
        $table->id();
        $table->string('name');
        $table->string('tax_id')->nullable()->comment('เลขผู้เสียภาษี');
        $table->text('address')->nullable()->comment('ที่อยู่จัดส่ง');
        $table->text('billing_address')->nullable()->comment('ที่อยู่ออกบิล');
        $table->decimal('credit_limit', 15, 2)->default(0)->comment('วงเงินเครดิต');
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
