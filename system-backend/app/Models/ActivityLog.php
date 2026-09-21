<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

// 🕵️ บันทึกว่าใครทำอะไร เมื่อไหร่ จาก IP ไหน — ใช้ BelongsToCompany เหมือนโมเดลอื่นๆ ในระบบ (~25 โมเดล)
// เพื่อให้ Super Admin ของแต่ละบริษัทเห็นแค่ log บริษัทตัวเอง ส่วน Platform Admin (is_platform_admin)
// หลุดพ้น global scope นี้ไปเลย เห็น log ของทุกบริษัท ตรงตามที่ผู้ใช้ยืนยันไว้
class ActivityLog extends Model
{
    use BelongsToCompany;

    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'user_id',
        'user_name',
        'user_email',
        'method',
        'path',
        'action',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
