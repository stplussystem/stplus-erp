<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockLot extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $guarded = [];

    protected $casts = [
        'received_at' => 'datetime',
        'cost_is_estimated' => 'boolean',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function goodsReceiptItem()
    {
        return $this->belongsTo(GoodsReceiptItem::class);
    }

    public function serials()
    {
        return $this->hasMany(ProductSerial::class);
    }

    public function consumptions()
    {
        return $this->hasMany(StockLotConsumption::class);
    }
}
