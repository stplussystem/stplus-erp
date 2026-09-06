<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductSerial extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $guarded = [];

    protected $casts = [
        'sold_at' => 'datetime',
        'rented_at' => 'datetime',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function stockMovement()
    {
        return $this->belongsTo(StockMovement::class);
    }

    public function soldToSaleDocument()
    {
        return $this->belongsTo(SaleDocument::class, 'sold_to_sale_document_id');
    }

    public function rentedViaSaleDocument()
    {
        return $this->belongsTo(SaleDocument::class, 'rented_via_sale_document_id');
    }

    public function saleDocumentItems()
    {
        return $this->belongsToMany(SaleDocumentItem::class, 'sale_document_item_serials');
    }

    public function repairTickets()
    {
        return $this->hasMany(RepairTicket::class);
    }

    public function installationRecords()
    {
        return $this->hasMany(InstallationRecord::class);
    }
}
