<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Warehouse extends Model
{
    use HasFactory;
    use \App\Traits\BelongsToCompany;

    protected $guarded = [];
    // protected $fillable = ['name', 'location', 'floor', 'company_id'];
    public function company()
    {
        return $this->belongsTo(\App\Models\Company::class);
    }

    // 🏬 หา warehouse_id ที่ควรใช้จริง: ใช้ตัวที่ระบุมา (ถ้าเป็นของบริษัทนี้จริง) ไม่งั้น fallback ไปคลัง default ของบริษัท
    public static function resolveFor(int $companyId, $requestedId = null): ?int
    {
        if ($requestedId) {
            $owned = static::where('id', $requestedId)->where('company_id', $companyId)->exists();
            if ($owned) return (int) $requestedId;
        }

        $default = static::where('company_id', $companyId)->where('is_default', true)->first();
        if ($default) return $default->id;

        // เผื่อบริษัทเก่าที่ยังไม่มี default ตั้งไว้ (ไม่ควรเกิดขึ้นหลัง migrate backfill แล้ว) ใช้คลังแรกที่เจอแทน
        $fallback = static::where('company_id', $companyId)->orderBy('id')->first();
        return $fallback?->id;
    }
}
