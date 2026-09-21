<?php

namespace App\Services;

use App\Models\GoodsReceipt;

// 🚀 สร้าง "ใบรับสินค้า" (ผ่าน DirectGoodsReceiptService) แบบ lazy — สร้างหัวใบครั้งแรกที่มีแถวกรอกต้นทุนมา
// จริงๆ เท่านั้น แล้วเก็บ instance ไว้ใช้ซ้ำกับแถวถัดๆ ไปในไฟล์เดียวกัน (รวมข้าม sheet หลัก/sheet Serial
// Numbers ในไฟล์ Excel เดียวกันด้วย ถ้า thread instance เดียวกันไปให้ทั้งสอง sheet importer) — กันไม่ให้เกิด
// "ใบรับสินค้าเปล่า" ทุกครั้งที่ผู้ใช้ไม่ได้กรอกคอลัมน์ต้นทุนมาเลยในไฟล์นั้น
//
// instance เดียวกันถูกใช้ซ้ำได้ทุก chunk เพราะ Laravel Excel เรียก array()/collection() บน object เดิมซ้ำๆ
// (ไม่ได้สร้าง instance ใหม่ทุก chunk) — ดู MasterProductSheetImport.php/ProductsSheetImport.php ที่มี
// property อื่นๆ (เช่น $seenSkus) ที่พึ่งพาพฤติกรรมนี้อยู่แล้วเช่นกัน
class PendingImportReceipt
{
    private ?GoodsReceipt $receipt = null;

    public function __construct(
        private readonly int $companyId,
        private readonly int $warehouseId,
        private readonly int $userId,
        private readonly string $note,
    ) {}

    /**
     * @param array{product_id:int, quantity:int, unit_price:float, serials?:string[]} $item
     */
    public function addItem(array $item): void
    {
        if ($this->receipt === null) {
            $this->receipt = DirectGoodsReceiptService::createHeader($this->companyId, $this->userId, $this->note);
        }
        DirectGoodsReceiptService::addItem($this->receipt, $this->companyId, $this->warehouseId, $this->userId, $item);
    }
}
