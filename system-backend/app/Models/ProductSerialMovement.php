<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToCompany;

// 🆕 [2026-09-20] log การเคลื่อนไหวของ S/N รายตัว — เขียนโดย StockMovementController::transfer() (ไม่มี updated_at เพราะเป็น log)
class ProductSerialMovement extends Model
{
    use BelongsToCompany;

    const UPDATED_AT = null;

    protected $fillable = [
        'company_id', 'product_serial_id', 'event_type', 'from_warehouse_id', 'to_warehouse_id',
        'from_product_id', 'to_product_id', 'reference_number', 'note', 'user_id',
    ];

    public function fromWarehouse()
    {
        return $this->belongsTo(Warehouse::class, 'from_warehouse_id');
    }

    public function toWarehouse()
    {
        return $this->belongsTo(Warehouse::class, 'to_warehouse_id');
    }

    public function fromProduct()
    {
        return $this->belongsTo(Product::class, 'from_product_id');
    }

    public function toProduct()
    {
        return $this->belongsTo(Product::class, 'to_product_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
