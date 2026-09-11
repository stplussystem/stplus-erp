<?php

namespace App\Services;

use App\Models\GoodsReceipt;
use App\Models\StockMovement;
use App\Models\StockBalance;
use App\Models\ProductSerial;

// 🚀 ดึง logic มาจาก GoodsReceiptController::storeDirectGoodsReceipt() ให้เรียกซ้ำได้จากที่อื่น (ไม่ผ่าน HTTP
// request) — ใช้ตอนมีการ "กรอกต้นทุน" มาพร้อมกับ Excel นำเข้าสินค้าใหม่/รับสินค้าด้วยมือ/ปรับปรุงสต๊อก เพื่อให้
// ต้นทุนถัวเฉลี่ยของสินค้า (ReportController::averageCostByProduct()/ProductController::averageCost()) คำนวณ
// ได้ถูกต้อง เพราะสูตรนั้นอ่านจาก goods_receipt_items.unit_price เท่านั้น — สร้าง "ใบรับสินค้า" จริงเบื้องหลัง
// แทนที่จะเพิ่มคอลัมน์ต้นทุนแยกใน stock_movements เอง (ไม่ต้องแก้สูตรคำนวณต้นทุนถัวเฉลี่ยที่ไหนเลย)
//
// ผู้เรียกต้องห่อ DB::transaction()/DB::beginTransaction() เองก่อนเรียกฟังก์ชันนี้เสมอ — ไม่เปิด transaction
// ซ้ำในนี้ เพราะทุกจุดที่เรียกอยู่แล้ว (Excel import ที่ประมวลผลทีละ chunk, StockMovementController) ต่างก็ห่อ
// transaction ของตัวเองไว้รอบการทำงานทั้งหมดอยู่แล้ว
//
// แยก createHeader()/addItem() ออกจากกัน (แทนที่จะมีแค่ create($items) เดียวรับทุกแถวพร้อมกัน) เพื่อรองรับ
// Excel import ที่อ่านทีละ chunk (300 แถว) — สร้างหัวใบรับสินค้าครั้งแรกที่เจอแถวมีต้นทุน แล้วเรียก addItem()
// ทีละแถวต่อๆ ไปในไฟล์เดียวกันได้ โดยไม่ต้อง buffer ทุกแถวไว้ในหน่วยความจำก่อนแล้วค่อยสร้างทีเดียวตอนจบไฟล์
// (ดู PendingImportReceipt.php ซึ่งเป็นตัว wrap logic "สร้างครั้งแรกที่จำเป็นเท่านั้น" ไว้ให้ import class ใช้)
class DirectGoodsReceiptService
{
    public static function createHeader(int $companyId, int $userId, string $note): GoodsReceipt
    {
        // มีเลขที่เอกสารเป็นชุดเดียวกับ "รับตรงไม่มี PO" เพราะเป็นเหตุการณ์แบบเดียวกัน (รับสินค้าเข้าคลังจริง
        // โดยไม่มีใบสั่งซื้ออ้างอิง) แค่ต้นกำเนิดของข้อมูลต่างกัน (Excel/ฟอร์มมือ/ปรับปรุงสต๊อก แทนการกรอกใน
        // หน้า "รับสินค้าเข้าโดยตรง" ตรงๆ)
        $grNumber = DocumentService::generate('goods_receipt_direct', $companyId);

        return GoodsReceipt::create([
            'company_id' => $companyId,
            'purchase_order_id' => null,
            'contact_id' => null,
            'gr_number' => $grNumber,
            'reference_number' => null,
            'received_date' => now(),
            'status' => 'Completed',
            'note' => $note,
            'created_by' => $userId,
        ]);
    }

    /**
     * @param array{product_id:int, quantity:int, unit_price:float, serials?:string[]} $item
     */
    public static function addItem(
        GoodsReceipt $gr,
        int $companyId,
        int $warehouseId,
        int $userId,
        array $item,
    ): void {
        $gr->items()->create([
            'product_id' => $item['product_id'],
            'quantity' => $item['quantity'],
            'unit_price' => $item['unit_price'],
        ]);

        $movement = StockMovement::create([
            'product_id' => $item['product_id'],
            'type' => 'in',
            'quantity' => $item['quantity'],
            'reference_number' => $gr->gr_number,
            'note' => $gr->note,
            'user_id' => $userId,
            'warehouse_id' => $warehouseId,
            'company_id' => $companyId,
        ]);

        $balance = StockBalance::lockedFor($item['product_id'], $companyId, $warehouseId);
        $balance->qty += $item['quantity'];
        $balance->save();

        foreach (($item['serials'] ?? []) as $sn) {
            $sn = trim((string) $sn);
            if ($sn === '') continue;

            ProductSerial::create([
                'product_id' => $item['product_id'],
                'serial_number' => $sn,
                'warehouse_id' => $warehouseId,
                'stock_movement_id' => $movement->id,
                'status' => 'available',
                'company_id' => $companyId,
            ]);
        }
    }

    /**
     * ทางลัดสำหรับผู้เรียกที่มีรายการครบพร้อมกันตั้งแต่แรก (เช่น รับ/เบิกสินค้าด้วยมือ — คำขอ HTTP เดียวจบ
     * ไม่ได้อ่านทีละ chunk แบบ Excel) — สร้างหัวใบ + เพิ่มทุกรายการในทีเดียว
     *
     * @param array<int, array{product_id:int, quantity:int, unit_price:float, serials?:string[]}> $items
     */
    public static function create(
        int $companyId,
        int $warehouseId,
        int $userId,
        string $note,
        array $items,
    ): GoodsReceipt {
        $gr = self::createHeader($companyId, $userId, $note);
        foreach ($items as $item) {
            self::addItem($gr, $companyId, $warehouseId, $userId, $item);
        }
        return $gr;
    }
}
