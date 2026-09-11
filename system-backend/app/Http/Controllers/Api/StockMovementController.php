<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\ProductSerial;
use App\Models\StockBalance;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Exports\InventoryExport;
use App\Imports\InventoryImport;
use Maatwebsite\Excel\Facades\Excel;

class StockMovementController extends Controller
{
    // 🏬 หา warehouse_id ที่จะใช้บันทึกจริง: ใช้ตัวที่ frontend ส่งมา (ถ้าเป็นของบริษัทนี้จริง) ไม่งั้น fallback ไปคลัง default ของบริษัท
    private function resolveWarehouseId(Request $request, int $companyId): ?int
    {
        return Warehouse::resolveFor($companyId, $request->input('warehouse_id'));
    }

    // ==========================================
    // 💡 1. บันทึกความเคลื่อนไหวสต็อก (เข้า/ออก) ทีละรายการ
    // ==========================================
    public function store(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'type' => 'required|in:in,out,adjust',
            'quantity' => 'required|integer|min:1',
            'serials' => 'nullable|array',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'cost_price' => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $product = Product::findOrFail($request->product_id);
            $qty = (int)$request->quantity;
            $type = $request->type;
            $serials = $request->serials ?? [];
            $companyId = auth()->user()->company_id;
            $warehouseId = $this->resolveWarehouseId($request, $companyId);
            // 💰 ต้นทุนต่อหน่วย มีความหมายเฉพาะตอนรับเข้า (type=in) เท่านั้น — เว้นว่างได้ ถ้ากรอกมาจะสร้าง
            // ใบรับสินค้าจริงแทน StockMovement เปล่าๆ (ดูด้านล่าง) เพื่อให้ต้นทุนถัวเฉลี่ยของสินค้าคำนวณได้
            // ถูกต้อง (ReportController::averageCostByProduct() อ่านจาก goods_receipt_items.unit_price เท่านั้น)
            $costPrice = ($type === 'in' && $request->filled('cost_price')) ? (float)$request->cost_price : null;

            // 🛡️ ล็อกแถวยอดคงเหลือก่อนเช็ค/แก้ไข กันสองคำขอพร้อมกันอ่านยอดเดียวกันแล้วต่างฝ่ายต่างผ่านเงื่อนไข (race)
            $balance = StockBalance::lockedFor($product->id, $companyId, $warehouseId);

            // 🛡️ เช็คสต็อกคงเหลือก่อนเบิกออก
            if ($type === 'out') {
                if ($balance->qty < $qty) {
                    DB::rollBack();
                    return response()->json(['message' => 'เบิกออกไม่ได้: สต็อกคงเหลือไม่เพียงพอ'], 422);
                }

                // 🚨 [เพิ่มใหม่] ตรวจสอบ S/N ว่าเป็นของสินค้านี้จริงๆ ใช่ไหม (ป้องกันการสแกนข้ามสินค้า)
                if ($product->has_serial_number && count($serials) > 0) {
                    $validSerialsCount = ProductSerial::whereIn('serial_number', $serials)
                        ->where('product_id', $product->id) // ล็อคเป้าให้ตรงกับสินค้าที่เลือก
                        ->where('status', 'available')
                        ->count();

                    if ($validSerialsCount !== count($serials)) {
                        DB::rollBack();
                        return response()->json(['message' => 'เบิกออกไม่ได้: พบ S/N ที่ไม่ใช่ของสินค้านี้ หรือ S/N ถูกเบิกไปแล้ว'], 422);
                    }
                }
            }

            // 🛡️ สินค้าที่มีระบบ S/N รับเข้าต้องกรอกจำนวน serial ให้เท่ากับ qty เป๊ะ — เดิมเช็คแค่ฝั่ง
            // frontend (StockMovementForm.tsx) ทำให้ยอดคงเหลือถูกบวกเต็มจำนวนได้โดยไม่มี serial รองรับครบ
            // ถ้าคำขอไม่ได้ผ่านฟอร์มนั้น (เจอ mismatch จริงจากไฟล์ export ที่ผู้ใช้ส่งมา)
            if ($type === 'in' && $product->has_serial_number && count($serials) !== $qty) {
                DB::rollBack();
                return response()->json(['message' => "สินค้า \"{$product->name}\" มีระบบ S/N ต้องกรอกจำนวน Serial Number (" . count($serials) . " รายการ) ให้เท่ากับจำนวนที่รับเข้า ({$qty}) เท่านั้น"], 422);
            }

            // 💰 มีต้นทุนกรอกมา — สร้างใบรับสินค้าจริงแทน (reuse กลไกเดียวกับ "รับสินค้าเข้าโดยตรง")
            if ($costPrice !== null) {
                $note = trim((string)($request->note ?? ''));
                $grNote = 'สร้างอัตโนมัติจากรับสินค้าด้วยมือ' . ($note !== '' ? " — {$note}" : '');

                $gr = \App\Services\DirectGoodsReceiptService::create(
                    $companyId,
                    $warehouseId,
                    auth()->id() ?? 1,
                    $grNote,
                    [[
                        'product_id' => $product->id,
                        'quantity' => $qty,
                        'unit_price' => $costPrice,
                        'serials' => $serials,
                    ]],
                );
                $movement = StockMovement::where('reference_number', $gr->gr_number)
                    ->where('product_id', $product->id)
                    ->first();

                DB::commit();
                return response()->json([
                    'message' => 'บันทึกรายการสำเร็จ!',
                    'data' => $movement
                ]);
            }

            // 🛡️ สร้าง Movement
            $movement = new StockMovement();
            $movement->product_id = $product->id;
            $movement->user_id = auth()->id() ?? 1;
            $movement->type = $type;
            $movement->quantity = $qty;
            $movement->reference_number = $request->reference_number ?? '';
            $movement->note = $request->note ?? '';
            $movement->company_id = $companyId;
            $movement->warehouse_id = $warehouseId;
            $movement->save();

            // 🛡️ จัดการอัปเดตยอดคงเหลือ (Balance) — $balance ถูกล็อกไว้แล้วด้านบน
            if ($type === 'in') {
                $balance->qty += $qty;
            } else if ($type === 'out') {
                $balance->qty -= $qty;
            }
            $balance->save();

            // 🛡️ จัดการ Serial Numbers (S/N)
            if ($product->has_serial_number && count($serials) > 0) {
                if ($type === 'in') {
                    foreach ($serials as $sn) {
                        ProductSerial::create([
                            'company_id' => $companyId,
                            'warehouse_id' => $warehouseId,
                            'product_id' => $product->id,
                            'serial_number' => (string)$sn,
                            'status' => 'available',
                            'stock_movement_id' => $movement->id,
                        ]);
                    }
                } else if ($type === 'out') {
                    ProductSerial::whereIn('serial_number', $serials)
                        ->where('product_id', $product->id) // 🚨 [เพิ่มใหม่] ล็อคเป้าตอนอัปเดตอีก 1 ชั้นเพื่อความปลอดภัย
                        ->update([
                            'status' => 'sold',
                            'stock_movement_id' => $movement->id
                        ]);
                }
            }

            DB::commit();
            return response()->json([
                'message' => 'บันทึกรายการสำเร็จ!',
                'data' => $movement
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'DB พัง บรรทัด ' . $e->getLine() . ': ' . $e->getMessage()
            ], 500);
        }
    }

    // ==========================================
    // 💡 1.5 โอนย้ายสินค้าระหว่างคลัง (รองรับข้าม SKU ด้วย — เช่น สินค้าตัวเดียวกันแต่คนละ SKU
    // สำหรับขาย/เช่า) — มิเรอร์ pattern "1 action ผู้ใช้ = out+in ผูกกันด้วย reference_number เดียวกัน"
    // ที่ storeBatch()/GoodsReceiptController ใช้อยู่แล้ว ไม่เพิ่มค่า enum 'type' ใหม่
    // ==========================================
    public function transfer(Request $request)
    {
        $request->validate([
            'from_product_id' => 'required|exists:products,id',
            'to_product_id' => 'nullable|exists:products,id', // ว่าง = โอนย้าย SKU เดียวกับต้นทาง
            'from_warehouse_id' => 'required|exists:warehouses,id',
            'to_warehouse_id' => 'required|exists:warehouses,id',
            'quantity' => 'nullable|integer|min:1',
            'serials' => 'nullable|array',
            'reference_number' => 'nullable|string',
            'note' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            $companyId = auth()->user()->company_id;
            $fromProduct = Product::findOrFail($request->from_product_id);
            $toProduct = $request->to_product_id
                ? Product::findOrFail($request->to_product_id)
                : $fromProduct;
            $fromWarehouseId = (int) $request->from_warehouse_id;
            $toWarehouseId = (int) $request->to_warehouse_id;
            $serials = $request->serials ?? [];
            $isCrossSku = $toProduct->id !== $fromProduct->id;

            // 🛡️ ต้นทาง/ปลายทางเหมือนกันทุกอย่าง = ไม่มีอะไรให้โอน
            if (!$isCrossSku && $fromWarehouseId === $toWarehouseId) {
                DB::rollBack();
                return response()->json(['message' => 'คลังต้นทางและปลายทางต้องไม่ใช่คลังเดียวกัน (เมื่อเป็นสินค้า SKU เดียวกัน)'], 422);
            }

            // 🛡️ ข้าม SKU ได้ แต่ต้องตั้งค่า S/N ตรงกัน ไม่งั้นจำนวน/สถานะ S/N จะขัดแย้งกันเอง
            if ((bool) $fromProduct->has_serial_number !== (bool) $toProduct->has_serial_number) {
                DB::rollBack();
                return response()->json(['message' => 'สินค้าต้นทางและปลายทางต้องตั้งค่าระบบ S/N ตรงกัน (มี S/N ทั้งคู่ หรือไม่มีทั้งคู่)'], 422);
            }

            $fromBalance = StockBalance::lockedFor($fromProduct->id, $companyId, $fromWarehouseId);

            if ($fromProduct->has_serial_number) {
                if (count($serials) === 0) {
                    DB::rollBack();
                    return response()->json(['message' => 'กรุณาระบุ Serial Number ที่ต้องการโอนย้าย'], 422);
                }

                // 🛡️ ต้องเป็น S/N ของสินค้าต้นทางจริง, ยังพร้อมใช้งาน (available), และอยู่ในคลังต้นทางที่เลือกไว้
                // จริง (เช็คใหม่ — เดิมไม่มีจุดไหนเช็ค warehouse_id ของ S/N มาก่อนเลย)
                $validSerials = ProductSerial::whereIn('serial_number', $serials)
                    ->where('product_id', $fromProduct->id)
                    ->where('status', 'available')
                    ->where('warehouse_id', $fromWarehouseId)
                    ->pluck('serial_number')
                    ->all();
                $invalidSerials = array_diff($serials, $validSerials);

                if (count($invalidSerials) > 0) {
                    DB::rollBack();
                    return response()->json(['message' => 'S/N ต่อไปนี้ไม่พร้อมโอนย้าย (ไม่ใช่ของสินค้านี้/ไม่ได้อยู่คลังต้นทางที่เลือก/ถูกใช้งานไปแล้ว): ' . implode(', ', $invalidSerials)], 422);
                }
                $qty = count($serials);
            } else {
                $qty = (int) ($request->quantity ?? 0);
                if ($qty < 1) {
                    DB::rollBack();
                    return response()->json(['message' => 'กรุณาระบุจำนวนที่ต้องการโอนย้าย'], 422);
                }
                if ($fromBalance->qty < $qty) {
                    DB::rollBack();
                    return response()->json(['message' => 'โอนย้ายไม่ได้: สต็อกคงเหลือที่คลังต้นทางไม่เพียงพอ'], 422);
                }
            }

            $toBalance = StockBalance::lockedFor($toProduct->id, $companyId, $toWarehouseId);
            $ref = $request->reference_number ?: ('TRF-' . date('Ymd-His'));
            $note = $request->note ?: "โอนย้ายคลังสินค้า ({$fromProduct->sku} → {$toProduct->sku})";

            $outMovement = StockMovement::create([
                'product_id' => $fromProduct->id,
                'user_id' => auth()->id() ?? 1,
                'type' => 'out',
                'quantity' => $qty,
                'reference_number' => $ref,
                'note' => $note,
                'company_id' => $companyId,
                'warehouse_id' => $fromWarehouseId,
            ]);
            $inMovement = StockMovement::create([
                'product_id' => $toProduct->id,
                'user_id' => auth()->id() ?? 1,
                'type' => 'in',
                'quantity' => $qty,
                'reference_number' => $ref,
                'note' => $note,
                'company_id' => $companyId,
                'warehouse_id' => $toWarehouseId,
            ]);

            $fromBalance->qty -= $qty;
            $fromBalance->save();
            $toBalance->qty += $qty;
            $toBalance->save();

            if ($fromProduct->has_serial_number) {
                // 🛡️ repoint แถวเดิม (ไอดีเดิม) แทนการลบสร้างใหม่ — กัน FK จาก RepairTicket/InstallationRecord/
                // SaleDocumentItem ที่อ้างอิง serial ตัวนี้ด้วย id หลุด (ประวัติเก่าจะยังอ้างอิง SKU เดิมต่อไป
                // ตามที่แจ้งผู้ใช้ไว้ในหน้าเว็บ — เป็นข้อจำกัดที่ยอมรับได้)
                ProductSerial::whereIn('serial_number', $serials)
                    ->where('product_id', $fromProduct->id)
                    ->update([
                        'product_id' => $toProduct->id,
                        'warehouse_id' => $toWarehouseId,
                        'stock_movement_id' => $inMovement->id,
                    ]);
            }

            DB::commit();
            return response()->json([
                'message' => $isCrossSku
                    ? "โอนย้ายสำเร็จ {$qty} รายการ จาก {$fromProduct->sku} ไปเป็น {$toProduct->sku} เรียบร้อยแล้ว"
                    : "โอนย้ายสินค้า {$fromProduct->sku} สำเร็จ {$qty} รายการ",
                'is_cross_sku' => $isCrossSku,
                'reference_number' => $ref,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'เกิดข้อผิดพลาด บรรทัด ' . $e->getLine() . ': ' . $e->getMessage()], 500);
        }
    }

    // ==========================================
    // 💡 2. ดึงข้อมูลประวัติ (แสดงผู้ดำเนินการ)
    // ==========================================
    public function index(Request $request)
    {
        $query = StockMovement::with(['product', 'user']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('reference_number', 'like', "%{$search}%")
                    ->orWhere('note', 'like', "%{$search}%")
                    ->orWhereHas('product', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%")
                            ->orWhere('sku', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $perPage = $request->get('per_page', 15);
        $movements = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($movements);
    }

    // ส่งออก Excel รายการความเคลื่อนไหวสต๊อกตาม filter เดียวกับหน้า list (search/type/ช่วงวันที่)
    public function exportMovements(Request $request)
    {
        $query = StockMovement::with(['product', 'user']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('reference_number', 'like', "%{$search}%")
                    ->orWhere('note', 'like', "%{$search}%")
                    ->orWhereHas('product', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%")
                            ->orWhere('sku', 'like', "%{$search}%");
                    });
            });
        }
        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $movements = $query->orderBy('created_at', 'desc')->limit(2000)->get();

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\Reports\StockMovementsExport($movements),
            'stock_movements_' . now()->format('Ymd_His') . '.xlsx',
        );
    }

    // ==========================================
    // 💡 3. บันทึกแบบ "หลายรายการ" (Batch)
    // ==========================================
    public function storeBatch(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:in,out',
            'reference_number' => 'nullable|string',
            'note' => 'nullable|string',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.serials' => 'nullable|array',
            'items.*.cost_price' => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();

        try {
            $movementIds = [];
            $companyId = auth()->user()->company_id;
            $warehouseId = $this->resolveWarehouseId($request, $companyId);
            // 💰 ถ้ามีแถวไหนกรอกต้นทุนมา (มีความหมายเฉพาะตอน type=in) จะรวมอยู่ในใบรับสินค้าใบเดียวกันทั้งหมด
            // (สร้างแบบ lazy — สร้างครั้งแรกที่เจอแถวมีต้นทุนจริงเท่านั้น กันใบรับสินค้าว่างเปล่า)
            $note = trim((string)($validated['note'] ?? ''));
            $pendingReceipt = new \App\Services\PendingImportReceipt(
                $companyId,
                $warehouseId,
                auth()->id() ?? 1,
                'สร้างอัตโนมัติจากรับสินค้าด้วยมือ (หลายรายการ)' . ($note !== '' ? " — {$note}" : ''),
            );

            foreach ($validated['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $costPrice = ($validated['type'] === 'in' && isset($item['cost_price']) && $item['cost_price'] !== null)
                    ? (float)$item['cost_price']
                    : null;

                // 🛡️ เหตุผลเดียวกับ store() ด้านบน — บังคับจำนวน S/N ให้เท่ากับ quantity ที่ backend ด้วย
                if ($validated['type'] === 'in' && $product->has_serial_number) {
                    $serialCount = count($item['serials'] ?? []);
                    if ($serialCount !== (int) $item['quantity']) {
                        throw new \Exception("สินค้า \"{$product->name}\" มีระบบ S/N ต้องกรอกจำนวน Serial Number ({$serialCount} รายการ) ให้เท่ากับจำนวนที่รับเข้า ({$item['quantity']}) เท่านั้น");
                    }
                }

                if ($validated['type'] === 'in' && !empty($item['serials'])) {
                    $existingSns = ProductSerial::whereIn('serial_number', $item['serials'])->exists();
                    if ($existingSns) {
                        throw new \Exception("พบ S/N ซ้ำในระบบของรหัสสินค้า: " . $product->sku);
                    }
                }

                // 💰 มีต้นทุนกรอกมา — ต่อรายการในใบรับสินค้าจริงแทน StockMovement เปล่าๆ
                if ($costPrice !== null) {
                    $pendingReceipt->addItem([
                        'product_id' => $product->id,
                        'quantity' => (int) $item['quantity'],
                        'unit_price' => $costPrice,
                        'serials' => $item['serials'] ?? [],
                    ]);
                    $movement = StockMovement::where('product_id', $product->id)
                        ->where('type', 'in')
                        ->latest('id')
                        ->first();
                    $movementIds[] = $movement->id;
                    continue;
                }

                $movement = StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => auth()->id() ?? 1,
                    'type' => $validated['type'],
                    'quantity' => $item['quantity'],
                    'reference_number' => $validated['reference_number'] ?? '',
                    'note' => $validated['note'] ?? '',
                    'company_id' => $companyId,
                    'warehouse_id' => $warehouseId,
                ]);
                $movementIds[] = $movement->id;

                // 🛡️ ล็อกแถวยอดคงเหลือก่อนเช็ค/แก้ไข กันสองคำขอพร้อมกันแข่งกัน (race)
                $balance = StockBalance::lockedFor($product->id, $companyId, $warehouseId);

                if ($validated['type'] === 'in') {
                    $balance->qty += $item['quantity'];
                } elseif ($validated['type'] === 'out') {
                    if ($balance->qty < $item['quantity']) {
                        throw new \Exception("สต็อกไม่พอสำหรับการเบิกสินค้ารหัส: " . $product->sku);
                    }

                    // 🚨 [เพิ่มใหม่] ตรวจสอบ S/N ว่าเป็นของสินค้านี้จริงๆ ใช่ไหม สำหรับหน้า Bulk
                    if ($product->has_serial_number && !empty($item['serials'])) {
                        $validSerialsCount = ProductSerial::whereIn('serial_number', $item['serials'])
                            ->where('product_id', $product->id)
                            ->where('status', 'available')
                            ->count();

                        if ($validSerialsCount !== count($item['serials'])) {
                            throw new \Exception("รายการถูกยกเลิก: S/N บางรายการไม่ใช่ของสินค้า " . $product->sku . " หรือ S/N นี้ถูกตัดสต็อกไปแล้ว");
                        }
                    }

                    $balance->qty -= $item['quantity'];
                }
                $balance->save();

                if ($product->has_serial_number && !empty($item['serials'])) {
                    if ($validated['type'] === 'in') {
                        foreach ($item['serials'] as $sn) {
                            ProductSerial::create([
                                'company_id' => $companyId,
                                'warehouse_id' => $warehouseId,
                                'product_id' => $product->id,
                                'serial_number' => $sn,
                                'status' => 'available',
                                'stock_movement_id' => $movement->id,
                            ]);
                        }
                    } elseif ($validated['type'] === 'out') {
                        ProductSerial::whereIn('serial_number', $item['serials'])
                            ->where('product_id', $product->id) // 🚨 [เพิ่มใหม่] ล็อคเป้าอีกชั้นตอน Bulk Update
                            ->update([
                                'status' => 'sold',
                                'stock_movement_id' => $movement->id,
                            ]);
                    }
                }
            }

            DB::commit();
            return response()->json([
                'message' => 'บันทึกหลายรายการสำเร็จ!',
                'data' => $movementIds
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500); // แสดง Error ตรงๆ ให้ Toster บนเว็บจับได้เลย
        }
    }

    // ==========================================
    // 💡 4. ดึงข้อมูลไปแสดง (เผื่อทำหน้า Print)
    // ==========================================
    public function show($id)
    {
        try {
            $movement = StockMovement::with('product')->find($id);

            if (!$movement) {
                return response()->json([
                    'message' => 'ไม่พบข้อมูลเอกสารอ้างอิง'
                ], 404);
            }

            $serials = ProductSerial::where('stock_movement_id', $id)
                ->pluck('serial_number');
            $movement->serials = $serials;

            return response()->json([
                'message' => 'ดึงข้อมูลสำเร็จ',
                'data' => $movement
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()
            ], 500);
        }
    }

    // ==========================================
    // 💡 5. ส่งออกไฟล์ Excel แบบ 2 Sheets สวยงาม (กรองข้อมูลตาม Filter หน้าเว็บ)
    // ==========================================
    public function exportInventoryExcel(Request $request)
    {
        $query = Product::with(['category', 'stockBalance']);

        // 1. กรองช่อง Search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('model_name', 'like', "%{$search}%");
            });
        }

        // 2. กรองหมวดหมู่
        if ($request->filled('category_id') && $request->category_id !== 'all') {
            $query->where('category_id', $request->category_id);
        }

        // 3. กรองสถานะสต็อก
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

        // 4. กรองสถานะการใช้งาน
        if ($request->filled('is_active') && $request->is_active !== 'all') {
            $val = $request->is_active === 'active' ? 1 : 0;
            $query->where('is_active', $val);
        }

        // ดึงเฉพาะข้อมูลที่ผ่านการกรองแล้ว
        $products = $query->latest()->get();
        $fileName = 'inventory_check_' . date('Ymd_Hi') . '.xlsx';

        return Excel::download(new InventoryExport($products), $fileName);
    }

    // ==========================================
    // 💡 6. นำเข้าไฟล์ Excel (CSV) เพื่อปรับปรุงยอด
    // ==========================================
    // ==========================================
    // 💡 ส่งออกไฟล์ Template เปล่า (เผื่อ User อยากได้ใบว่างๆ)
    // ==========================================
    public function exportInventoryTemplate()
    {
        // โยน Collection เปล่าๆ เข้าไป ระบบจะคายเฉพาะหัวตาราง + Dropdown ออกมา
        return Excel::download(new InventoryExport(collect([])), 'inventory_template.xlsx');
    }

    // ==========================================
    // 💡 ประมวลผลไฟล์ Import (เพิ่มสินค้า + ปรับสต็อก)
    // ==========================================
    public function importInventoryExcel(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv',
            'warehouse_id' => 'nullable|exists:warehouses,id',
        ]);

        try {
            $companyId = auth()->user()->company_id;
            $warehouseId = $this->resolveWarehouseId($request, $companyId);

            Excel::import(new InventoryImport($companyId, $warehouseId), $request->file('file'));
            return response()->json(['message' => 'นำเข้าและปรับสต็อกสำเร็จเรียบร้อย!']);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'รูปแบบไฟล์ผิดพลาด หรือมีข้อมูลไม่ถูกต้อง',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // ==========================================
    // 💡 7. โหลด Template ไฟล์ Excel
    // ==========================================
    public function exportTemplate()
    {
        $products = Product::with('brand')->get();

        $headers = [
            "Content-type"        => "text/csv; charset=UTF-8",
            "Content-Disposition" => "attachment; filename=stock_in_template.csv",
        ];

        $callback = function () use ($products) {
            $file = fopen('php://output', 'w');
            fputs($file, "\xEF\xBB\xBF");

            fputcsv($file, [
                'SKU (ห้ามแก้)',
                'บาร์โค้ด',
                'ชื่อสินค้า',
                'ยี่ห้อ',
                'รุ่นสินค้า',
                'ราคาขาย',
                'ระบบ S/N',
                'จำนวนรับเข้า(ตัวเลข)',
                'รายการ S/N (คั่นด้วยลูกน้ำ)'
            ]);

            foreach ($products as $product) {
                fputcsv($file, [
                    $product->sku,
                    $product->barcode ?: '-',
                    $product->name,
                    $product->brand ? $product->brand->name : '-',
                    $product->model_name ?: '-',
                    $product->price,
                    $product->has_serial_number ? 'ต้องระบุ S/N' : 'ไม่ต้องระบุ',
                    '',
                    ''
                ]);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    // ==========================================
    // 💡 8. นำเข้าสต็อกยกมาเริ่มต้น (Excel)
    // ==========================================
    public function importInitialStock(Request $request)
    {
        $request->validate(['file' => 'required|file']);
        ini_set('auto_detect_line_endings', TRUE);

        $companyId = auth()->user()->company_id;
        $warehouseId = $this->resolveWarehouseId($request, $companyId);

        DB::beginTransaction();
        try {
            $file = $request->file('file');
            $handle = fopen($file->getRealPath(), "r");
            fgetcsv($handle);

            $successCount = 0;
            $errorRows = [];
            $rowIndex = 2;

            while (($row = fgetcsv($handle)) !== FALSE) {
                try {
                    if (count($row) < 9) {
                        $rowIndex++;
                        continue;
                    }

                    $sku = trim((string)$row[0]);
                    $qty = (int)trim((string)$row[7]);
                    $snString = isset($row[8]) ? trim((string)$row[8]) : '';

                    if ($qty <= 0) {
                        $rowIndex++;
                        continue;
                    }

                    $product = Product::where('sku', $sku)->first();
                    if (!$product) {
                        $errorRows[] = "บรรทัด $rowIndex: ไม่พบสินค้า SKU: $sku";
                        $rowIndex++;
                        continue;
                    }

                    $serialsToInsert = [];

                    if ($product->has_serial_number) {
                        if ($snString === '') {
                            $errorRows[] = "บรรทัด $rowIndex: (SKU: $sku) ต้องระบุ S/N";
                            $rowIndex++;
                            continue;
                        }

                        $rawSerials = explode(',', $snString);
                        foreach ($rawSerials as $rs) {
                            $trimmedSn = trim((string)$rs);
                            if ($trimmedSn !== '') {
                                $serialsToInsert[] = $trimmedSn;
                            }
                        }

                        if (count($serialsToInsert) !== $qty) {
                            $errorRows[] = "บรรทัด $rowIndex: (SKU: $sku) S/N ไม่ครบ ($qty ชิ้น แต่ใส่มา " . count($serialsToInsert) . " ตัว)";
                            $rowIndex++;
                            continue;
                        }

                        $existingSns = ProductSerial::whereIn('serial_number', $serialsToInsert)->exists();
                        if ($existingSns) {
                            $errorRows[] = "บรรทัด $rowIndex: (SKU: $sku) พบ S/N ซ้ำในระบบ";
                            $rowIndex++;
                            continue;
                        }
                    }

                    $movement = StockMovement::create([
                        'product_id' => $product->id,
                        'user_id' => auth()->id() ?? 1,
                        'type' => 'in',
                        'quantity' => $qty,
                        'reference_number' => 'INIT-STK-' . date('Ymd-His') . '-' . $rowIndex,
                        'note' => 'รับเข้ายอดยกมา (Excel)',
                        'company_id' => $companyId,
                        'warehouse_id' => $warehouseId,
                    ]);

                    $balance = StockBalance::firstOrCreate(
                        [
                            'product_id' => $product->id,
                            'company_id' => $companyId,
                            'warehouse_id' => $warehouseId
                        ],
                        ['qty' => 0]
                    );
                    $balance->qty += $qty;
                    $balance->save();

                    if ($product->has_serial_number && count($serialsToInsert) > 0) {
                        foreach ($serialsToInsert as $sn) {
                            ProductSerial::create([
                                'company_id' => $companyId,
                                'warehouse_id' => $warehouseId,
                                'product_id' => $product->id,
                                'serial_number' => $sn,
                                'status' => 'available',
                                'stock_movement_id' => $movement->id,
                            ]);
                        }
                    }

                    $successCount++;
                    $rowIndex++;
                } catch (\Throwable $rowException) {
                    DB::rollBack();
                    return response()->json([
                        'message' => 'บั๊กระหว่างบันทึกแถวที่ ' . $rowIndex . ' (SKU: ' . $sku . ')',
                        'errors' => [
                            "สาเหตุ: " . $rowException->getMessage(),
                            "บรรทัดที่พัง: " . $rowException->getLine()
                        ]
                    ], 422);
                }
            }
            fclose($handle);

            if (count($errorRows) > 0) {
                DB::rollBack();
                return response()->json([
                    'message' => 'พบข้อมูลไม่ถูกต้องในไฟล์ Excel',
                    'errors' => $errorRows
                ], 422);
            }

            DB::commit();
            return response()->json(['message' => "รับเข้าสต็อกสำเร็จ $successCount รายการ เรียบร้อยครับ!"]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'เกิด Error ตอนเปิดไฟล์',
                'errors' => [$e->getMessage() . " (Line: " . $e->getLine() . ")"]
            ], 500);
        }
    }
}
