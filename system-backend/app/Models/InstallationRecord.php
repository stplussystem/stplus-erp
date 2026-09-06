<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;

class InstallationRecord extends Model
{
    use SoftDeletes, BelongsToCompany;

    protected $fillable = [
        'company_id', 'installation_number', 'project_id', 'contact_id',
        'sale_document_item_id', 'product_id', 'product_serial_id', 'quantity',
        'site_name', 'site_address', 'room_location', 'install_notes',
        'status', 'warranty_months', 'warranty_expires_at',
        'scheduled_at', 'installed_at', 'created_by', 'installed_by',
    ];

    protected $casts = [
        'scheduled_at' => 'date',
        'installed_at' => 'date',
        'warranty_expires_at' => 'date',
        'quantity' => 'decimal:2',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function saleDocumentItem()
    {
        return $this->belongsTo(SaleDocumentItem::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function productSerial()
    {
        return $this->belongsTo(ProductSerial::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function installer()
    {
        return $this->belongsTo(User::class, 'installed_by');
    }
}
