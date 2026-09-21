<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetPhoto extends Model
{
    protected $fillable = ['asset_id', 'path'];

    protected $appends = ['photo_url'];

    public function asset()
    {
        return $this->belongsTo(Asset::class);
    }

    public function getPhotoUrlAttribute(): string
    {
        return asset('storage/' . $this->path);
    }
}
