<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Brand extends Model
{
    use \App\Traits\BelongsToCompany;
    use HasFactory;
    protected $guarded = []; // ปลดล็อกให้บันทึกข้อมูลได้
}
