<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RepairTicketPhoto extends Model
{
    protected $fillable = ['repair_ticket_id', 'path'];

    protected $appends = ['photo_url'];

    public function repairTicket()
    {
        return $this->belongsTo(RepairTicket::class);
    }

    public function getPhotoUrlAttribute(): string
    {
        return asset('storage/' . $this->path);
    }
}
