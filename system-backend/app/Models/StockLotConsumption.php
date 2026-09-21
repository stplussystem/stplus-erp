<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockLotConsumption extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $guarded = [];

    protected $casts = [
        'is_shortfall' => 'boolean',
        'reversed_at' => 'datetime',
    ];

    public function lot()
    {
        return $this->belongsTo(StockLot::class, 'stock_lot_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function saleDocument()
    {
        return $this->belongsTo(SaleDocument::class);
    }

    public function productSerial()
    {
        return $this->belongsTo(ProductSerial::class);
    }
}
