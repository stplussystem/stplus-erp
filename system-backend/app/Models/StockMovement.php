<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockMovement extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $guarded = []; // อนุญาตให้บันทึกข้อมูลได้ทุกฟิลด์

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function serials()
    {
        return $this->hasMany(ProductSerial::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
