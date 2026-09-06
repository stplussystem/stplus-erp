<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Closes the concurrent-insert gap flagged in the system audit: without a unique
 * constraint, two simultaneous "receive/adjust stock for a product+warehouse that has no
 * balance row yet" requests could each insert their own row, splitting what should be one
 * balance into two and silently losing part of the quantity in reports/oversell checks.
 *
 * Merges any existing duplicate (product_id, company_id, warehouse_id) groups by summing
 * their qty into the oldest row and deleting the rest, then adds the constraint.
 */
return new class extends Migration
{
    public function up(): void
    {
        $duplicateGroups = DB::table('stock_balances')
            ->select('product_id', 'company_id', 'warehouse_id')
            ->groupBy('product_id', 'company_id', 'warehouse_id')
            ->havingRaw('count(*) > 1')
            ->get();

        foreach ($duplicateGroups as $group) {
            $rows = DB::table('stock_balances')
                ->where('product_id', $group->product_id)
                ->where('company_id', $group->company_id)
                ->where('warehouse_id', $group->warehouse_id)
                ->orderBy('id')
                ->get();

            $keep = $rows->first();
            $totalQty = $rows->sum('qty');

            DB::table('stock_balances')->where('id', $keep->id)->update(['qty' => $totalQty]);
            DB::table('stock_balances')
                ->where('product_id', $group->product_id)
                ->where('company_id', $group->company_id)
                ->where('warehouse_id', $group->warehouse_id)
                ->where('id', '!=', $keep->id)
                ->delete();
        }

        Schema::table('stock_balances', function (Blueprint $table) {
            $table->unique(['product_id', 'company_id', 'warehouse_id'], 'stock_balances_product_company_warehouse_unique');
        });
    }

    public function down(): void
    {
        Schema::table('stock_balances', function (Blueprint $table) {
            $table->dropUnique('stock_balances_product_company_warehouse_unique');
        });
    }
};
