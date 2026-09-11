<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanyAccessLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'company_id',
        'action',
        'actor_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }
}
