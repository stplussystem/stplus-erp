<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            $table->timestamp('sold_at')->nullable()->after('status');
            $table->foreignId('sold_to_sale_document_id')->nullable()->after('sold_at')
                ->constrained('sale_documents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('product_serials', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sold_to_sale_document_id');
            $table->dropColumn('sold_at');
        });
    }
};
