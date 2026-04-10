<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    // เพิ่มบรรทัดนี้เพื่ออนุญาตให้บันทึกข้อมูลลงได้ทุกคอลัมน์
    protected $guarded = [];

    // ดึงข้อมูลหมวดหมู่
    public function category()
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    // ดึงข้อมูลยี่ห้อ
    public function brand()
    {
        return $this->belongsTo(Brand::class, 'brand_id');
    }

    // ดึงข้อมูลหน่วยนับ
    public function unit()
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    public function stockMovements()
    {
        return $this->hasMany(StockMovement::class);
    }

    public function serials()
    {
        return $this->hasMany(ProductSerial::class);
    }
}
