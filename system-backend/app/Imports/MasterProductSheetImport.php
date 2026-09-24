<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToArray;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Services\PendingImportReceipt;

class MasterProductSheetImport implements ToArray, WithStartRow, WithChunkReading
{
    // 🛡️ เก็บ SKU ที่เจอแล้วข้าม chunk (instance เดียวกันถูกใช้ซ้ำทุก chunk ของไฟล์เดียวกัน — ดู
    // ProductsImport::sheets()) กัน SKU ซ้ำในไฟล์เดียวกันเงียบๆ ทับข้อมูลกันเอง (updateOrCreate ใช้ sku
    // เป็น key เดียว — เคยเกิดจริง: หลายแถวที่คอลัมน์เลื่อนผิดตำแหน่งดันมี sku ที่กลายเป็นค่าเดียวกันหมด
    // เช่น "สินค้าสำหรับขาย" ทำให้ 4 สินค้าจริงถูกเขียนทับเหลือแค่ตัวสุดท้ายที่ประมวลผลโดยไม่มี error ใดๆ)
    private array $seenSkus = [];

    // 🆕 [2026-09-24] "นำเข้าสินค้าใหม่" = เพิ่มสินค้าใหม่เท่านั้น — SKU ที่มีอยู่แล้วในบริษัทถูก "ข้ามทั้งแถว" ไม่แตะข้อมูลเดิมเลย
    // (เดิม updateOrCreate ทับ ชื่อ/ราคา/หมวด/หน่วย/ประเภท + บังคับ is_active=1 + เติมยอดยกมาให้สินค้าเดิมที่ยอด 0 เงียบๆ)
    // เก็บสรุปไว้ให้ controller แจ้งผู้ใช้ และให้ sheet Serial Numbers รู้ว่า SKU ไหนเพิ่งถูกสร้างในรอบนี้ (ดู MasterSerialSheetImport)
    public int $createdCount = 0;
    public array $skippedExistingSkus = [];
    public array $createdSkus = []; // sku => true

    // 🚀 ผูกทุกแถวสินค้าที่ "สร้างใหม่" จริงในรอบนี้เข้ากับ import batch เดียวกัน เพื่อให้กด
    // "ยกเลิกการนำเข้าล่าสุด" แล้วลบเฉพาะสินค้าที่เพิ่งสร้างได้ (ดู ProductExcelController::importMaster())
    private ?int $importBatchId;

    // 💰 ถ้าแถวไหนกรอก "ต้นทุนต่อหน่วย" มา (คอลัมน์ 14) จะสร้างใบรับสินค้าจริงให้แทน StockMovement เปล่าๆ
    // (ผ่าน instance ตัวเดียวกันนี้ที่ share กับ MasterSerialSheetImport ด้วย — ดู ProductsImport.php) เพื่อให้
    // ต้นทุนถัวเฉลี่ยของสินค้าคำนวณได้ถูกต้อง (ReportController::averageCostByProduct())
    private ?PendingImportReceipt $pendingReceipt;

    public function __construct(?int $importBatchId = null, ?PendingImportReceipt $pendingReceipt = null)
    {
        $this->importBatchId = $importBatchId;
        $this->pendingReceipt = $pendingReceipt;
    }

    public function startRow(): int
    {
        return 2;
    }
    public function chunkSize(): int
    {
        return 300;
    }

