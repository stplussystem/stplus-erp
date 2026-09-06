<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockBalance extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $guarded = [];

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Fetch (or create) the balance row for a product/company/warehouse with a row lock,
     * so concurrent stock-affecting requests serialize on it instead of racing a plain
     * read-then-write. Must be called inside an open DB transaction — the lock is only
     * held until that transaction commits/rolls back.
     */
    public static function lockedFor(int $productId, int $companyId, int $warehouseId): self
    {
        $find = fn () => static::where('product_id', $productId)
            ->where('company_id', $companyId)
            ->where('warehouse_id', $warehouseId)
            ->lockForUpdate()
            ->first();

        $balance = $find();
        if ($balance) {
            return $balance;
        }

        try {
            return static::create([
                'product_id' => $productId,
                'company_id' => $companyId,
                'warehouse_id' => $warehouseId,
                'qty' => 0,
                'reserved_qty' => 0,
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            // Duplicate-key: another concurrent request created the row first — read it back locked.
            return $find();
        }
    }
}
