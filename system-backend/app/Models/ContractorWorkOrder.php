<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;

// 🛠️ ใบสั่งซื้อ/ใบสั่งจ้าง สำหรับจ้างช่าง/ผู้รับเหมารายตัว — แยกต่างหากจาก PurchaseOrder (ซื้อสินค้าเข้าสต๊อก) โดยสิ้นเชิง
class ContractorWorkOrder extends Model
{
    use SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id', 'project_id', 'rental_job_id', 'contact_id',
        'order_number', 'site_reference', 'status', 'order_date',
        'subtotal', 'discount_amount', 'wht_rate', 'wht_amount', 'grand_total',
        'show_footer_note', 'note', 'created_by', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'show_footer_note' => 'boolean',
    ];

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function items()
    {
        return $this->hasMany(ContractorWorkOrderItem::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function rentalJob()
    {
        return $this->belongsTo(RentalJob::class, 'rental_job_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
