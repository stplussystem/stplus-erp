<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;

class Project extends Model
{
    use SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id',
        'contact_id',
        'pic_user_id',
        'name',
        'description',
        'status',
        'stage',
        'start_date',
        'end_date',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    // ความสัมพันธ์กลับไปหา Purchase Orders
    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class, 'project_id');
    }

    public function saleDocuments()
    {
        return $this->hasMany(SaleDocument::class, 'project_id');
    }

    public function repairTickets()
    {
        return $this->hasMany(RepairTicket::class);
    }

    public function installationRecords()
    {
        return $this->hasMany(InstallationRecord::class);
    }

    public function installationEquipmentItems()
    {
        return $this->hasMany(InstallationEquipmentItem::class);
    }

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function pic()
    {
        return $this->belongsTo(User::class, 'pic_user_id');
    }
}