    public function array(array $rows)
    {
        // 🚀 ดึงไอดีบริษัท และเตรียมคลังสินค้า
        $companyId = auth()->user()->company_id ?? 1;
        $defaultWarehouse = \App\Models\Warehouse::firstOrCreate(
            ['company_id' => $companyId],
            ['name' => 'คลังสินค้าหลัก (Default)']
        );

        // 🚀 เอา $vatMap กลับมา (ระบบจะได้หาเจอ)
        $vatMap = [
            '7%' => '7',
            '0%' => '0',
            'ยกเว้น' => 'exempt'
        ];

        foreach ($rows as $index => $row) {
            try {
                $row = is_array($row) ? $row : [];
                $row = array_pad($row, 20, '');

                $sku = trim((string)$row[2]);
                $name = trim((string)$row[4]);

                // ข้ามแถวที่ไม่มี SKU หรือ ชื่อสินค้า
                if ($sku === '' || $name === '') continue;

                // 🛡️ SKU ซ้ำในไฟล์เดียวกัน (ข้ามแถว/ข้าม chunk) ต้อง reject ทันที ห้ามปล่อยให้
                // updateOrCreate() ด้านล่างเขียนทับกันเองเงียบๆ — ระบุแถวและ SKU ให้ผู้ใช้ไปแก้ไฟล์ต้นทาง
                if (isset($this->seenSkus[$sku])) {
                    throw new \Exception("SKU \"{$sku}\" ซ้ำกับแถวที่ " . $this->seenSkus[$sku] . " ในไฟล์เดียวกัน — แต่ละแถวต้องมี SKU ไม่ซ้ำกัน กรุณาตรวจสอบว่าข้อมูลในไฟล์เลื่อนคอลัมน์ผิดตำแหน่งหรือไม่");
                }
                $this->seenSkus[$sku] = $index + 2;

                // 🛡️ SKU มีอยู่แล้วในบริษัทนี้ → ข้ามทั้งแถว ไม่แตะข้อมูล/สต๊อกเดิม (ถ้าจะเพิ่มของให้สินค้าเดิมใช้ปุ่ม "ปรับปรุงสต๊อก",
                // แก้ข้อมูลสินค้าใช้หน้าแก้ไขสินค้า)
                if (Product::where('company_id', $companyId)->where('sku', $sku)->exists()) {
                    $this->skippedExistingSkus[] = $sku;
                    continue;
                }

                // ==========================================
                // 🚀 ย้ายการเช็คหมวดหมู่มาไว้ใน Loop!
                // ==========================================
                $rawType = trim((string)$row[1]);
                $productType = 'inventory'; // ค่าเริ่มต้น
                $canSell = true;
                $canRent = false;
                $isInstallJob = false;
                $isBundle = false;

                // 🛡️ ค่าที่รู้จักจริงมีแค่ 5 แบบ (รวมเว้นว่าง = ขาย) — ค่าอื่นที่ไม่ตรงเลยไม่ควร default
                // เงียบๆ เพราะมักแปลว่าคอลัมน์เลื่อนผิดตำแหน่ง (เคยเกิดจริง: ค่าที่หลุดมาคือเลข ID เก่า)
                $knownTypes = ['', 'สินค้าสำหรับเช่า', 'สินค้าสำหรับงานติดตั้ง', 'บริการ', 'สินค้าสำหรับขาย', 'สินค้าชุด (Bundle)'];
                if (!in_array($rawType, $knownTypes, true)) {
                    throw new \Exception("ประเภทสินค้า \"{$rawType}\" ไม่ถูกต้อง ต้องเป็นหนึ่งใน: สินค้าสำหรับขาย, สินค้าสำหรับเช่า, สินค้าสำหรับงานติดตั้ง, บริการ, สินค้าชุด (Bundle) หรือเว้นว่างไว้ (=สินค้าสำหรับขาย) — ตรวจสอบว่าข้อมูลในไฟล์เลื่อนคอลัมน์ผิดตำแหน่งหรือไม่");
                }

                if ($rawType === 'สินค้าสำหรับเช่า') {
                    $productType = 'inventory';
                    $canSell = false;
                    $canRent = true;
                } elseif ($rawType === 'สินค้าสำหรับงานติดตั้ง') {
                    $productType = 'inventory';
                    $canSell = false;
                    $isInstallJob = true;
                } elseif ($rawType === 'บริการ') {
                    $productType = 'service';
                    $canSell = true;
                } elseif ($rawType === 'สินค้าชุด (Bundle)') {
                    // 🆕 นำเข้าได้แค่ตัวชุดเปล่าๆ (ชื่อ/ราคา) — is_bundle=true, product_type บังคับเป็น
                    // 'non-inventory' ให้ตรงกับ ProductController::store()/update() ตอนสร้างจากหน้าเว็บปกติ
                    // ส่วนประกอบ (product_bundle_items) ต้องไปเพิ่มเองทีหลังที่หน้าแก้ไขสินค้า เพราะ 1 แถว
                    // Excel เก็บรายการส่วนประกอบแบบจำนวนไม่แน่นอนไม่ได้
                    $productType = 'non-inventory';
                    $canSell = true;
                    $isBundle = true;
                }
                // ==========================================

                // 🛡️ ราคาต้องเป็นตัวเลขจริง — (float) ของสตริงที่ไม่ใช่ตัวเลข (เช่น ชื่อรุ่นสินค้าที่หลุดมา
                // จากคอลัมน์เลื่อนผิดตำแหน่ง) จะได้ 0.0 เงียบๆ โดยไม่มีใครรู้ตัว
                $rawPrice = trim((string)$row[8]);
                if ($rawPrice !== '' && !is_numeric($rawPrice)) {
                    throw new \Exception("ราคามาตรฐาน \"{$rawPrice}\" ไม่ใช่ตัวเลข — ตรวจสอบว่าข้อมูลในไฟล์เลื่อนคอลัมน์ผิดตำแหน่งหรือไม่");
                }

                $rawVat = trim((string)$row[9]);
                $vatType = array_key_exists($rawVat, $vatMap) ? $vatMap[$rawVat] : (in_array($rawVat, $vatMap) ? $rawVat : '0');

                $hasSnStr = trim((string)$row[12]);
                $hasSn = ($hasSnStr === 'มี' || $hasSnStr === '1');

                // 🚀 สร้างสินค้า (ใหม่เท่านั้น — SKU เดิมถูกข้ามไปแล้วด้านบน)
                $product = Product::create(
                    [
                        'sku' => $sku,
                        'company_id' => $companyId,
                        'product_type' => $productType,
                        'can_sell' => $canSell,
                        'can_rent' => $canRent,
                        'is_install_job' => $isInstallJob,
                        'is_bundle' => $isBundle,
                        'barcode' => trim((string)$row[3]),
                        'name' => $name,
                        'category_id' => $this->getId(\App\Models\ProductCategory::class, $row[5], $companyId),
                        'brand_id' => $this->getId(\App\Models\Brand::class, $row[6], $companyId),
                        'model_name' => trim((string)$row[7]),
                        'price' => (float)$row[8],
                        'vat_type' => $vatType,
                        'unit_id' => $this->getId(\App\Models\Unit::class, $row[10], $companyId),
                        'low_stock_threshold' => (int)$row[11],
                        'has_serial_number' => $hasSn,
                        'is_active' => 1
                    ]
                );
                $this->createdCount++;
                $this->createdSkus[$sku] = true;

                // 🛡️ แท็ก import_batch_id ให้สินค้าที่สร้างใหม่ เพื่อให้ "ยกเลิกการนำเข้าล่าสุด" ลบได้เฉพาะสินค้าที่เพิ่งสร้างในรอบนี้
                // (สินค้าเดิมไม่เคยถูกแตะแล้ว จึงไม่มีทางถูก undo ลบทิ้งไปด้วย)
                if ($this->importBatchId) {
                    $product->update(['import_batch_id' => $this->importBatchId]);
                }

                $startQty = (int)$row[13];
                // 💰 ต้นทุนต่อหน่วย (คอลัมน์ 14) — เว้นว่างได้ ถ้ากรอกมาจะสร้างใบรับสินค้าจริงแทน (ดูด้านล่าง)
                $rawCost = trim((string)$row[14]);
                if ($rawCost !== '' && !is_numeric($rawCost)) {
                    throw new \Exception("ต้นทุนต่อหน่วย \"{$rawCost}\" ไม่ใช่ตัวเลข — ตรวจสอบว่าข้อมูลในไฟล์เลื่อนคอลัมน์ผิดตำแหน่งหรือไม่");
                }
                $costPrice = $rawCost !== '' ? (float)$rawCost : null;

                // 🚀 ถ้ายกมามีสต็อก และไม่มี S/N ให้เติมสต็อกเข้าคลังเลย — ข้ามแถวสินค้าชุด (Bundle) เสมอ
                // เพราะไม่มีสต็อกของตัวเอง (ตัดสต็อกเฉพาะส่วนประกอบตอนขายผ่าน product_bundle_items แทน)
                if (!$hasSn && !$isBundle && $startQty > 0) {
                    $balance = StockBalance::firstOrCreate(
                        ['product_id' => $product->id, 'company_id' => $companyId, 'warehouse_id' => $defaultWarehouse->id],
                        ['qty' => 0]
                    );

                    if ($balance->qty == 0) {
                        if ($costPrice !== null && $this->pendingReceipt) {
                            // 💰 มีต้นทุนกรอกมา — สร้าง/ต่อรายการในใบรับสินค้าจริง แทน StockMovement เปล่าๆ
                            $this->pendingReceipt->addItem([
                                'product_id' => $product->id,
                                'quantity' => $startQty,
                                'unit_price' => $costPrice,
                            ]);
                        } else {
                            $movement = StockMovement::create([
                                'product_id' => $product->id,
                                'user_id' => auth()->id() ?? 1,
                                'type' => 'in',
                                'quantity' => $startQty,
                                'reference_number' => 'IMP-' . date('Ymd-His') . '-' . $sku,
                                'note' => 'ยอดยกมาจากการอัปโหลดสินค้าใหม่'
                            ]);

                            // 🆕 ไม่มีต้นทุนกรอกมา — ใช้ fallbackUnitCost() แทนการปล่อยว่าง
                            \App\Services\StockLotService::recordReceipt([
                                'company_id' => $companyId,
                                'product_id' => $product->id,
                                'warehouse_id' => $defaultWarehouse->id,
                                'qty' => $startQty,
                                'source_type' => 'import',
                                'import_batch_id' => $this->importBatchId,
                                'stock_movement_id' => $movement->id,
                                'reference_number' => $movement->reference_number,
                            ]);
                        }
                        $balance->qty = $startQty;
                        $balance->save();
                    }
                }
            } catch (\Exception $e) {
                // DomainException = ข้อผิดพลาดที่มาจากข้อมูลในไฟล์ (ตอบผู้ใช้ 422 พร้อมแถว/SKU) — ดู ProductExcelController::importMaster()
                throw new \DomainException("พังที่แถว " . ($index + 2) . " SKU [{$sku}]: " . $e->getMessage());
            }
        }
    }

    private function getId($modelClass, $name, $companyId)
    {
        $name = trim((string)$name);
        if (!$name || $name === '-' || !class_exists($modelClass)) return null;
        return $modelClass::firstOrCreate(
            ['name' => $name, 'company_id' => $companyId],
            ['company_id' => $companyId]
        )->id;
    }
}
