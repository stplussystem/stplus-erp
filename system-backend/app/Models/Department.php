<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class Department extends Model
{
    use \App\Traits\BelongsToCompany;

    protected $fillable = ['name', 'description'];

    // 1 แผนก มีพนักงานได้หลายคน
    public function users()
    {
        return $this->hasMany(User::class);
    }
}
