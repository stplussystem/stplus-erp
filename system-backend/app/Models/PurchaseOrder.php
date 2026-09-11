<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;

class PurchaseOrder extends Model
{
    use SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id',
        'project_id',
        'contact_id',
        'po_number',
        'status',
        'expected_date',
        'subtotal',
        'vat_amount',
        'grand_total',
        'note',
        'created_by',
        'reference_number',
        'warehouse_id',
        'credit_days',
        'due_date',
        'currency',
        'tax_type',
        'discount_amount',
        'wht_amount',
        'approved_by',
        'approved_at'
    ];

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function project()
    {
        return $this->belongsTo(\App\Models\Project::class, 'project_id');
    }

    public function warehouse()
    {
        return $this->belongsTo(\App\Models\Warehouse::class, 'warehouse_id');
    }
}
