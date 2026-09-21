<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BelongsToCompany;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class RepairTicket extends Model
{
    use SoftDeletes, BelongsToCompany, LogsActivity;

    protected $fillable = [
        'company_id', 'ticket_number', 'contact_id', 'project_id',
        'product_id', 'product_serial_id', 'reference_sale_document_id',
        'is_external', 'manual_serial_number',
        'status', 'reported_issue', 'diagnosis_notes', 'repair_cost',
        'is_under_warranty', 'received_at', 'returned_at',
        'created_by', 'assigned_to', 'billing_sale_document_id',
    ];

    protected $casts = [
        'received_at' => 'date',
        'returned_at' => 'date',
        'is_under_warranty' => 'boolean',
        'is_external' => 'boolean',
    ];

    // งานซ่อมเป็นจุดแรกที่เปิดใช้ spatie/laravel-activitylog ในระบบนี้ (ของเดิมติดตั้งไว้เฉยๆ ไม่เคยใช้)
    // เก็บ log เฉพาะการเปลี่ยน status เพื่อโชว์ timeline งานซ่อมให้ลูกค้า/พิมพ์เอกสารได้
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['status'])
            ->logOnlyDirty();
    }

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function productSerial()
    {
        return $this->belongsTo(ProductSerial::class);
    }

    public function referenceSaleDocument()
    {
        return $this->belongsTo(SaleDocument::class, 'reference_sale_document_id');
    }

    public function billingSaleDocument()
    {
        return $this->belongsTo(SaleDocument::class, 'billing_sale_document_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function photos()
    {
        return $this->hasMany(RepairTicketPhoto::class);
    }
}
