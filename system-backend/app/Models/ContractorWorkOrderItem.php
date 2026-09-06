<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractorWorkOrderItem extends Model
{
    protected $fillable = [
        'contractor_work_order_id', 'description', 'quantity', 'unit_name',
        'unit_price', 'discount_amount', 'total_price',
    ];

    public function contractorWorkOrder()
    {
        return $this->belongsTo(ContractorWorkOrder::class);
    }
}
