<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleDocumentItem extends Model
{
    protected $fillable = [
        'sale_document_id', 'product_id', 'item_name', 'parent_item_id', 'source_item_id', 'quantity', 'unit_name',
        'unit_price', 'cost_price', 'discount_percent', 'discount_amount',
        'tax_rate', 'tax_amount', 'wht_rate', 'wht_amount', 'total_price'
    ];

    public function saleDocument()
    {
        return $this->belongsTo(SaleDocument::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function serials()
    {
        return $this->belongsToMany(ProductSerial::class, 'sale_document_item_serials');
    }

    // แถวแม่ (สินค้าชุด) ที่แถวนี้เป็นส่วนประกอบอยู่ — null ถ้าเป็นแถวปกติ/แถวแม่เอง
    public function parent()
    {
        return $this->belongsTo(SaleDocumentItem::class, 'parent_item_id');
    }

    // แถวส่วนประกอบทั้งหมดของแถวนี้ (มีความหมายเมื่อแถวนี้เป็นแถวแม่สินค้าชุด)
    public function children()
    {
        return $this->hasMany(SaleDocumentItem::class, 'parent_item_id');
    }

    // แถวต้นทางในเอกสารอื่น (เช่น ใบเสนอราคา) ที่แถวนี้ถูกโหลดมาจาก — null ถ้าไม่ได้โหลดมาจากเอกสารอื่น
    public function sourceItem()
    {
        return $this->belongsTo(SaleDocumentItem::class, 'source_item_id');
    }

    // แถวทั้งหมดในเอกสารอื่นที่โหลดต่อมาจากแถวนี้ (มีความหมายเมื่อแถวนี้เป็นแถวในเอกสารต้นทาง เช่น ใบเสนอราคา)
    public function issuedItems()
    {
        return $this->hasMany(SaleDocumentItem::class, 'source_item_id');
    }
}