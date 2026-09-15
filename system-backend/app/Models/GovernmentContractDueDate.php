<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// 📅 วันครบกำหนด/ส่งมอบงานของสัญญาราชการ — 1 สัญญามีได้หลายแถว (งวด/เฟส/ต่ออายุ)
class GovernmentContractDueDate extends Model
{
    protected $fillable = ['government_contract_id', 'due_date', 'note'];

    protected $casts = [
        'due_date' => 'date:Y-m-d',
    ];

    public function contract()
    {
        return $this->belongsTo(GovernmentContract::class, 'government_contract_id');
    }
}
