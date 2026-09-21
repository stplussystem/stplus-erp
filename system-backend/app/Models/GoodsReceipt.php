<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToCompany;

class GoodsReceipt extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_order_id',
        'contact_id',
        'gr_number',
        'reference_number',
        'received_date',
        'status',
        'note',
        'created_by',
    ];

    protected $casts = [
        'received_date' => 'date',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    // ผู้จำหน่ายที่เลือกตรงตอนรับสินค้าแบบไม่มี PO (รับสินค้าที่อ้างอิง PO ให้ดูผู้จำหน่ายผ่าน purchaseOrder->contact แทน)
    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function items()
    {
        return $this->hasMany(GoodsReceiptItem::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
