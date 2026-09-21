<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// 🆕 [2026-09-18] snapshot ของชั้น/ห้องก่อนถูกแก้ไข — เขียนโดย InstallationRecordController::update() ทุกครั้งที่
// ค่าชั้น/ห้องเปลี่ยน เพื่อให้ดูย้อนหลังได้ว่าเดิมติดตั้งไว้ที่ไหนก่อนแก้ (ไม่มี updated_at เพราะเป็น log ที่ไม่แก้ไขซ้ำ)
class InstallationLocationHistory extends Model
{
    const UPDATED_AT = null;

    protected $table = 'installation_location_history';

    protected $fillable = ['installation_record_id', 'floor', 'room', 'changed_by'];

    public function installationRecord()
    {
        return $this->belongsTo(InstallationRecord::class);
    }

    public function changedByUser()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
