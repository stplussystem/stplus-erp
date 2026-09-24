<?php

namespace App\Services;

use App\Models\Project;
use App\Models\RentalJob;

// 🪜 [2026-09-24] เลื่อน "ขั้นตอนงาน" (stage) ของโครงการ/งานเช่าไปข้างหน้าอัตโนมัติเมื่อมีเอกสารที่บอกว่างานก้าวหน้าแล้วถูกอนุมัติ
// — เดิม stage เปลี่ยนได้เฉพาะตอนผู้ใช้เลือกเอง (ลืมอัปเดตบ่อย ทำให้หน้าโครงการ/รายงานกำไรขาดทุนแสดงขั้นตอนไม่ตรงความจริง)
// กติกา: เลื่อน "ไปข้างหน้าเท่านั้น" ตามลำดับด้านล่าง ไม่เคยถอยหลัง/ไม่ทับค่าที่ผู้ใช้ตั้งไว้ไกลกว่าเอกสารอยู่แล้ว
// (ผู้ใช้ยังตั้งเป็นขั้นตอนใดก็ได้ด้วยมือเหมือนเดิม) ไม่กระทบ status (active/completed ฯลฯ)
class WorkStageService
{
    private const ORDER = ['quotation', 'purchasing', 'sales_order', 'delivery', 'installation'];

    // ประเภทเอกสารขาย (อนุมัติแล้ว) → ขั้นตอนที่บอกว่างานถึงแล้ว
    public const SALE_DOCUMENT_STAGE = [
        'quotation' => 'quotation',
        'material_issue' => 'sales_order',
        'packing_list' => 'delivery',
        'delivery_note' => 'delivery',
        'installation_issue' => 'installation',
    ];

    public static function advance(?int $projectId, ?int $rentalJobId, string $stage): void
    {
        $target = array_search($stage, self::ORDER, true);
        if ($target === false) return;

        foreach ([[Project::class, $projectId], [RentalJob::class, $rentalJobId]] as [$model, $id]) {
            if (!$id) continue;
            $record = $model::find($id);
            if (!$record) continue;

            $current = $record->stage ? array_search($record->stage, self::ORDER, true) : false;
            if ($current === false || $current < $target) {
                $record->stage = $stage;
                $record->save();
            }
        }
    }
}
