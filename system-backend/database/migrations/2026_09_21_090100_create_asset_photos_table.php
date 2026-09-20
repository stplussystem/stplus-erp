<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_photos', function (Blueprint $table) {
            $table->id();
            // parent-child แท้ (รูปไม่มีความหมายแยกจากสินทรัพย์) — cascadeOnDelete() ตามธรรมเนียมเดิมของโปรเจกต์
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->string('path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_photos');
    }
};
