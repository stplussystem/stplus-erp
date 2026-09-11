<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->boolean('is_default')->default(false)->after('company_id');
        });

        // Backfill: ทุกบริษัทต้องมี default warehouse อย่างน้อย 1 แห่ง เพื่อให้ stock movement มีที่อ้างอิงเสมอ
        // (บริษัทที่ยังไม่มีคลังเลย จะได้ "คลังหลัก" ให้อัตโนมัติ ส่วนบริษัทที่มีคลังอยู่แล้วแต่ยังไม่ได้ตั้ง default จะใช้คลังแรกสุดเป็น default)
        $companyIds = DB::table('companies')->pluck('id');
        foreach ($companyIds as $companyId) {
            $hasDefault = DB::table('warehouses')->where('company_id', $companyId)->where('is_default', true)->exists();
            if ($hasDefault) continue;

            $firstWarehouse = DB::table('warehouses')->where('company_id', $companyId)->orderBy('id')->first();
            if ($firstWarehouse) {
                DB::table('warehouses')->where('id', $firstWarehouse->id)->update(['is_default' => true]);
            } else {
                DB::table('warehouses')->insert([
                    'company_id' => $companyId,
                    'name' => 'คลังหลัก',
                    'is_default' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropColumn('is_default');
        });
    }
};
