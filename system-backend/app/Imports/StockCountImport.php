<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use App\Models\Product;
use App\Models\ProductSerial;
use App\Models\StockBalance;
use App\Models\StockLot;
use App\Models\StockMovement;
use App\Services\StockLotFifoService;
use App\Services\StockLotService;
use Illuminate\Support\Facades\DB;

// 🆕 แทนที่ ProductsSheetImport+SerialsSheetImport (2 ชีทแยกกัน, ปรับยอดแบบ diff จำนวนรวม) ด้วยตัวอ่านชีทเดียว
// 1 แถวต่อ 1 หน่วยจริง คู่กับ StockCountExport.php — "การมี/ไม่มีแถวอยู่" คือยอดนับจริงโดยตรง ไม่ใช่การกรอกตัวเลข
//
// กติกาแยกตามชนิดแถว (ระบุจาก Serial Number / รหัสล็อต ที่กรอกมา — ต้องมีอย่างใดอย่างหนึ่ง ไม่ใช่ทั้งคู่):
// - แถว S/N เดิม (คอลัมน์ Serial Number มีค่า ตรงกับ ProductSerial ที่มีอยู่แล้ว): เปลี่ยนสถานะได้เฉพาะตอนกรอก
//   "สถานะ" เป็นชำรุด/สูญหาย เท่านั้น (เหมือนเดิมทุกประการ) — ถ้าแถวหายไปเฉยๆ ไม่ถือว่าสูญหาย (กันเผลอ)
// - แถว S/N ใหม่ (Serial Number ไม่ตรงกับที่มีอยู่ในระบบ): สร้าง S/N ใหม่ + รับเข้า 1 หน่วย (เหมือนเดิมทุกประการ)
// - แถวล็อตเดิม (คอลัมน์ รหัสล็อต มีค่า, ไม่มีสินค้าเป็น S/N): จำนวนแถวที่เหลือในไฟล์ต่อ 1 รหัสล็อต เทียบกับ
//   qty_remaining จริง ณ ตอนนี้ — น้อยกว่า = หายไปเท่าจำนวนที่ต่าง (ตัดล็อตนั้นเจาะจงตรงๆ ไม่ใช่ FIFO เดา)
//   มากกว่า = ข้อมูลผิดพลาด (จะมีของมากกว่าที่ล็อตนั้นมีจริงไม่ได้) ให้ข้ามล็อตนั้นและรายงาน error
//   ล็อตที่มีอยู่จริงแต่ไม่ถูกกล่าวถึงในไฟล์เลย (0 แถว) = ถือว่าหายไปทั้งล็อต (สมมติฐาน: ไฟล์ที่อัปโหลดกลับมา
//   ต้องเป็นไฟล์ export ชุดเดิมที่แก้ไข ไม่ใช่ไฟล์ที่ตัดบางส่วนออกเอง)
// - แถวใหม่ (ไม่มีทั้ง Serial Number และรหัสล็อต แต่มี SKU): ของส่วนเกินที่นับเจอเพิ่ม รับเข้าเป็นล็อตใหม่
class StockCountImport
{
    private int $companyId;
    private int $warehouseId;
    private ?int $importBatchId;

    public int $processedCount = 0;
    public int $skippedNotFoundCount = 0;
    public array $errors = [];

    public function __construct(int $companyId, int $warehouseId, ?int $importBatchId = null)
    {
        $this->companyId = $companyId;
        $this->warehouseId = $warehouseId;
        $this->importBatchId = $importBatchId;
    }

    // ผูก import batch หลังอ่านไฟล์ผ่านการตรวจแล้ว (สร้างแบทช์หลังเช็คไฟล์ ไม่ทิ้งแบทช์ว่างเปล่าตอนไฟล์ผิด)
    public function setImportBatchId(int $importBatchId): void
    {
        $this->importBatchId = $importBatchId;
    }

