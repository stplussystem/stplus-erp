<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Casts\Attribute;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles, SoftDeletes, \App\Traits\BelongsToCompany;

    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'signature_path',
        'phone',
        'avatar',
        'department_id',
        'is_active',
        'company_id',
        'is_platform_admin'
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // 🛡️ ทุกครั้งที่มี User ใหม่ถูกสร้าง (ไม่ว่าจากจุดไหน — RegisterCompanyController สมัครบริษัทใหม่,
    // UserController::store() ปุ่ม "เพิ่มพนักงาน" ปกติ, หรือจุดใหม่ในอนาคต) ต้องมีแถว company_user
    // ผูกกับบริษัทของตัวเองเสมอ ไม่งั้น hasAccessToCompany()/resolveActiveCompanyId() จะหาไม่เจอ
    // แล้ว login ครั้งแรกจะพังทันทีด้วย "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานบริษัทใดเลย" — บั๊กนี้เคยเกิดจริง
    // ทั้งตอนสมัครบริษัทใหม่และตอนเพิ่มพนักงานปกติ เพราะทั้งสองจุดลืมเขียนแถวนี้ ย้ายมารวมไว้ที่ model
    // เดียวกันเพื่อกันจุดที่สามเกิดขึ้นมาแล้วลืมแก้อีกในอนาคต
    protected static function booted(): void
    {
        static::created(function (User $user) {
            if ($user->company_id) {
                // 🚀 DB::table() คืน query builder ธรรมดา ไม่ใช่ Eloquent — ไม่มี firstOrCreate() ให้ใช้
                // เช็คก่อนเอง แล้วค่อย insert ถ้ายังไม่มี กันทับค่า granted_by เดิมถ้ามีแถวอยู่แล้วจากที่อื่น
                $exists = \Illuminate\Support\Facades\DB::table('company_user')
                    ->where('user_id', $user->id)
                    ->where('company_id', $user->company_id)
                    ->exists();
                if (!$exists) {
                    \Illuminate\Support\Facades\DB::table('company_user')->insert([
                        'user_id' => $user->id,
                        'company_id' => $user->company_id,
                        'granted_by' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        });
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    // 🚀 บริษัททั้งหมดที่ user คนนี้ได้รับสิทธิ์เข้าใช้งาน (รวม home company ผ่าน company_user)
    public function companies()
    {
        return $this->belongsToMany(Company::class, 'company_user')
            ->withPivot('granted_by')
            ->withTimestamps();
    }

    public function hasAccessToCompany(int $companyId): bool
    {
        if ($this->is_platform_admin) {
            return true;
        }

        return $this->companies()->where('companies.id', $companyId)->exists();
    }

    // 🚀 เป็นแอดมินของบริษัทตัวเองไหม (แทนที่การเทียบชื่อ role ว่ามีคำว่า "Super Admin" ผสมอยู่หรือเปล่า)
    public function isCompanyAdmin(): bool
    {
        $this->loadMissing('roles');
        return $this->roles->contains('is_company_admin', true);
    }

    // 🚀 Accessor: แปลง Path รูปโปรไฟล์ให้เป็น Full URL อัตโนมัติ
    protected function avatar(): Attribute
    {
        return Attribute::make(
            get: function (?string $value) {
                if (!$value) return null;
                if (str_starts_with($value, 'http')) return $value;
                return asset('storage/' . $value);
            },
        );
    }

    // 🚀 Accessor: แปลงลายเซ็นเป็น Base64 สำหรับฝัง PDF โดยตรง (เดิม logic นี้เขียนซ้ำแยกกันใน
    // PurchaseOrderController::show() เท่านั้น ทำให้หน้าอื่นที่ต้องใช้ลายเซ็นก่อนบันทึกเอกสาร เช่น
    // ตัวอย่าง PDF ตอนสร้าง PO ไม่มีข้อมูลนี้ให้ใช้เลย — ย้ายมาไว้ที่ model กลางแทน)
    protected function signatureBase64(): Attribute
    {
        return Attribute::make(
            get: function () {
                $rawPath = $this->attributes['signature_path'] ?? null;
                if (!$rawPath) return null;
                if (str_starts_with($rawPath, 'http')) return $rawPath;

                $path = storage_path('app/public/' . $rawPath);
                if (!file_exists($path)) return null;

                $mime = mime_content_type($path);
                $data = file_get_contents($path);
                return 'data:' . $mime . ';base64,' . base64_encode($data);
            },
        );
    }
}
