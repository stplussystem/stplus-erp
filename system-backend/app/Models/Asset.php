<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;

class Asset extends Model
{
    use SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id', 'name', 'category', 'serial_number', 'purchase_date', 'price',
        'responsible_user_id', 'status', 'next_maintenance_date', 'note', 'created_by',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'next_maintenance_date' => 'date',
        'price' => 'decimal:2',
    ];

    public function responsibleUser()
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function photos()
    {
        return $this->hasMany(AssetPhoto::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
