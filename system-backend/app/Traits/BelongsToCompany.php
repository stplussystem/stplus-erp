<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

/**
 * @mixin \Illuminate\Database\Eloquent\Model
 */
trait BelongsToCompany
{
    protected static function bootBelongsToCompany()
    {
        // 1. 🔍 กฎตอน "ดึงข้อมูล" (Global Scope)
        static::addGlobalScope('company', function (Builder $builder) {
            if (auth()->check()) {
                $user = auth()->user();

                // 🚀 God Mode: ถ้าเป็น Platform Admin ให้หลุดรอดการเช็ค company_id ไปได้เลย (มองเห็นทุกอย่าง)
                if (isset($user->is_platform_admin) && $user->is_platform_admin) {
                    return;
                }

                // คนธรรมดา มองเห็นแค่ของบริษัทตัวเอง
                if ($user->company_id) {
                    // ใช้ getQuery()->from เพื่อป้องกันปัญหาชื่อ Column ซ้ำเวลา Join ตาราง
                    $builder->where($builder->getQuery()->from . '.company_id', $user->company_id);
                }
            }
        });

        // 2. 📝 กฎตอน "บันทึกข้อมูลใหม่"
        static::creating(function ($model) {
            if (auth()->check()) {
                $user = auth()->user();

                // 🚀 ถ้าเป็นคนธรรมดา และข้อมูลยังไม่มี company_id ให้แสตมป์ของบริษัทตัวเองลงไป
                // แต่ถ้าเป็น Platform Admin ข้อมูลจะไม่ถูกยัด company_id อัตโนมัติ (ต้องระบุเองตอนสร้าง)
                if (empty($model->company_id) && (!isset($user->is_platform_admin) || !$user->is_platform_admin)) {
                    $model->company_id = $user->company_id;
                }
            }
        });
    }
}
