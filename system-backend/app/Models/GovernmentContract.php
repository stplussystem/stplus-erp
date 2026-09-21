<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;

// 📋 ใบคุมสัญญาราชการ — ทะเบียนติดตามสัญญาราชการ + หลักประกันสัญญา ผูกกับโครงการเสมอ
class GovernmentContract extends Model
{
    use SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id', 'project_id', 'agency_name', 'contract_number', 'contract_date',
        'contract_amount', 'guarantee_number', 'guarantee_amount', 'guarantee_date',
        'guarantee_return_requested_date', 'guarantee_returned_date',
        'receipt_voucher_number', 'receipt_voucher_text', 'note', 'created_by',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    // 📅 วันครบกำหนด/ส่งมอบงาน — แยกเป็นตารางลูกเพราะ 1 สัญญามีได้หลายงวด (ดู GovernmentContractDueDate)
    public function dueDates()
    {
        return $this->hasMany(GovernmentContractDueDate::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
