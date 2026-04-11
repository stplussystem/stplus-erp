<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockBalance extends Model
{
    // 💡 เปิดประตูให้บันทึกข้อมูลได้ทุกฟิลด์ (รวมถึง company_id)
    protected $guarded = [];
}
