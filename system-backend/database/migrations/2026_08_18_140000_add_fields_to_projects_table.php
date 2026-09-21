<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('contact_id')->nullable()->after('company_id')
                ->constrained('contacts')->nullOnDelete();
            $table->foreignId('pic_user_id')->nullable()->after('contact_id')
                ->constrained('users')->nullOnDelete();
            $table->date('start_date')->nullable()->after('status');
            $table->date('end_date')->nullable()->after('start_date');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('contact_id');
            $table->dropConstrainedForeignId('pic_user_id');
            $table->dropColumn(['start_date', 'end_date']);
        });
    }
};
