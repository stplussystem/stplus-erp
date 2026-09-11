<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'company_id']);
        });

        // Backfill: every existing user keeps access to exactly their current home company.
        // This is additive-only — no user loses or gains access as a result of this migration.
        $now = now();
        DB::table('users')
            ->whereNotNull('company_id')
            ->select('id', 'company_id')
            ->orderBy('id')
            ->chunk(500, function ($users) use ($now) {
                $rows = $users->map(fn ($u) => [
                    'user_id' => $u->id,
                    'company_id' => $u->company_id,
                    'granted_by' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all();
                DB::table('company_user')->insertOrIgnore($rows);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_user');
    }
};
