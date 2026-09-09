<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockMovement extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $guarded = []; // อนุญาตให้บันทึกข้อมูลได้ทุกฟิลด์

    // 🚀 undo_meta เก็บค่าก่อน/หลังของการนำเข้า Excel (previous_qty/new_qty ฯลฯ) ให้
    // ProductExcelController::undoImportBatch() อ่าน/เขียนเป็น array ได้ตรงๆ ไม่ต้อง json_decode/encode เอง
    protected $casts = [
        'undo_meta' => 'array',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function serials()
    {
        return $this->hasMany(ProductSerial::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
