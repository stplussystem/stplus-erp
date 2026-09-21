<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('permissions', function (Blueprint $table) {
            $table->boolean('is_menu')->default(false)->after('group');
            $table->string('title_th')->nullable()->after('is_menu');
            $table->string('path')->nullable()->after('title_th');
            $table->string('icon')->nullable()->after('path');
            $table->integer('sort_order')->default(0)->after('icon');
        });
    }

    public function down(): void
    {
        Schema::table('permissions', function (Blueprint $table) {
            $table->dropColumn(['is_menu', 'title_th', 'path', 'icon', 'sort_order']);
        });
    }
};
