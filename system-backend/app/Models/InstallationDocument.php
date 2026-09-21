<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;

class InstallationDocument extends Model
{
    use SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id', 'installation_number', 'project_id', 'contact_id', 'sale_document_id', 'created_by',
    ];

    public function records()
    {
        return $this->hasMany(InstallationRecord::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function saleDocument()
    {
        return $this->belongsTo(SaleDocument::class);
    }
}
