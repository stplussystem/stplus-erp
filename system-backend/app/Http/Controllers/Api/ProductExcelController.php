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

            return Excel::download(new \App\Exports\InventoryExport(false, $products), $fileName);
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

        // 🚀 สร้าง import batch ก่อนเริ่มนำเข้าเสมอ (แม้ Excel::import() จะ throw กลางทาง แถวที่ทันได้แท็ก
        // ไปแล้วก่อนพังก็ยังย้อนกลับได้ผ่านปุ่ม "ยกเลิกการนำเข้าล่าสุด" — ดู undoImportBatch())
        $batch = ImportBatch::create([
            'company_id' => $request->user()->company_id,
            'user_id' => $request->user()->id,
            'type' => 'master',
            'file_name' => $request->file('file')->getClientOriginalName(),
        ]);

        try {
            $companyId = $request->user()->company_id;
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
                'สร้างอัตโนมัติจากการนำเข้า Excel นำเข้าสินค้าใหม่'
            );

            Excel::import(new \App\Imports\ProductsImport($batch->id, $pendingReceipt), $request->file('file'));
            $batch->update(['affected_count' => Product::where('import_batch_id', $batch->id)->count()]);
            return response()->json(['message' => 'นำเข้าสินค้าใหม่และสต็อกสำเร็จเรียบร้อย!']);
        } catch (\Exception $e) {
            $batch->update(['affected_count' => Product::where('import_batch_id', $batch->id)->count()]);
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // 🟢 3. นำเข้าเพื่อปรับปรุงสต็อก (ตรวจนับ)
    public function importAdjust(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv',
            'warehouse_id' => 'nullable|exists:warehouses,id',
        ]);
        try {
            // 🛡️ เช็คหัวคอลัมน์ก่อน import จริง — เพจนี้เจตนาใช้คู่กับไฟล์จากปุ่ม "ส่งออกข้อมูล" (มีคอลัมน์
            // "นับจริง" เท่านั้น) แต่ผู้ใช้บางคนหยิบไฟล์ template "เพิ่มสินค้าใหม่" (ไม่มีคอลัมน์นี้ มีแต่
            // "จำนวนเริ่มต้น" ในตำแหน่งเดียวกัน) มาอัปโหลดผิดหน้าแทน — ถ้าไม่เช็ค `ProductsSheetImport` จะเอา
            // ค่าคอลัมน์เดียวกันไปตีความผิดความหมาย (จำนวนเริ่มต้น ≠ นับจริง) แล้วอาจข้ามทุกแถวเงียบๆ
            // (ID ว่างเพราะ template ใหม่บอกให้เว้นว่าง) จนตอบเหมือนสำเร็จทั้งที่ไม่ได้ปรับอะไรเลย หรือแย่กว่า
            // คือไปตีความ ID ผิดแถวถ้าใครดันใส่เลขไว้ — เช็ค header ตรงๆ ให้ชัดเจนไปเลยดีกว่าปล่อยให้เดา
            try {
                $filePath = $request->file('file')->getRealPath();
                $reader = IOFactory::createReaderForFile($filePath);
                $reader->setReadDataOnly(true);
                $spreadsheet = $reader->load($filePath);
                $headerRow = $spreadsheet->getSheet(0)->rangeToArray('A1:Z1', null, true, false)[0] ?? [];
                $headerRow = array_map(fn ($v) => trim((string) $v), $headerRow);
                $isAdjustFile = in_array('นับจริง', $headerRow, true);
            } catch (\Throwable $e) {
                // อ่าน header ไม่ได้ (ไฟล์เสีย/รูปแบบแปลก) ปล่อยให้ Excel::import() ด้านล่างจัดการ/โยน error
                // รายละเอียดแทน ไม่ต้อง reject ตรงนี้เอง
                $isAdjustFile = true;
            }

            if (!$isAdjustFile) {
                return response()->json([
                    'message' => 'ไฟล์นี้ดูเหมือนเป็นไฟล์ "นำเข้าสินค้าใหม่" ไม่ใช่ไฟล์สำหรับปรับปรุงสต็อก กรุณาใช้ไฟล์จากปุ่ม "ส่งออกข้อมูล" แล้วแก้ไขคอลัมน์ "นับจริง" ก่อนอัปโหลดกลับเข้ามาแทน',
                ], 422);
            }

            $companyId = auth()->user()->company_id;
            $warehouseId = Warehouse::resolveFor($companyId, $request->input('warehouse_id'));

            // 🚀 สร้าง import batch ก่อนเริ่มนำเข้าเสมอ ให้ "ยกเลิกการนำเข้าล่าสุด" ย้อนยอดสต็อก/S/N กลับได้
            $batch = ImportBatch::create([
                'company_id' => $companyId,
                'user_id' => auth()->id(),
                'type' => 'adjust',
                'file_name' => $request->file('file')->getClientOriginalName(),
            ]);

            // 💰 ใช้คลังเดียวกับที่ระบุไว้ด้านบน (resolveFor) — ใบรับสินค้าที่สร้างจาก pendingReceipt ต้อง
            // อัปเดตสต็อกลงคลังเดียวกับที่ ProductsSheetImport/SerialsSheetImport ใช้อยู่แล้ว (ไม่เหมือน Path 1
            // ที่ importer resolve คลัง default ของตัวเอง — ที่นี่ controller เป็นคน resolve แล้วส่งต่อให้ทั้งคู่)
            $pendingReceipt = new \App\Services\PendingImportReceipt(
                $companyId,
                $warehouseId,
                auth()->id() ?? 1,
                'สร้างอัตโนมัติจากการนำเข้า Excel ปรับปรุงสต๊อก'
            );

            // 🛡️ เก็บ instance ไว้ตัวแปรก่อน (ไม่ new ทิ้งไปในบรรทัดเดียว) เพื่อดึงตัวนับผลลัพธ์ออกมาสร้าง
            // ข้อความตอบกลับที่ตรงกับความจริง — เดิมตอบ "สำเร็จ" แบบ static เสมอแม้ไม่มีแถวไหนถูกประมวลผลจริง
            // เลย (เช่น ID ในไฟล์ไม่ตรงกับสินค้าใดในระบบเลย ตอนยังไม่มีสินค้า)
            $import = new \App\Imports\InventoryImport($companyId, $warehouseId, $batch->id, $pendingReceipt);
            Excel::import($import, $request->file('file'));

            $processed = $import->productsSheet->processedCount;
            $skippedNotFound = $import->productsSheet->skippedNotFoundCount;
            $skippedHasSerial = $import->productsSheet->skippedHasSerialCount;

            $batch->update(['affected_count' => StockMovement::where('import_batch_id', $batch->id)->count()]);

            if ($processed === 0 && $skippedNotFound > 0) {
                return response()->json([
                    'message' => "ไม่พบสินค้าที่ตรงกับข้อมูลในไฟล์ ({$skippedNotFound} แถว) ไม่มีการปรับปรุงสต็อกใดๆ กรุณาตรวจสอบว่านำเข้าสินค้าเข้าระบบแล้วหรือยัง",
                ], 422);
            }

            $message = "ปรับปรุงสต็อกสำเร็จ {$processed} รายการ";
            if ($skippedHasSerial > 0) {
                $message .= " (ข้าม {$skippedHasSerial} รายการที่มีระบบ S/N — ปรับผ่านชีท Serial Numbers แทน)";
            }
            if ($skippedNotFound > 0) {
                $message .= " (ไม่พบสินค้า {$skippedNotFound} รายการ)";
            }

            return response()->json(['message' => $message]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // 🟢 4. ดึงประวัติการนำเข้าล่าสุดที่ยังไม่ถูกยกเลิก ให้หน้าเว็บโชว์แถบ "ยกเลิกการนำเข้าล่าสุด"
    // (BelongsToCompany กรองแยกบริษัทให้อัตโนมัติอยู่แล้ว)
    public function lastImportBatch()
    {
        $batch = ImportBatch::where('status', '!=', 'undone')->latest('id')->first();
        return response()->json(['batch' => $batch]);
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

        DB::transaction(function () use ($importBatch, &$blocked, &$deletedCount, &$revertedCount) {
            // 1) ลบสินค้าที่เพิ่ง "สร้างใหม่" ในรอบนี้ (ถ้ายังไม่ถูกใช้งานที่อื่น) — cascade จะลบ
            //    stock_balances/stock_movements/product_serials ของสินค้านั้นให้เองอัตโนมัติ
            $products = Product::where('import_batch_id', $importBatch->id)->get();
            foreach ($products as $product) {
                $reason = $this->findProductUsageBlock($product->id);
                if ($reason) {
                    $blocked[] = "{$product->sku} ({$product->name}) — {$reason}";
                    continue;
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

                $movement->delete();
                $revertedCount++;
            }

            $importBatch->update([
                'status' => empty($blocked) ? 'undone' : 'partially_undone',
                'undone_at' => now(),
                'undone_by' => auth()->id(),
            ]);
        });

        $parts = [];
        if ($deletedCount > 0) $parts[] = "ลบสินค้าใหม่ {$deletedCount} รายการ";
        if ($revertedCount > 0) $parts[] = "คืนค่าสต็อก/S/N {$revertedCount} รายการ";
        $message = empty($parts) ? 'ไม่มีข้อมูลให้ย้อนกลับ' : 'ยกเลิกการนำเข้าสำเร็จ (' . implode(', ', $parts) . ')';
        if (!empty($blocked)) {
            $message .= ' — ไม่สามารถลบสินค้าต่อไปนี้ได้เพราะถูกใช้งานแล้ว: ' . implode(', ', $blocked);
        }

        return response()->json(['message' => $message, 'blocked' => $blocked]);
    }

    // 🛡️ เช็คว่าสินค้าถูกใช้งานในเอกสาร/ความสัมพันธ์อื่นแล้วหรือยัง ก่อนจะยอมให้ undo ลบทิ้ง — บางตารางมี FK
    // restrictOnDelete (DB จะกันเองอยู่แล้ว) แต่ goods_receipt_items/sale_document_items เก็บ product_id แบบ
    // ไม่มี FK constraint เลย ถ้าไม่เช็คเองจะลบไปแล้วเอกสารเก่ากำพร้าเงียบๆ
    private function findProductUsageBlock(int $productId): ?string
    {
        $checks = [
            'purchase_order_items' => ['product_id', 'ถูกใช้ในใบสั่งซื้อแล้ว'],
            'repair_tickets' => ['product_id', 'ถูกใช้ในใบซ่อมแล้ว'],
            'installation_records' => ['product_id', 'ถูกใช้ในบันทึกการติดตั้งแล้ว'],
            'installation_equipment_items' => ['product_id', 'ถูกใช้ในรายการอุปกรณ์ติดตั้งแล้ว'],
            'product_bundle_items' => ['component_product_id', 'ถูกใช้เป็นส่วนประกอบของสินค้าชุดแล้ว'],
            'goods_receipt_items' => ['product_id', 'ถูกใช้ในใบรับสินค้าแล้ว'],
            'sale_document_items' => ['product_id', 'ถูกใช้ในเอกสารขาย/เช่าแล้ว'],
        ];

        foreach ($checks as $table => [$column, $reason]) {
            if (DB::table($table)->where($column, $productId)->exists()) {
                return $reason;
            }
        }

        return null;
    }
}
