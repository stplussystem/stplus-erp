<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // 🛡️ government_contracts.contract_due_date เดิมเก็บเป็น string เดียวคั่นด้วย , (เช่น
    // "6/4/2568 , 13/2/2568") เพราะ 1 สัญญามีวันครบกำหนดได้จริงหลายงวด/เฟส — ย้ายมาเป็นตารางแยกที่นี่
    // เพื่อให้ query "ใกล้หมดอายุ" ได้จริง (เดิมทำไม่ได้เพราะเป็น string)
    public function up(): void
    {
        Schema::create('government_contract_due_dates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('government_contract_id')->constrained()->cascadeOnDelete();
            $table->date('due_date')->nullable(); // nullable กันพังถ้า parse ข้อมูลเก่าไม่ได้
            $table->string('note')->nullable(); // เช่น "งวดที่ 1", "ต่ออายุ"
            $table->timestamps();
        });

        // 🚀 migrate ข้อมูลเก่า: รูปแบบเดิมเป็น พ.ศ. D/M/YYYY (เช่น "6/4/2568") คั่นหลายวันด้วย , —
        // ลบ 543 ปีก่อนแปลงเป็นวันที่จริง ถ้า parse ไม่ได้ (รูปแบบเพี้ยน) เก็บ string เดิมลง note แทน
        // ไม่ throw ทิ้งข้อมูลเดิม (ฐานข้อมูล dev ปัจจุบันไม่มีแถวใน government_contracts เลย แต่เผื่อไว้
        // สำหรับฐานข้อมูลอื่นที่อาจมีข้อมูลจริงอยู่)
        if (Schema::hasColumn('government_contracts', 'contract_due_date')) {
            $rows = DB::table('government_contracts')->whereNotNull('contract_due_date')->get();
            foreach ($rows as $row) {
                foreach (explode(',', $row->contract_due_date) as $piece) {
                    $piece = trim($piece);
                    if ($piece === '') continue;

                    $parsed = null;
                    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $piece, $m)) {
                        $year = (int) $m[3] > 2400 ? (int) $m[3] - 543 : (int) $m[3];
                        try {
                            $parsed = \Carbon\Carbon::createFromDate($year, (int) $m[2], (int) $m[1])->toDateString();
                        } catch (\Throwable $e) {
                            $parsed = null;
                        }
                    }

                    DB::table('government_contract_due_dates')->insert([
                        'government_contract_id' => $row->id,
                        'due_date' => $parsed,
                        'note' => $parsed ? null : $piece,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            Schema::table('government_contracts', fn (Blueprint $table) => $table->dropColumn('contract_due_date'));
        }
    }

    public function down(): void
    {
        // 🛡️ rollback คืนคอลัมน์ string เดิมได้ แต่ไม่ประกอบ string คั่น , กลับมาจากตารางแยก (best-effort เท่านั้น)
        if (!Schema::hasColumn('government_contracts', 'contract_due_date')) {
            Schema::table('government_contracts', function (Blueprint $table) {
                $table->string('contract_due_date')->nullable()->after('guarantee_date');
            });
        }
        Schema::dropIfExists('government_contract_due_dates');
    }
};
