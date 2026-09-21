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
        Schema::create('repair_ticket_photos', function (Blueprint $table) {
            $table->id();
            // parent-child แท้ (รูปไม่มีความหมายแยกจากใบซ่อม) — cascadeOnDelete() ตามธรรมเนียมเดิมของโปรเจกต์
            $table->foreignId('repair_ticket_id')->constrained('repair_tickets')->cascadeOnDelete();
            $table->string('path');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('repair_ticket_photos');
    }
};
