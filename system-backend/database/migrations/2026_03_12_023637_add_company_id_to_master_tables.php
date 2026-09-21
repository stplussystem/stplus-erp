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
        // เพิ่ม company_id ลงในตาราง customers
        Schema::table('customers', function (Blueprint $table) {
            $table->foreignId('company_id')->after('id')->constrained('companies')->cascadeOnDelete();
        });

        // เพิ่ม company_id ลงในตาราง products
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('company_id')->after('id')->constrained('companies')->cascadeOnDelete();
        });

        // เพิ่ม company_id ลงในตาราง warehouses
        Schema::table('warehouses', function (Blueprint $table) {
            $table->foreignId('company_id')->after('id')->constrained('companies')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('master_tables', function (Blueprint $table) {
            //
        });
    }
};
