<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToCompany;

class InstallationEquipmentItem extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id', 'project_id', 'sale_document_item_id', 'product_id',
        'quantity', 'location', 'unit_cost_snapshot', 'created_by',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_cost_snapshot' => 'decimal:2',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function saleDocumentItem()
    {
        return $this->belongsTo(SaleDocumentItem::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
