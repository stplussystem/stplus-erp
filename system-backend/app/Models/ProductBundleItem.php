<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductBundleItem extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $fillable = [
        'company_id', 'bundle_product_id', 'component_product_id', 'quantity', 'sort_order',
    ];

    public function bundleProduct()
    {
        return $this->belongsTo(Product::class, 'bundle_product_id');
    }

    public function componentProduct()
    {
        return $this->belongsTo(Product::class, 'component_product_id');
    }
}
