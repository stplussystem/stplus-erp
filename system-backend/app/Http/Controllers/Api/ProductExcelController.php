<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\Warehouse;
use App\Models\ImportBatch;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\ProductSerial;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\StockLot;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ProductExcelController extends Controller
{
    // 🟢 1. โหลดข้อมูลออกไปเป็น Excel (มีครบทุกคอลัมน์ + ตรงกับ Filter หน้าเว็บ)
    public function export(Request $request)
    {
        try {
            $query = Product::with(['category', 'brand', 'unit', 'stockBalance']);

            if ($request->filled('search')) {
                $s = $request->search;
                $query->where(function ($q) use ($s) {
                    $q->where('name', 'like', "%{$s}%")
                        ->orWhere('sku', 'like', "%{$s}%")
                        ->orWhere('barcode', 'like', "%{$s}%");
                });
            }
            if ($request->filled('category_id') && $request->category_id !== 'all') {
                $query->where('category_id', $request->category_id);
            }
            if ($request->filled('is_active') && $request->is_active !== 'all') {
                $query->where('is_active', $request->is_active === 'active' ? 1 : 0);
            }
            if ($request->filled('stock_status') && $request->stock_status !== 'all') {
                if ($request->stock_status === 'in_stock') {
                    $query->whereHas('stockBalance', function ($q) {
                        $q->where('qty', '>', 0);
                    });
                } elseif ($request->stock_status === 'out_of_stock') {
                    $query->whereDoesntHave('stockBalance', function ($q) {
                        $q->where('qty', '>', 0);
                    });
                }
            }

            $products = $query->latest()->get();
            $fileName = 'products_inventory_' . now()->format('YmdHi') . '.xlsx';

            // 🆕 [StockCountExport] 1 แถวต่อ 1 หน่วยจริง พร้อมต้นทุน FIFO ต่อหน่วย — แทนที่ InventoryExport
            // เดิม (2 ชีทแยกกัน ผลรวมต่อสินค้า) — InventoryExport เดิมไม่ได้ถูกลบ เพราะยังมีโค้ดจุดอื่นที่ไม่ได้
            // ถูกเรียกใช้งานจริงผ่าน route ใดๆ (StockMovementController::exportInventoryExcel() เป็นต้น) อ้างอิงอยู่
            return Excel::download(new \App\Exports\StockCountExport($products), $fileName);
        } catch (\Exception $e) {
            // 💡 คาย Error ออกมาให้หน้าบ้านเห็นชัดๆ จะได้ไม่ติด CORS
            return response()->json(['message' => 'Export Failed: ' . $e->getMessage()], 500);
        }
    }

    // 🟢 1.1 โหลด Template เปล่า
    public function exportTemplate()
    {
        try {
            return Excel::download(new \App\Exports\ProductTemplateExport, 'template_new_products.xlsx');
        } catch (\Exception $e) {
            return response()->json(['message' => 'Template Failed: ' . $e->getMessage()], 500);
        }
    }

    // 🟢 2. นำเข้าข้อมูลสินค้าใหม่แบบเยอะๆ
    public function importMaster(Request $request)
    {
        $request->validate(['file' => 'required|mimes:xlsx,xls,csv']);

        try {
            $companyId = $request->user()->company_id;
            $import = null;
            $batchId = null;

            // 🛡️ [2026-09-24] ทั้งไฟล์อยู่ใน transaction เดียว — แถวใดพัง = ย้อนกลับทั้งไฟล์อัตโนมัติ (สินค้า/สต๊อก/S/N/ล็อต/ใบรับสินค้า
            // อัตโนมัติ/import batch ไม่ค้างครึ่งไฟล์) และไม่ต้องกด "ยกเลิกการนำเข้าล่าสุด" เอง (เดิมยอมให้ค้างแล้วให้ผู้ใช้กดย้อนเอง)
            // ปุ่มยกเลิกล่าสุดยังใช้ได้กับกรณีนำเข้า "สำเร็จ" แต่เลือกไฟล์ผิด — ดู undoImportBatch()
            DB::transaction(function () use ($request, $companyId, &$import, &$batchId) {
                // 🚀 สร้าง import batch ก่อนเริ่มนำเข้าเสมอ เพื่อผูกสินค้า/สต๊อกที่สร้างในรอบนี้ให้ย้อนกลับได้ภายหลัง
                $batch = ImportBatch::create([
                    'company_id' => $companyId,
                    'user_id' => $request->user()->id,
                    'type' => 'master',
                    'file_name' => $request->file('file')->getClientOriginalName(),
                ]);
                $batchId = $batch->id;

                // 💰 ใช้วิธี resolve คลังเดียวกับที่ MasterProductSheetImport/MasterSerialSheetImport ใช้ภายในเป๊ะ
                // (firstOrCreate ด้วย company_id filter ตัวเดียว) เพื่อให้ใบรับสินค้าที่สร้างจาก pendingReceipt
                // อัปเดตสต็อกลงคลังเดียวกับที่โค้ดใน sheet importer อัปเดตต่อจากนั้นเอง — ถ้าคลังไม่ตรงกัน สต็อกจะ
                // ถูกบวกซ้ำสองคลังเพราะโค้ดใน importer เขียนทับ StockBalance ของคลังตัวเองอีกทีหลัง addItem()
                $defaultWarehouse = Warehouse::firstOrCreate(
                    ['company_id' => $companyId],
                    ['name' => 'คลังสินค้าหลัก (Default)']
                );
                $pendingReceipt = new \App\Services\PendingImportReceipt(
                    $companyId,
                    $defaultWarehouse->id,
                    $request->user()->id,
                    'สร้างอัตโนมัติจากการนำเข้า Excel นำเข้าสินค้าใหม่',
                    $batch->id
                );

                $import = new \App\Imports\ProductsImport($batch->id, $pendingReceipt);
                Excel::import($import, $request->file('file'));

                if ($import->createdCount() === 0) {
                    // ไม่มีสินค้าใหม่เลย (ทุกแถวเป็น SKU เดิม/ไฟล์ว่าง) — ไม่ทิ้งแบทช์ว่างเปล่าไว้ให้แถบ "ยกเลิกล่าสุด" แสดง
                    $batch->delete();
                } else {
                    $batch->update(['affected_count' => Product::where('import_batch_id', $batch->id)->count()]);
                }
            });

            $created = $import->createdCount();
            $skipped = $import->skippedExistingSkus();

            $message = $created > 0
                ? "นำเข้าสินค้าใหม่และสต็อกสำเร็จ {$created} รายการ"
                : 'ไม่มีสินค้าใหม่ให้นำเข้า';
            if (count($skipped) > 0) {
                $shown = array_slice($skipped, 0, 10);
                $message .= ' — ข้าม ' . count($skipped) . ' รายการที่มี SKU อยู่ในระบบแล้ว (ไม่ได้แก้ไขข้อมูลเดิม): '
                    . implode(', ', $shown) . (count($skipped) > 10 ? ' และอีก ' . (count($skipped) - 10) . ' รายการ' : '');
            }

            return response()->json([
                'message' => $message,
                'created_count' => $created,
                'skipped_existing_count' => count($skipped),
                'skipped_existing_skus' => array_slice($skipped, 0, 50),
            ]);
        } catch (\DomainException $e) {
            // ข้อมูลในไฟล์ผิด (มีแถว/SKU ระบุ) — ย้อนกลับทั้งไฟล์แล้ว ไม่มีการนำเข้าใดๆ เกิดขึ้น
            return response()->json(['message' => $e->getMessage() . ' — ไม่มีการนำเข้าใดๆ เกิดขึ้น (ระบบย้อนกลับให้ทั้งไฟล์แล้ว) กรุณาแก้ไฟล์แล้วอัปโหลดใหม่'], 422);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage() . ' — ไม่มีการนำเข้าใดๆ เกิดขึ้น (ระบบย้อนกลับให้ทั้งไฟล์แล้ว)'], 500);
        }
    }

    // 🟢 3. นำเข้าเพื่อปรับปรุงสต็อก (ตรวจนับ)
    public function importAdjust(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv',
            'warehouse_id' => 'nullable|exists:warehouses,id',
        ]);
        $batch = null;
        try {
            $companyId = auth()->user()->company_id;
            $warehouseId = Warehouse::resolveFor($companyId, $request->input('warehouse_id'));

            // 🛡️ อ่านไฟล์ + เช็คหัวคอลัมน์ก่อนแตะฐานข้อมูล — หน้านี้ใช้คู่กับไฟล์จากปุ่ม "ดาวน์โหลดข้อมูลเพื่อปรับปรุงสต๊อก"
            // (มีคอลัมน์ "รหัสล็อต (ห้ามแก้)" เท่านั้น) แต่ผู้ใช้บางคนหยิบไฟล์ template "เพิ่มสินค้าใหม่" มาอัปโหลดผิดหน้า —
            // 🚀 [2026-09-24] อ่านด้วย PhpSpreadsheet ตรงครั้งเดียว (เดิมโหลดไฟล์ทั้งไฟล์เพื่อเช็ค header แล้วโหลดซ้ำผ่าน
            // Excel::import ต่ออีก ~22 วินาที/3,000 แถว) ดู StockCountImport::readFile()
            // 🛡️ เก็บ instance ไว้ตัวแปรก่อนเพื่อดึงตัวนับผลลัพธ์ออกมาสร้างข้อความตอบกลับที่ตรงกับความจริง
            $import = new \App\Imports\StockCountImport($companyId, $warehouseId);
            $import->readFile($request->file('file')->getRealPath());

            // 🚀 สร้าง import batch ก่อนเริ่มนำเข้าเสมอ ให้ "ยกเลิกการนำเข้าล่าสุด" ย้อนยอดสต็อก/S/N กลับได้
            $batch = ImportBatch::create([
                'company_id' => $companyId,
                'user_id' => auth()->id(),
                'type' => 'adjust',
                'file_name' => $request->file('file')->getClientOriginalName(),
            ]);
            $import->setImportBatchId($batch->id);
            $import->process();

            $processed = $import->processedCount;
            $skippedNotFound = $import->skippedNotFoundCount;

            $batch->update(['affected_count' => StockMovement::where('import_batch_id', $batch->id)->count()]);

            if ($processed === 0 && $skippedNotFound > 0) {
                $batch->delete(); // ไม่มีอะไรถูกปรับ ไม่ต้องทิ้งแบทช์ว่างเปล่าไว้ให้แถบ "ยกเลิกล่าสุด" แสดง
                return response()->json([
                    'message' => "ไม่พบสินค้าที่ตรงกับข้อมูลในไฟล์ ({$skippedNotFound} แถว) ไม่มีการปรับปรุงสต็อกใดๆ กรุณาตรวจสอบว่านำเข้าสินค้าเข้าระบบแล้วหรือยัง",
                ], 422);
            }

            $message = "ปรับปรุงสต็อกสำเร็จ {$processed} รายการ";
            if ($skippedNotFound > 0) {
                $message .= " (ไม่พบสินค้า {$skippedNotFound} รายการ)";
            }
            if (!empty($import->errors)) {
                $message .= ' — พบข้อผิดพลาด ' . count($import->errors) . ' รายการ: ' . implode(' | ', array_slice($import->errors, 0, 5));
            }

            return response()->json(['message' => $message]);
        } catch (\DomainException $e) {
            // ไฟล์ผิดประเภท (เช่น template นำเข้าสินค้าใหม่) — ตอบ 422 ตามเดิม ไม่มีอะไรเปลี่ยนในฐานข้อมูล
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            // ประมวลผลล้มกลางทาง = rollback ทั้ง transaction แล้ว (ดู StockCountImport::process) — เก็บกวาดแบทช์ที่สร้างไว้ก่อนหน้า
            if ($batch) $batch->delete();
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // 🟢 4. ดึงประวัติการนำเข้าล่าสุดที่ยังไม่ถูกยกเลิก ให้หน้าเว็บโชว์แถบ "ยกเลิกการนำเข้าล่าสุด"
    // (BelongsToCompany กรองแยกบริษัทให้อัตโนมัติอยู่แล้ว)
    // 🛡️ จำกัดเฉพาะ 24 ชม.ล่าสุด — เดิมไม่มีขอบเขตเวลาเลย ทำให้แถบนี้ค้างโชว์ import เก่าๆ ตลอดไปจนกว่าจะกด
    // ยกเลิกจริง (แย่ลงอีกถ้า batch เป็น partially_undone เพราะสินค้าบางตัวถูกใช้งานไปแล้ว จะไม่มีทาง resolve
    // เป็น undone เต็มได้เลย ค้างถาวร) การยกเลิก batch เก่ากว่านี้ทำได้ผ่านหน้าประวัติ (importBatchHistory) แทน
    public function lastImportBatch()
    {
        $batch = ImportBatch::where('status', '!=', 'undone')
            ->where('created_at', '>=', now()->subHours(24))
            ->latest('id')->first();
        return response()->json(['batch' => $batch]);
    }

    // 🟢 4.5 ประวัติการนำเข้าทั้งหมด (ไม่จำกัดเวลา) — ให้ดู/ยกเลิก batch เก่าที่ไม่ใช่ตัวล่าสุดได้ด้วย
    public function importBatchHistory(Request $request)
    {
        $query = ImportBatch::with('user:id,name')->latest('id');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    // 🟢 5. ยกเลิกการนำเข้า — "นำเข้าสินค้าใหม่": ลบเฉพาะแถวสินค้าที่เพิ่งถูกสร้างใหม่ในรอบนั้น (ข้ามสินค้าที่
    // ถูกใช้งานในเอกสารอื่นไปแล้ว ป้องกันข้อมูลเอกสารเก่ากำพร้า) — "ปรับปรุงสต๊อก/S/N": คืนค่าจำนวน/สถานะ S/N
    // กลับไปเป็นค่าก่อนนำเข้า จาก undo_meta ที่บันทึกไว้ตอน import
    public function undoImportBatch(Request $request, ImportBatch $importBatch)
    {
        // 🛡️ endpoint เดียวรองรับทั้ง 2 ชนิด เช็คสิทธิ์ตาม type ของ batch เอง แทนการผูก middleware ตรง route
        $permission = $importBatch->type === 'adjust' ? 'stock_adjustment' : 'manage_products';
        if (!$request->user()->can($permission)) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ยกเลิกการนำเข้านี้'], 403);
        }

        if ($importBatch->status === 'undone') {
            return response()->json(['message' => 'การนำเข้านี้ถูกยกเลิกไปแล้ว'], 422);
        }

        $blocked = [];
        $deletedCount = 0;
        $revertedCount = 0;
        $receiptCount = 0;

        try {
        DB::transaction(function () use ($importBatch, &$blocked, &$deletedCount, &$revertedCount, &$receiptCount) {
            $products = Product::where('import_batch_id', $importBatch->id)->get();
            $batchProductIds = $products->pluck('id');

            // 🐛 [2026-09-24] ใบรับสินค้าอัตโนมัติที่การนำเข้ารอบนี้สร้างให้ (กรอกต้นทุนต่อหน่วย) — เดิม undo ไม่รู้จักใบนี้ ทำให้สต๊อก/ล็อตต้นทุน/ใบรับสินค้า
            // ค้างอยู่ และลบสินค้าไม่ได้ ตอนนี้ย้อนจากใบรับสินค้าใบนั้นให้ครบ (สต๊อก ล็อต S/N movement) แบบ "ทั้งหมดหรือไม่เลย"
            $receipts = GoodsReceipt::where('import_batch_id', $importBatch->id)
                ->where('status', '!=', 'Cancelled')
                ->with('items')
                ->lockForUpdate()
                ->get();
            $receiptIds = $receipts->pluck('id');

            // 🛡️ ตรวจก่อนแตะข้อมูลใดๆ — ถ้ามีของถูกใช้ไปแล้ว (ขาย/เบิก/ตัดล็อต/S/N ไม่ใช่พร้อมขาย/มีเอกสารอ้างอิงสินค้า) ปฏิเสธทั้งหมด ไม่ย้อนครึ่งๆ กลางๆ
            foreach ($products as $product) {
                $reason = $this->findProductUsageBlock($product->id, $receiptIds->all());
                if ($reason) $blocked[] = "{$product->sku} ({$product->name}) — {$reason}";
            }
            foreach ($receipts as $receipt) {
                foreach ($receipt->items as $item) {
                    $lot = StockLot::where('goods_receipt_item_id', $item->id)->first();
                    $name = optional(Product::find($item->product_id))->sku ?? ('#' . $item->product_id);
                    if ($lot && (float) $lot->qty_remaining < (float) $lot->qty_received) {
                        $blocked[] = "{$name} — สินค้าจากใบรับสินค้า {$receipt->gr_number} ถูกขาย/เบิก/ปรับยอดไปแล้วบางส่วน";
                    }
                    if ($lot && ProductSerial::where('stock_lot_id', $lot->id)->where('status', '!=', 'available')->exists()) {
                        $blocked[] = "{$name} — S/N จากใบรับสินค้า {$receipt->gr_number} ถูกนำไปใช้แล้ว";
                    }
                }
            }
            if (!empty($blocked)) {
                throw new \DomainException('ไม่สามารถยกเลิกการนำเข้านี้ได้ เพราะมีสินค้าที่ถูกใช้งานไปแล้ว (ไม่มีการย้อนกลับใดๆ เกิดขึ้น): ' . implode(' | ', array_slice(array_unique($blocked), 0, 10)) . ' — ต้องยกเลิกเอกสารที่ใช้สินค้าเหล่านี้ก่อน');
            }

            // 0) ย้อนใบรับสินค้าอัตโนมัติ: ลดสต๊อก ลบล็อตต้นทุน + S/N + movement ของแต่ละรายการ (สต๊อกเหลือเท่าก่อนนำเข้า)
            foreach ($receipts as $receipt) {
                foreach ($receipt->items as $item) {
                    $lot = StockLot::where('goods_receipt_item_id', $item->id)->lockForUpdate()->first();
                    $movements = StockMovement::where('reference_number', $receipt->gr_number)
                        ->where('product_id', $item->product_id)->where('type', 'in')->get();
                    $warehouseId = $lot?->warehouse_id ?? $movements->first()?->warehouse_id;

                    if ($warehouseId) {
                        $balance = StockBalance::lockedFor($item->product_id, $importBatch->company_id, $warehouseId);
                        $balance->qty = max(0, (float) $balance->qty - (float) $item->quantity);
                        $balance->save();
                    }
                    if ($lot) {
                        ProductSerial::where('stock_lot_id', $lot->id)->delete();
                        $lot->delete();
                    }
                    StockMovement::whereIn('id', $movements->pluck('id'))->delete();
                }

                // ใบรับสินค้าที่มีแต่สินค้าที่กำลังจะถูกลบ = ลบทิ้งทั้งใบ (เสมือนไม่เคยเกิดขึ้น) ถ้ามีรายการของสินค้าเดิมปนอยู่
                // (แบทช์เก่าก่อนเปลี่ยนเป็น "ข้าม SKU เดิม") เก็บใบไว้เป็น "ยกเลิก" ไม่ให้รายการอ้างอิงสินค้าเดิมหาย
                GoodsReceiptItem::where('goods_receipt_id', $receipt->id)->whereIn('product_id', $batchProductIds)->delete();
                if (GoodsReceiptItem::where('goods_receipt_id', $receipt->id)->exists()) {
                    $receipt->update([
                        'status' => 'Cancelled',
                        'note' => trim(($receipt->note ? $receipt->note . "\n" : '') . "[ยกเลิกอัตโนมัติ]: ยกเลิกการนำเข้า Excel #{$importBatch->id}"),
                    ]);
                } else {
                    $receipt->delete();
                }
                $receiptCount++;
            }

            // 1) ลบสินค้าที่เพิ่ง "สร้างใหม่" ในรอบนี้ — cascade จะลบ stock_balances/stock_movements/product_serials/stock_lots ที่เหลือให้เอง
            foreach ($products as $product) {
                $reason = $this->findProductUsageBlock($product->id);
                if ($reason) {
                    throw new \DomainException("ลบสินค้า {$product->sku} ไม่ได้: {$reason} (ไม่มีการย้อนกลับใดๆ เกิดขึ้น)");
                }
                $product->delete();
                $deletedCount++;
            }

            // 2) คืนค่าสต็อก/สถานะ S/N ของแถวที่ "แก้ไข" สินค้าเดิม (ไม่ได้ลบทั้งแถว) — แถวที่ผูกกับสินค้า
            //    ที่เพิ่งถูกลบไปในขั้นตอนที่ 1 จะถูก cascade ลบไปแล้ว query นี้จึงไม่เจออีก ไม่ต้องกันซ้ำเอง
            $movements = StockMovement::where('import_batch_id', $importBatch->id)
                ->whereNotNull('undo_meta')
                ->orderByDesc('id')
                ->get();

            foreach ($movements as $movement) {
                $meta = $movement->undo_meta ?? [];

                if ($movement->warehouse_id && array_key_exists('previous_qty', $meta)) {
                    $balance = StockBalance::lockedFor($movement->product_id, $importBatch->company_id, $movement->warehouse_id);
                    $balance->qty = $meta['previous_qty'];
                    $balance->save();
                }

                if (!empty($meta['serial_created']) && !empty($meta['product_serial_id'])) {
                    ProductSerial::where('id', $meta['product_serial_id'])->delete();
                } elseif (!empty($meta['product_serial_id']) && array_key_exists('previous_status', $meta)) {
                    ProductSerial::where('id', $meta['product_serial_id'])->update(['status' => $meta['previous_status']]);
                }

                // 🆕 ลบล็อตต้นทุน FIFO ที่ผูกกับ movement นี้ด้วย — ถ้ายังไม่ถูกตัดขายไปเลย (qty_remaining ==
                // qty_received) ลบทิ้งได้ปลอดภัย แต่ถ้าถูกตัดไปแล้วบางส่วน ปล่อยไว้ (undo ไม่สมบูรณ์กรณีนี้
                // อยู่แล้วเหมือน StockBalance/ProductSerial ด้านบน)
                \App\Models\StockLot::where('stock_movement_id', $movement->id)
                    ->whereColumn('qty_remaining', '=', 'qty_received')
                    ->delete();

                // 🆕 ถ้า movement นี้เป็นฝั่ง "ปรับยอดลดลง" ที่เคยหักล็อต FIFO ไปด้วย (ดู ProductsSheetImport::
                // diff<0) คืนล็อตที่ถูกหักไปกลับด้วย — no-op เงียบๆ ถ้า movement นี้ไม่เคยตัดล็อตอะไรเลย
                \App\Services\StockLotFifoService::reverse(['stock_movement_id' => $movement->id]);

                $movement->delete();
                $revertedCount++;
            }

            // 🐛 [2026-09-24] เหลือสถานะ 'undone' อย่างเดียว — ถ้ามีของถูกใช้แล้วจะถูกปฏิเสธทั้งหมดตั้งแต่ด้านบน (ไม่มี partially_undone อีก)
            $importBatch->update([
                'status' => 'undone',
                'undone_at' => now(),
                'undone_by' => auth()->id(),
            ]);
        });
        } catch (\DomainException $e) {
            // ถูกปฏิเสธทั้งหมด — transaction ย้อนกลับแล้ว ข้อมูลเหมือนเดิมทุกอย่าง
            return response()->json(['message' => $e->getMessage(), 'blocked' => array_values(array_unique($blocked))], 422);
        }

        $parts = [];
        if ($deletedCount > 0) $parts[] = "ลบสินค้าใหม่ {$deletedCount} รายการ";
        if ($receiptCount > 0) $parts[] = "ยกเลิกใบรับสินค้าอัตโนมัติ {$receiptCount} ใบ (คืนสต๊อก/ล็อตต้นทุน)";
        if ($revertedCount > 0) $parts[] = "คืนค่าสต็อก/S/N {$revertedCount} รายการ";
        $message = empty($parts) ? 'ไม่มีข้อมูลให้ย้อนกลับ' : 'ยกเลิกการนำเข้าสำเร็จ (' . implode(', ', $parts) . ')';

        return response()->json(['message' => $message, 'blocked' => []]);
    }

    // 🛡️ เช็คว่าสินค้าถูกใช้งานในเอกสาร/ความสัมพันธ์อื่นแล้วหรือยัง ก่อนจะยอมให้ undo ลบทิ้ง — บางตารางมี FK
    // restrictOnDelete (DB จะกันเองอยู่แล้ว) แต่ goods_receipt_items/sale_document_items เก็บ product_id แบบ
    // ไม่มี FK constraint เลย ถ้าไม่เช็คเองจะลบไปแล้วเอกสารเก่ากำพร้าเงียบๆ
    // $ignoreReceiptIds = ใบรับสินค้าอัตโนมัติของแบทช์ที่กำลังยกเลิก (จะถูกย้อน/ลบไปพร้อมกัน จึงไม่นับเป็น "ถูกใช้งาน")
    private function findProductUsageBlock(int $productId, array $ignoreReceiptIds = []): ?string
    {
        $checks = [
            'purchase_order_items' => ['product_id', 'ถูกใช้ในใบสั่งซื้อแล้ว'],
            'repair_tickets' => ['product_id', 'ถูกใช้ในใบซ่อมแล้ว'],
            'installation_records' => ['product_id', 'ถูกใช้ในบันทึกการติดตั้งแล้ว'],
            'product_bundle_items' => ['component_product_id', 'ถูกใช้เป็นส่วนประกอบของสินค้าชุดแล้ว'],
            'goods_receipt_items' => ['product_id', 'ถูกใช้ในใบรับสินค้าแล้ว'],
            'sale_document_items' => ['product_id', 'ถูกใช้ในเอกสารขาย/เช่าแล้ว'],
        ];

        foreach ($checks as $table => [$column, $reason]) {
            $query = DB::table($table)->where($column, $productId);
            if ($table === 'goods_receipt_items' && !empty($ignoreReceiptIds)) {
                $query->whereNotIn('goods_receipt_id', $ignoreReceiptIds);
            }
            if ($query->exists()) {
                return $reason;
            }
        }

        return null;
    }
}
