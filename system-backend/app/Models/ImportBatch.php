<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// 🚀 บันทึกประวัติการนำเข้า Excel สินค้าแต่ละครั้ง (ทั้ง "นำเข้าสินค้าใหม่" และ "ปรับปรุงสต๊อก/S/N") ให้
// ย้อนกลับ/ลบข้อมูลที่นำเข้าล่าสุดได้ ถ้าเผลอเลือกไฟล์ผิด — ดู ProductExcelController::undoImportBatch()
class ImportBatch extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $guarded = [];

    protected $casts = [
        'undone_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function undoneBy()
    {
        return $this->belongsTo(User::class, 'undone_by');
    }
}
