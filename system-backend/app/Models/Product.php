<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use \App\Traits\BelongsToCompany;

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

    public function stockBalance()
    {
        // เชื่อมไปยังตาราง StockBalance โดยใช้ product_id
        return $this->hasOne(StockBalance::class, 'product_id');
    }

    // สินค้าที่มักใช้คู่กัน (เช่น เสา Beam คู่กับเสาแกน Beam) — บันทึกแบบสมมาตร 2 แถวตอน sync
    public function relatedProducts()
    {
        return $this->belongsToMany(Product::class, 'product_relations', 'product_id', 'related_product_id')
            ->withTimestamps();
    }

    // สูตรส่วนประกอบของสินค้าชุด (Bundle) — มีความหมายเฉพาะเมื่อ is_bundle = true
    public function bundleItems()
    {
        return $this->hasMany(ProductBundleItem::class, 'bundle_product_id')->orderBy('sort_order');
    }
}
