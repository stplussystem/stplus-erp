<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;

class RentalJob extends Model
{
    use SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id',
        'contact_id',
        'project_id',
        'pic_user_id',
        'name',
        'location',
        'job_types',
        'status',
        'stage',
        'start_date',
        'end_date',
        'note',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'job_types' => 'array',
    ];

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function pic()
    {
        return $this->belongsTo(User::class, 'pic_user_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function saleDocuments()
    {
        return $this->hasMany(SaleDocument::class, 'rental_job_id');
    }
}
