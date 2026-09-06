<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tracks which company a given Sanctum token is currently "in". Scoped to the
        // token (not the user) so switching company in one tab/device never affects
        // another already-open session for the same user.
        Schema::create('token_active_company', function (Blueprint $table) {
            $table->foreignId('token_id')->primary()->constrained('personal_access_tokens')->cascadeOnDelete();
            $table->foreignId('company_id')->constrained();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('token_active_company');
    }
};
