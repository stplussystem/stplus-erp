<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductCategory extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $guarded = [];
}