    // 🐛 [2026-09-24] แถวทั้งไฟล์ต้องถูก "สะสมให้ครบก่อน" แล้วประมวลผลรวดเดียวใน 1 transaction — ไฟล์นี้ 1 แถวต่อ 1 หน่วย สินค้าตัวเดียวมี
    // หลายแถว และการเทียบยอดต้องเห็นแถวของสินค้านั้นครบพร้อมกัน (ถ้าประมวลผลทีละก้อนแล้วสินค้าคร่อมรอยต่อก้อน จะเห็นแค่บางส่วนแล้วคิดว่า
    // ของขาด ตัดล็อตทิ้งทั้งที่ไม่ได้แก้ไฟล์) และล้มกลางไฟล์แล้ว rollback ทั้งก้อน
    private array $bufferedRows = [];

    // 🚀 [2026-09-24] อ่านไฟล์ตรงด้วย PhpSpreadsheet แทน Maatwebsite Excel::import(ToCollection) — วัดจริงกับไฟล์ 3,037 แถว: อ่านตรง
    // ~1 วินาที/62MB แต่ผ่าน Excel::import ~22 วินาที/146MB (chunk 300) และ 769MB (chunk 2000) เพราะสร้าง Collection/Cell ต่อแถวช้ามาก
    // อ่านเฉพาะค่า (read data only) เป็นก้อนละ CHUNK_ROWS แถวด้วย read filter เพื่อคุมหน่วยความจำกับไฟล์ใหญ่มาก (เก็บเฉพาะคอลัมน์ A–P)
    private const CHUNK_ROWS = 5000;
    private const HEADER_LOT_COLUMN = 'รหัสล็อต (ห้ามแก้)';

