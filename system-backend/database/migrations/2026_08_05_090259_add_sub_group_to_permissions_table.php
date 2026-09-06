<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('permissions', function (Blueprint $table) {
            // 🚀 เติมคอลัมน์ sub_group ต่อท้ายคอลัมน์ group
            $table->string('sub_group')->nullable()->after('group');
        });
    }

    public function down(): void
    {
        Schema::table('permissions', function (Blueprint $table) {
            $table->dropColumn('sub_group');
        });
    }
};
