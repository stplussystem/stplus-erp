<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // ตารางเก็บ setting ระดับแพลตฟอร์ม (ไม่ผูกกับบริษัทไหนบริษัทหนึ่ง) เช่น เปิด/ปิด auto-sync permission ให้ทุก tenant
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        // ค่าเริ่มต้น: sync ให้ทุกบริษัททันที (ตรงกับพฤติกรรมเดิมตอนสมัครบริษัทใหม่ที่ syncPermissions(Permission::all()))
        DB::table('system_settings')->insert([
            'key' => 'auto_sync_new_permissions_to_all_companies',
            'value' => '1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