    /**
     * อ่านไฟล์ + ตรวจว่าเป็นไฟล์ "ปรับปรุงสต๊อก" จริง (หัวคอลัมน์ L = รหัสล็อต) — ยังไม่แตะฐานข้อมูล
     * @throws \DomainException ถ้าไม่ใช่ไฟล์ปรับปรุงสต๊อก (เช่นหยิบ Template นำเข้าสินค้าใหม่มาผิดหน้า)
     */
    public function readFile(string $path): void
    {
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $filter = new class implements IReadFilter {
            public int $start = 1;
            public int $end = 1;
            // signature ต้องตรงกับ IReadFilter ของ PhpSpreadsheet เวอร์ชันที่ติดตั้ง (ไม่มี type hint)
            public function readCell($columnAddress, $row, $worksheetName = '')
            {
                return $row >= $this->start && $row <= $this->end;
            }
        };
        $reader->setReadFilter($filter);

        $this->bufferedRows = [];
        for ($start = 1; ; $start += self::CHUNK_ROWS) {
            $filter->start = $start;
            $filter->end = $start + self::CHUNK_ROWS - 1;
            $spreadsheet = $reader->load($path);
            $sheet = $spreadsheet->getSheet(0);
            $highest = $sheet->getHighestRow();
            if ($highest < $start) {
                $spreadsheet->disconnectWorksheets();
                break;
            }

            $rows = $sheet->rangeToArray('A' . $start . ':P' . min($highest, $filter->end), null, false, false, false);
            foreach ($rows as $i => $row) {
                $rowNumber = $start + $i;
                if ($rowNumber === 1) {
                    if (trim((string) ($row[11] ?? '')) !== self::HEADER_LOT_COLUMN) {
                        $spreadsheet->disconnectWorksheets();
                        throw new \DomainException('ไฟล์นี้ดูเหมือนเป็นไฟล์ "นำเข้าสินค้าใหม่" ไม่ใช่ไฟล์สำหรับปรับปรุงสต็อก กรุณาใช้ไฟล์จากปุ่ม "ดาวน์โหลดข้อมูลเพื่อปรับปรุงสต๊อก" แล้วลบ/เพิ่มแถวตามที่นับได้จริงก่อนอัปโหลดกลับเข้ามาแทน');
                    }
                    continue; // ข้ามหัวตาราง (เดิม startRow = 2)
                }
                $this->bufferedRows[] = $row;
            }
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet, $sheet, $rows);

            if ($highest < $filter->end) break; // อ่านถึงแถวสุดท้ายของไฟล์แล้ว
        }
    }

    // ประมวลผลแถวที่อ่านไว้ (readFile) ลงฐานข้อมูลใน 1 transaction
    public function process(): void
    {
        $rows = collect($this->bufferedRows)->map(fn ($r) => collect($r));
        $this->bufferedRows = [];
        $this->processRows($rows);
    }

    private function processRows(Collection $rows): void
    {
        DB::transaction(function () use ($rows) {
            $byProduct = $rows->filter(fn ($r) => trim((string) ($r[0] ?? '')) !== '')
                ->groupBy(fn ($r) => trim((string) $r[0]));

            foreach ($byProduct as $productId => $productRows) {
                $product = Product::find($productId);
                if (!$product) {
                    $this->skippedNotFoundCount++;
                    continue;
                }

                $serialRows = $productRows->filter(fn ($r) => trim((string) ($r[10] ?? '')) !== '');
                $lotRows = $productRows->filter(fn ($r) => trim((string) ($r[10] ?? '')) === '' && trim((string) ($r[11] ?? '')) !== '');
                $newRows = $productRows->filter(fn ($r) => trim((string) ($r[10] ?? '')) === '' && trim((string) ($r[11] ?? '')) === '');

                foreach ($serialRows as $row) {
                    $this->handleSerialRow((int) $productId, $row);
                }

                if ($lotRows->isNotEmpty() || $newRows->isNotEmpty()) {
                    $this->handleNonSerialRows((int) $productId, $lotRows, $newRows);
                }

                $this->processedCount++;
            }
        });
    }

    // 🔁 ย้ายมาจาก SerialsSheetImport.php ตรงๆ (คอลัมน์เปลี่ยนตำแหน่งตามชีทใหม่: Serial=10, ต้นทุน=14, สถานะ=15)
    // 🐛 [2026-09-24] $row เป็น Collection (แถวจาก ToCollection) ไม่ใช่ array — เดิม type-hint เป็น array ทำให้พัง TypeError
    // ทุกครั้งที่ไฟล์มีแถว S/N ($row[10] ใช้ ArrayAccess ของ Collection ได้ตรงๆ)
    private function handleSerialRow(int $productId, Collection $row): void
    {
        $product = Product::find($productId);
        if (!$product || !$product->has_serial_number) return;

        $sn = trim((string) ($row[10] ?? ''));
        if ($sn === '') return;
        $status = trim((string) ($row[15] ?? '')) ?: 'พร้อมขาย';
        $rawCost = trim((string) ($row[14] ?? ''));
        $costPrice = ($rawCost !== '' && is_numeric($rawCost)) ? (float) $rawCost : null;

        $serialRecord = ProductSerial::where('product_id', $productId)->where('serial_number', $sn)->first();

        if (!$serialRecord) {
            // 🟢 S/N ใหม่ที่ไม่มีในระบบ — รับเข้า 1 หน่วย (เหมือน SerialsSheetImport เดิมทุกประการ)
            if ($status !== 'พร้อมขาย') return;

            $balance = StockBalance::lockedFor($productId, $this->companyId, $this->warehouseId);
            $previousQty = $balance->qty;

            $movement = StockMovement::create([
                'product_id' => $productId,
                'user_id' => auth()->id() ?? 1,
                'type' => 'adjust',
                'quantity' => 1,
                'reference_number' => 'ADJ-SN-ADD-' . date('Ymd-His') . '-' . $sn,
                'note' => "เพิ่ม S/N ใหม่จากการอัปโหลด ($sn)",
                'company_id' => $this->companyId,
                'warehouse_id' => $this->warehouseId,
                'import_batch_id' => $this->importBatchId,
            ]);

            $lot = StockLotService::recordReceipt([
                'company_id' => $this->companyId,
                'product_id' => $productId,
                'warehouse_id' => $this->warehouseId,
                'qty' => 1,
                'unit_cost' => $costPrice,
                'source_type' => 'import',
                'import_batch_id' => $this->importBatchId,
                'stock_movement_id' => $movement->id,
                'reference_number' => $movement->reference_number,
            ]);
            $serialRecord = ProductSerial::create([
                'company_id' => $this->companyId,
                'warehouse_id' => $this->warehouseId,
                'product_id' => $productId,
                'serial_number' => $sn,
                'status' => 'available',
                'stock_movement_id' => $movement->id,
                'stock_lot_id' => $lot->id,
            ]);
            $balance->qty += 1;
            $balance->save();

            $movement->update(['undo_meta' => [
                'serial_created' => true,
                'product_serial_id' => $serialRecord->id,
                'previous_qty' => $previousQty,
                'new_qty' => $previousQty + 1,
            ]]);
        } elseif (in_array($status, ['ชำรุด', 'สูญหาย']) && $serialRecord->status === 'available') {
            // 🔴 S/N เดิม แต่แจ้งว่าชำรุด/สูญหาย — หักออกจากล็อตของมันเองตรงๆ (เหมือนเดิมทุกประการ)
            $balance = StockBalance::lockedFor($productId, $this->companyId, $this->warehouseId);
            $previousQty = $balance->qty;
            $previousStatus = $serialRecord->status;

            $movement = StockMovement::create([
                'product_id' => $productId,
                'user_id' => auth()->id() ?? 1,
                'type' => 'adjust',
                'quantity' => 1,
                'reference_number' => 'ADJ-SN-DEL-' . date('Ymd-His') . '-' . $sn,
                'note' => "ตัด S/N ($sn) สถานะถูกปรับเป็น: $status",
                'company_id' => $this->companyId,
                'warehouse_id' => $this->warehouseId,
                'import_batch_id' => $this->importBatchId,
            ]);

            $dbStatus = $status === 'ชำรุด' ? 'defective' : 'lost';
            $serialRecord->update(['status' => $dbStatus, 'stock_movement_id' => $movement->id]);

            if ($serialRecord->stock_lot_id) {
                StockLotFifoService::decrementLot($serialRecord->stock_lot_id, 1, [
                    'reference_type' => 'stock_movement', 'reference_id' => $movement->id, 'stock_movement_id' => $movement->id,
                ]);
            }

            $newQty = $previousQty;
            if ($balance->qty > 0) {
                $balance->qty -= 1;
                $balance->save();
                $newQty = $balance->qty;
            }

            $movement->update(['undo_meta' => [
                'product_serial_id' => $serialRecord->id,
                'previous_status' => $previousStatus,
                'new_status' => $dbStatus,
                'previous_qty' => $previousQty,
                'new_qty' => $newQty,
            ]]);
        }
        // สถานะ "พร้อมขาย" ไม่เปลี่ยนแปลง = ยืนยันว่ายังอยู่จริง ไม่ต้องทำอะไร
    }

    // 🆕 สินค้าไม่คุม S/N — กระทบยอดรวม 1 เอกสารเคลื่อนไหวสต๊อกต่อสินค้า (เหมือนแพทเทิร์นเดิมของ ProductsSheetImport)
    // แต่ตัดล็อต "เจาะจง" ตรงๆ แทนการเดา FIFO
    private function handleNonSerialRows(int $productId, Collection $lotRows, Collection $newRows): void
    {
        $countByLot = $lotRows->groupBy(fn ($r) => trim((string) $r[11]))->map->count();
        $existingLots = StockLot::where('product_id', $productId)
            ->where('company_id', $this->companyId)
            ->where('qty_remaining', '>', 0)
            ->get()
            ->keyBy('id');

        $shortfalls = []; // stock_lot_id => qty ที่หายไป

        foreach ($countByLot as $lotIdRaw => $fileCount) {
            $lotId = (int) $lotIdRaw;
            $lot = $existingLots->get($lotId);
            if (!$lot) {
                $this->errors[] = "สินค้า ID {$productId}: รหัสล็อต {$lotId} ไม่พบในระบบ (อาจถูกตัดไปแล้วโดยรายการอื่น) — ข้ามล็อตนี้";
                continue;
            }
            if ((int) $lot->warehouse_id !== $this->warehouseId) {
                $this->errors[] = "สินค้า ID {$productId}: รหัสล็อต {$lotId} อยู่คนละคลังกับที่กำลังปรับปรุงอยู่ — ข้ามล็อตนี้";
                continue;
            }
            $remaining = (int) round((float) $lot->qty_remaining);
            if ($fileCount > $remaining) {
                $this->errors[] = "สินค้า ID {$productId}: รหัสล็อต {$lotId} พบ {$fileCount} แถวในไฟล์ มากกว่าที่ระบบมีจริง ({$remaining}) — ข้ามล็อตนี้";
                continue;
            }
            if ($fileCount < $remaining) {
                $shortfalls[$lotId] = $remaining - $fileCount;
            }
        }

        // ล็อตที่มีอยู่จริงแต่ไม่ถูกกล่าวถึงในไฟล์เลย (0 แถว) = หายไปทั้งล็อต
        foreach ($existingLots as $lotId => $lot) {
            if ($countByLot->has((string) $lotId)) continue;
            if ((int) $lot->warehouse_id !== $this->warehouseId) continue; // คนละคลัง ไม่เกี่ยวกับรอบปรับปรุงนี้
            $remaining = (int) round((float) $lot->qty_remaining);
            if ($remaining > 0) $shortfalls[$lotId] = $remaining;
        }

        $surplusQty = $newRows->count();
        $totalShortfall = array_sum($shortfalls);

        if ($totalShortfall === 0 && $surplusQty === 0) return; // ไม่มีอะไรเปลี่ยน

        $netDelta = $surplusQty - $totalShortfall;
        $balance = StockBalance::lockedFor($productId, $this->companyId, $this->warehouseId);
        $previousQty = $balance->qty;

        $movement = StockMovement::create([
            'product_id' => $productId,
            'user_id' => auth()->id() ?? 1,
            'type' => 'adjust',
            'quantity' => abs($netDelta),
            'reference_number' => 'ADJ-' . date('Ymd-His') . '-' . $productId,
            'note' => 'ปรับยอด Excel (ตรวจนับรายหน่วย, ' . ($netDelta > 0 ? "+{$netDelta}" : $netDelta) . ')',
            'company_id' => $this->companyId,
            'warehouse_id' => $this->warehouseId,
            'import_batch_id' => $this->importBatchId,
        ]);
        $context = ['reference_type' => 'stock_movement', 'reference_id' => $movement->id, 'stock_movement_id' => $movement->id];

        foreach ($shortfalls as $lotId => $missingQty) {
            StockLotFifoService::decrementLot($lotId, (float) $missingQty, $context);
        }

        if ($surplusQty > 0) {
            $costs = $newRows->pluck(14)->filter(fn ($c) => is_numeric(trim((string) $c)));
            $cost = $costs->isNotEmpty() ? (float) $costs->first() : null;
            StockLotService::recordReceipt([
                'company_id' => $this->companyId,
                'product_id' => $productId,
                'warehouse_id' => $this->warehouseId,
                'qty' => $surplusQty,
                'unit_cost' => $cost,
                'source_type' => 'import',
                'import_batch_id' => $this->importBatchId,
                'stock_movement_id' => $movement->id,
                'reference_number' => $movement->reference_number,
            ]);
        }

        $balance->qty = $previousQty + $netDelta;
        $balance->save();

        $movement->update(['undo_meta' => ['previous_qty' => $previousQty, 'new_qty' => $balance->qty]]);
    }
}
