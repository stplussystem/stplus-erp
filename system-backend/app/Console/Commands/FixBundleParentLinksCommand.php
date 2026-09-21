<?php

namespace App\Console\Commands;

use App\Models\SaleDocumentItem;
use App\Models\ProductBundleItem;
use Illuminate\Console\Command;

/**
 * 🛡️ ซ่อมข้อมูลเก่าที่เสียจากบั๊กใน SaleDocumentController::revise() — เดิม revise() ใช้ replicate() คัดลอก
 * แถวสินค้าตรงๆ โดยไม่แก้ parent_item_id ของแถวลูก (ส่วนประกอบสินค้าชุด) ให้ชี้ไปหา ID ของแถวแม่ที่เพิ่ง
 * clone ใหม่ — ทำให้แถวลูกในเอกสารเวอร์ชันที่ revise แล้วชี้ parent_item_id ไปหา ID ของแถวแม่ใน "เอกสารเก่า
 * คนละใบ" (ที่ถูกล็อกสถานะ Revised ไปแล้ว) จากนั้นถ้ามีการแก้ไข+บันทึกเอกสารเวอร์ชันใหม่อีกที (เช่น แก้จำนวน
 * แถวแม่) หน้าเว็บจะหาแถวแม่ในเอกสารเดียวกันไม่เจอ (parent_item_id ชี้ข้ามเอกสาร) เลยไม่ส่ง parent_index ของ
 * แถวลูกนั้นไปด้วยตอนบันทึก ทำให้ backend บันทึกทับเป็นแถวลอย (parent_item_id = NULL) ถาวร — พบข้อมูลจริงทั้ง
 * 2 อาการนี้ปนกันอยู่ในระบบ (ดู plan file ตอนวางแผนแก้บั๊กนี้)
 *
 * ใช้ product_bundle_items (สูตรสินค้าชุดจริงในระบบ) เป็นความจริงตั้งต้นแทนการเดาจาก parent_item_id เดิม —
 * สแกนทุกเอกสาร หาแถว "แม่สินค้าชุด" ตัวจริง (parent_item_id เป็น null + product เป็นสินค้าชุด) แล้วไล่หา
 * แถวส่วนประกอบของสูตรนั้นในเอกสารเดียวกัน (product ตรงกับส่วนประกอบ + unit_price = 0 ตามข้อบังคับของแถวลูก
 * เสมอ — กันจับสินค้าที่ลูกค้าซื้อแยกเป็นรายการปกติที่บังเอิญ product_id ซ้ำกับส่วนประกอบของชุดอื่นมาผิดๆ)
 * ถ้าแถวนั้นยังไม่ได้ผูกกับแม่ตัวนี้ให้ถูกต้อง (parent_item_id เป็น null หรือชี้ไปคนละเอกสาร) จะผูกใหม่ให้ และ
 * คำนวณจำนวนใหม่ตามสัดส่วนสูตร × จำนวนแม่ปัจจุบันด้วย (เพราะจำนวนเดิมที่ค้างไว้เป็นค่าเก่าที่ผิดอยู่แล้ว
 * เป็นสาเหตุของบั๊กนี้โดยตรง — ไม่ใช่ค่าที่ควรรักษาไว้เหมือนตอนแก้ loadFromDocument() ที่ยึดอัตราส่วนเดิมของ
 * เอกสารที่ FK ยังถูกต้องอยู่)
 *
 * ⚠️ แก้ไขข้อมูลถาวร — สำรองฐานข้อมูลก่อนรันเสมอ เช่น:
 *   docker exec system_mariadb mysqldump -u root -p [database] > backup_before_fix_bundle_parent_links.sql
 * รัน --dry-run ก่อนเพื่อดูรายการที่จะแก้ โดยไม่เขียนอะไรลง DB จริง
 */
class FixBundleParentLinksCommand extends Command
{
    protected $signature = 'sale-documents:fix-bundle-parent-links {--dry-run : แสดงรายการที่จะแก้ โดยไม่เขียนอะไรลง DB จริง}';

    protected $description = 'ซ่อม parent_item_id/quantity ของแถวส่วนประกอบสินค้าชุดที่หลุดจากแม่ (เกิดจากบั๊กเก่าใน revise())';

    public function handle(): int
    {
        $isDryRun = (bool) $this->option('dry-run');

        // สูตรสินค้าชุดจริงในระบบ: bundle_product_id => [component_product_id => qty_per_unit]
        $recipes = ProductBundleItem::get(['bundle_product_id', 'component_product_id', 'quantity'])
            ->groupBy('bundle_product_id')
            ->map(fn ($rows) => $rows->keyBy('component_product_id')->map(fn ($r) => (float) $r->quantity));

        if ($recipes->isEmpty()) {
            $this->info('ไม่มีสินค้าชุด (Bundle) ในระบบเลย ไม่มีอะไรต้องตรวจสอบ');
            return self::SUCCESS;
        }

        $itemsByDoc = SaleDocumentItem::get(['id', 'sale_document_id', 'product_id', 'parent_item_id', 'quantity', 'unit_price'])
            ->groupBy('sale_document_id');

        $fixedCount = 0;

        foreach ($itemsByDoc as $docId => $items) {
            // แถวแม่สินค้าชุดตัวจริงของเอกสารนี้ (ต้องเป็นแถวบนสุด ไม่ใช่แถวลูกของใครอยู่แล้ว)
            $bundleParents = $items->filter(fn ($it) => $it->parent_item_id === null && $recipes->has($it->product_id));

            foreach ($bundleParents as $parent) {
                $recipe = $recipes->get($parent->product_id);

                foreach ($recipe as $componentProductId => $qtyPerUnit) {
                    // หาแถวส่วนประกอบของสูตรนี้ในเอกสารเดียวกัน — unit_price=0 เป็นข้อบังคับของแถวลูกเสมอ
                    // (store()/update() บังคับไว้) ใช้กันจับสินค้าที่ขายแยกเป็นรายการปกติราคาจริงมาผิดๆ
                    $candidate = $items->first(fn ($it) => (int) $it->product_id === (int) $componentProductId
                        && $it->id !== $parent->id
                        && (float) $it->unit_price === 0.0
                        && (int) $it->parent_item_id !== (int) $parent->id);

                    if (!$candidate) continue; // ไม่มีแถวนี้ในเอกสาร หรือผูกกับแม่ตัวนี้ถูกต้องอยู่แล้ว

                    $correctQty = $qtyPerUnit * (float) $parent->quantity;
                    $this->line(
                        "  เอกสาร #{$docId}: item id={$candidate->id} parent_item_id " .
                        ($candidate->parent_item_id ?? 'NULL') . " -> {$parent->id}, quantity {$candidate->quantity} -> {$correctQty}"
                    );

                    if (!$isDryRun) {
                        SaleDocumentItem::where('id', $candidate->id)->update([
                            'parent_item_id' => $parent->id,
                            'quantity' => $correctQty,
                        ]);
                    }
                    $fixedCount++;
                }
            }
        }

        $this->newLine();
        if ($fixedCount === 0) {
            $this->info('ตรวจสอบครบแล้ว ไม่พบแถวส่วนประกอบสินค้าชุดที่หลุดจากแม่เลย');
        } else {
            $this->info(($isDryRun ? '[DRY RUN] จะแก้' : 'แก้แล้ว') . " {$fixedCount} แถว");
        }

        return self::SUCCESS;
    }
}
