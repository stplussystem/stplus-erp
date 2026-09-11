<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductRelation extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $guarded = [];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function relatedProduct()
    {
        return $this->belongsTo(Product::class, 'related_product_id');
    }
}
