<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

// 🗑️ [2026-09-17] ยกเลิก installation_equipment_items ทั้งตาราง — เดิมเป็นแค่รายการบันทึกต้นทุน/ตำแหน่งไว้ดูเฉย ๆ
// ไม่เคยตัดสต๊อกจริง (ผู้ใช้ยืนยันให้ "แทนที่เลย") ตอนนี้แทนที่ด้วยเอกสาร sale_documents ประเภท
// 'installation_issue' ที่ตัดสต๊อกจริงทันทีหลังอนุมัติแทน (ดู SaleDocumentController::approve()/cancel()
// $stockOutTypes) ตาราง/โมเดล/คอนโทรลเลอร์เดิม (InstallationEquipmentItem/InstallationEquipmentController) ถูกลบไป
// พร้อมกัน — ยืนยันแล้วว่าตาราง (และ installation_records) มี 0 แถวในระบบตอนนี้ ไม่มีข้อมูลจริงต้องย้าย
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('installation_equipment_items');
    }

    public function down(): void
    {
        // 🛡️ ตั้งใจไม่ recreate โครงสร้างเดิม — ฟีเจอร์นี้ถูกแทนที่ถาวรแล้ว ถ้าต้อง rollback จริง ๆ ให้ดู
        // migration เดิม 2026_08_24_070000_create_installation_equipment_items_table.php +
        // 2026_09_11_110929_add_location_to_installation_equipment_items_table.php แทน
    }
};
