<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\StockMovement;
use App\Models\StockBalance;
use App\Models\ProductSerial;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Warehouse;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class GoodsReceiptController extends Controller
{
    // 💾 1. ฟังก์ชันรับของจากใบสั่งซื้อ (GR from PO)
    public function storeGoodsReceipt(Request $request, $id)
    {
        // 🚀 เกราะป้องกันสิทธิ์: เช็คว่ามีสิทธิ์รายตัว หรือเป็น Platform Admin หรือเป็น Super Admin
        $isSuperAdmin = auth()->user()->isCompanyAdmin();

        if (!auth()->user()->can('create_goods_receipt') && !auth()->user()->is_platform_admin && !$isSuperAdmin) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ทำรายการสร้างใบรับสินค้า'], 403);
        }

        $purchaseOrder = PurchaseOrder::find($id);
        if (!$purchaseOrder) return response()->json(['message' => 'ไม่พบข้อมูลใบสั่งซื้อ'], 404);

        $request->validate([
            'reference_number' => 'nullable|string',
            'received_date' => 'required|date',
            'note' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.po_item_id' => 'required|exists:purchase_order_items,id',
            'items.*.receive_qty' => 'required|integer|min:1',
            'items.*.serials' => 'nullable|array'
        ]);

        try {
            DB::beginTransaction();
            $companyId = auth()->user()->company_id;

            // 🛡️ PO อาจไม่เคยระบุคลังไว้เลย (ช่อง "คลังสินค้าที่จะรับเข้า" ในหน้าสร้าง/แก้ไข PO เลือก "-- ไม่ระบุ --" ได้)
            // stock_balances.warehouse_id เป็น NOT NULL การใช้ $purchaseOrder->warehouse_id ตรงๆ จึงพังด้วย
            // "Column 'warehouse_id' cannot be null" — resolve ไปคลัง default ของบริษัทแทนถ้า PO ไม่ได้ระบุไว้
            $warehouseId = Warehouse::resolveFor($companyId, $purchaseOrder->warehouse_id);

            // รันเลขที่เอกสาร GR อัตโนมัติ (เช่น GR-2606-0001) — ใช้ DocumentService กลางร่วมกับ PO/Sale Documents
            $grNumber = DocumentService::generate('goods_receipt', $companyId);

            // สร้างหัวเอกสาร Goods Receipt
            $gr = GoodsReceipt::create([
                'company_id' => $companyId,
                'purchase_order_id' => $purchaseOrder->id,
                'gr_number' => $grNumber,
                'reference_number' => $request->reference_number,
                'received_date' => $request->received_date,
                'status' => 'Completed',
                'note' => $request->note,
                'created_by' => auth()->id(),
            ]);

            foreach ($request->items as $reqItem) {
                // 🔒 ล็อกแถวกันแย่งกันอัปเดต received_quantity พร้อมกัน (race condition)
                // 🛡️ และบังคับว่า po_item_id ต้องเป็นของ purchase_order_id ที่ระบุจริง กัน IDOR ข้าม PO/ข้ามบริษัท
                $poItem = PurchaseOrderItem::where('id', $reqItem['po_item_id'])
                    ->where('purchase_order_id', $purchaseOrder->id)
                    ->lockForUpdate()
                    ->first();

                if (!$poItem) {
                    throw new \Exception("ไม่พบรายการสินค้านี้ในใบสั่งซื้อที่ระบุ");
                }

                $newReceivedQty = $poItem->received_quantity + $reqItem['receive_qty'];

                if ($newReceivedQty > $poItem->quantity) {
                    throw new \Exception("จำนวนรับเข้าเกินยอดสั่งซื้อสำหรับสินค้าสล๊อตนี้");
                }

                // อัปเดตยอดรับสะสมในรายการ PO
                $poItem->update(['received_quantity' => $newReceivedQty]);

                // บันทึกรายการลง Goods Receipt Items — unit_price ดึงจาก PO ตรงๆ ไม่ต้องให้ผู้ใช้กรอกเอง
                $gr->items()->create([
                    'product_id' => $poItem->product_id,
                    'quantity' => $reqItem['receive_qty'],
                    'unit_price' => $poItem->unit_price,
                ]);

                // สร้างประวัติคลัง Stock Movement
                $movement = StockMovement::create([
                    'product_id' => $poItem->product_id,
                    'type' => 'in',
                    'quantity' => $reqItem['receive_qty'],
                    'reference_number' => $grNumber,
                    'note' => 'รับเข้าคลังสินค้าด้วยใบรับของ ' . $grNumber . ' (อ้างอิงบิลซื้อ ' . $purchaseOrder->po_number . ')',
                    'user_id' => auth()->id(),
                    'warehouse_id' => $warehouseId,
                    'company_id' => $companyId
                ]);

                // 🛡️ อัปเดตยอดคงเหลือสต็อกจริง (StockBalance) — ล็อกแถวกันแข่งกันบันทึกพร้อมกัน (lost update)
                $balance = StockBalance::lockedFor($poItem->product_id, $companyId, $warehouseId);
                $balance->qty += $reqItem['receive_qty'];
                $balance->save();

                // บันทึก Serial Numbers
                if (!empty($reqItem['serials'])) {
                    foreach ($reqItem['serials'] as $sn) {
                        $sn = trim($sn);
                        if (!empty($sn)) {
                            $exists = ProductSerial::where('serial_number', $sn)->exists();
                            if ($exists) throw new \Exception("S/N: {$sn} มีอยู่ในระบบแล้ว ไม่สามารถรับซ้ำได้");

                            ProductSerial::create([
                                'product_id' => $poItem->product_id,
                                'serial_number' => $sn,
                                'warehouse_id' => $warehouseId,
                                'stock_movement_id' => $movement->id,
                                'status' => 'available',
                                'company_id' => $companyId
                            ]);
                        }
                    }
                }
            }

            // อัปเดตสถานะของใบสั่งซื้อหลัก (PO)
            $purchaseOrder->load('items');
            $isAllReceived = true;
            foreach ($purchaseOrder->items as $item) {
                if ($item->received_quantity < $item->quantity) {
                    $isAllReceived = false;
                    break;
                }
            }
            $purchaseOrder->update(['status' => $isAllReceived ? 'Completed' : 'Partial']);

            DB::commit();
            return response()->json(['message' => 'บันทึกใบรับสินค้าสำเร็จ', 'gr_number' => $grNumber]);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json(['message' => $th->getMessage()], 400);
        }
    }

    // 💾 2. ฟังก์ชันรับของตรงเข้าคลัง (Direct GR - รับด่วนไม่มี PO)
    public function storeDirectGoodsReceipt(Request $request)
    {
        $isSuperAdmin = auth()->user()->isCompanyAdmin();
        if (!auth()->user()->can('create_goods_receipt') && !auth()->user()->is_platform_admin && !$isSuperAdmin) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ทำรายการรับสินค้าเข้าคลัง'], 403);
        }

        $companyId = auth()->user()->company_id;

        // 🛡️ exists: เดิมเช็คแค่ id มีอยู่จริง ไม่ได้เช็คว่าเป็นของบริษัทตัวเอง เพิ่ม company_id กันอ้างอิงข้ามบริษัท
        $request->validate([
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('company_id', $companyId)],
            'contact_id' => ['required', Rule::exists('contacts', 'id')->where('company_id', $companyId)],
            'reference_number' => 'nullable|string',
            'received_date' => 'required|date',
            'note' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => ['required', Rule::exists('products', 'id')->where('company_id', $companyId)],
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.serials' => 'nullable|array'
        ]);

        try {
            DB::beginTransaction();

            // มีเลขที่เอกสารเป็นชุดของตัวเอง (GRD) แยกจาก GR ที่รับผ่าน PO เพื่อไม่ให้เลขรันชนกัน
            $grNumber = DocumentService::generate('goods_receipt_direct', $companyId);

            $gr = GoodsReceipt::create([
                'company_id' => $companyId,
                'purchase_order_id' => null,
                'contact_id' => $request->contact_id,
                'gr_number' => $grNumber,
                'reference_number' => $request->reference_number,
                'received_date' => $request->received_date,
                'status' => 'Completed',
                'note' => $request->note . " (รับตรงไม่มีใบสั่งซื้อ)",
                'created_by' => auth()->id(),
            ]);

            foreach ($request->items as $reqItem) {
                $gr->items()->create([
                    'product_id' => $reqItem['product_id'],
                    'quantity' => $reqItem['quantity'],
                    'unit_price' => $reqItem['unit_price'],
                ]);

                $movement = StockMovement::create([
                    'product_id' => $reqItem['product_id'],
                    'type' => 'in',
                    'quantity' => $reqItem['quantity'],
                    'reference_number' => $grNumber,
                    'note' => 'รับเข้าสต๊อกด่วนหน้าร้าน/ไม่มี PO ด้วยใบรับของ ' . $grNumber,
                    'user_id' => auth()->id(),
                    'warehouse_id' => $request->warehouse_id,
                    'company_id' => $companyId
                ]);

                // 🛡️ อัปเดตยอดคงเหลือสต็อกจริง (StockBalance) — ล็อกแถวกันแข่งกันบันทึกพร้อมกัน (lost update)
                $balance = StockBalance::lockedFor($reqItem['product_id'], $companyId, $request->warehouse_id);
                $balance->qty += $reqItem['quantity'];
                $balance->save();

                if (!empty($reqItem['serials'])) {
                    foreach ($reqItem['serials'] as $sn) {
                        $sn = trim($sn);
                        if (!empty($sn)) {
                            $exists = ProductSerial::where('serial_number', $sn)->exists();
                            if ($exists) {
                                throw new \Exception("S/N: {$sn} มีอยู่ในระบบแล้ว ไม่สามารถรับซ้ำได้ครับ");
                            }

                            ProductSerial::create([
                                'product_id' => $reqItem['product_id'],
                                'serial_number' => $sn,
                                'warehouse_id' => $request->warehouse_id,
                                'stock_movement_id' => $movement->id,
                                'status' => 'available',
                                'company_id' => $companyId
                            ]);
                        }
                    }
                }
            }

            DB::commit();
            return response()->json(['message' => 'บันทึกใบรับสินค้าตรงเข้าคลังสำเร็จ', 'gr_number' => $grNumber]);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json(['message' => $th->getMessage()], 400);
        }
    }

    // 📦 3. ดึงรายการใบรับสินค้าทั้งหมด
    public function getGoodsReceipts()
    {
        try {
            // 🛡️ เดิม eager-load แค่ purchaseOrder.contact ทำให้ใบรับสินค้าแบบ "รับตรงไม่มี PO" (contact ถูกเลือกตรงๆ
            // ไม่ได้มาจาก PO) ไม่มีทางแสดงชื่อผู้จำหน่ายได้เลย — เพิ่ม contact (ตรง) และ creator (ผู้บันทึกเอกสาร สำหรับ PDF)
            $grs = GoodsReceipt::with(['purchaseOrder.contact', 'contact', 'creator'])
                ->where('company_id', auth()->user()->company_id)
                ->orderByDesc('id')
                ->get()
                ->map(function ($gr) {
                    // ใบที่อ้างอิง PO ให้ยึดผู้จำหน่ายจาก PO เป็นหลัก ใบที่รับตรงไม่มี PO ใช้ contact ที่เลือกไว้ตรงๆ
                    $contact = $gr->purchaseOrder->contact ?? $gr->contact ?? null;
                    return array_merge($gr->toArray(), [
                        'po_number' => $gr->purchaseOrder->po_number ?? null,
                        'business_name' => $contact->business_name ?? null,
                        'contact_name' => $contact->contact_person_name ?? null,
                        'creator' => $gr->creator ? [
                            'name' => $gr->creator->name,
                            'signature_base64' => $gr->creator->signature_base64,
                        ] : null,
                    ]);
                });

            return response()->json($grs);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }

    // ❌ 4. ยกเลิกใบรับสินค้า (Void) และดึงสต๊อกกลับ
    public function cancelGoodsReceipt(Request $request, $id)
    {
        $isSuperAdmin = auth()->user()->isCompanyAdmin();

        if (!auth()->user()->can('edit_purchase') && !auth()->user()->is_platform_admin && !$isSuperAdmin) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ทำรายการยกเลิกใบรับสินค้า'], 403);
        }

        $request->validate([
            'reason' => 'required|string|max:255'
        ]);

        try {
            DB::beginTransaction();
            $companyId = auth()->user()->company_id;

            $gr = GoodsReceipt::with('items')->where('id', $id)->where('company_id', $companyId)->first();
            if (!$gr) throw new \Exception('ไม่พบข้อมูลใบรับสินค้า');
            if ($gr->status === 'Cancelled') throw new \Exception('เอกสารใบนี้ถูกยกเลิกไปแล้ว');

            // --- ส่วนของ ถ้ารับจากใบ PO ---
            if ($gr->purchase_order_id) {
                $po = PurchaseOrder::with('items')->find($gr->purchase_order_id);
                if (!$po) throw new \Exception('ไม่พบใบสั่งซื้อต้นทางอ้างอิง');

                // 🛡️ ต้อง resolve คลังแบบเดียวกับตอนรับเข้า (storeGoodsReceipt) เพราะ PO อาจไม่ได้ระบุคลังไว้
                // ถ้าใช้ $po->warehouse_id ตรงๆ (อาจเป็น null) ทั้งจะพังและจะหักยอดผิดคลังจากที่รับเข้าจริง
                $warehouseId = Warehouse::resolveFor($companyId, $po->warehouse_id);

                foreach ($gr->items as $grItem) {
                    $poItem = $po->items->where('product_id', $grItem->product_id)->first();
                    if ($poItem) {
                        $poItem->received_quantity -= $grItem->quantity;
                        if ($poItem->received_quantity < 0) $poItem->received_quantity = 0;
                        $poItem->save();
                    }

                    StockMovement::create([
                        'product_id' => $grItem->product_id,
                        'type' => 'out',
                        'quantity' => $grItem->quantity,
                        'reference_number' => $gr->gr_number,
                        'note' => 'ยกเลิกใบรับสินค้า: ' . $request->reason,
                        'user_id' => auth()->id(),
                        'warehouse_id' => $warehouseId,
                        'company_id' => $companyId
                    ]);

                    // 🛡️ ดึงยอดคงเหลือ (StockBalance) กลับ ให้ตรงกับที่หักออกตอนยกเลิก
                    $balance = StockBalance::where('product_id', $grItem->product_id)
                        ->where('company_id', $companyId)
                        ->where('warehouse_id', $warehouseId)
                        ->lockForUpdate()
                        ->first();
                    if ($balance) {
                        $balance->qty = max(0, $balance->qty - $grItem->quantity);
                        $balance->save();
                    }
                }

                $totalReceived = $po->items->sum('received_quantity');
                $po->status = ($totalReceived == 0) ? 'Approved' : 'Partial';
                $po->save();
            }
            // --- ส่วนของ ถ้ารับตรงแบบไม่มี PO ---
            else {
                // หักสต๊อกออกตามคลังต้นทางที่เคยบันทึกไว้
                foreach ($gr->items as $grItem) {
                    $originalInMovement = StockMovement::where('reference_number', $gr->gr_number)
                        ->where('product_id', $grItem->product_id)
                        ->where('type', 'in')->first();

                    StockMovement::create([
                        'product_id' => $grItem->product_id,
                        'type' => 'out',
                        'quantity' => $grItem->quantity,
                        'reference_number' => $gr->gr_number,
                        'note' => 'ยกเลิกใบรับตรงฉุกเฉิน: ' . $request->reason,
                        'user_id' => auth()->id(),
                        'warehouse_id' => $originalInMovement->warehouse_id ?? null,
                        'company_id' => $companyId
                    ]);

                    // 🛡️ ดึงยอดคงเหลือ (StockBalance) กลับ ให้ตรงกับที่หักออกตอนยกเลิก
                    if ($originalInMovement && $originalInMovement->warehouse_id) {
                        $balance = StockBalance::where('product_id', $grItem->product_id)
                            ->where('company_id', $companyId)
                            ->where('warehouse_id', $originalInMovement->warehouse_id)
                            ->lockForUpdate()
                            ->first();
                        if ($balance) {
                            $balance->qty = max(0, $balance->qty - $grItem->quantity);
                            $balance->save();
                        }
                    }
                }
            }

            // ลบ Serial Number ร่วมกัน (ทำงานเหมือนกันทั้งสองแบบ)
            $inMovements = StockMovement::where('reference_number', $gr->gr_number)->where('type', 'in')->pluck('id');
            if ($inMovements->isNotEmpty()) {
                ProductSerial::whereIn('stock_movement_id', $inMovements)->delete();
            }

            // อัปเดตสถานะบิลเป็นยกเลิก
            $gr->note = $gr->note ? $gr->note . "\n[ยกเลิก]: " . $request->reason : "[ยกเลิก]: " . $request->reason;
            $gr->status = 'Cancelled';
            $gr->save();

            DB::commit();
            return response()->json(['message' => 'ยกเลิกใบรับสินค้าและปรับปรุงสต๊อกสำเร็จ']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function showItems($id)
    {
        // 🛡️ ต้องเช็คว่า GR เป็นของบริษัทผู้ใช้ก่อน กันดูรายการสินค้าของบริษัทอื่นข้าม tenant
        $gr = GoodsReceipt::where('id', $id)->where('company_id', auth()->user()->company_id)->first();
        if (!$gr) return response()->json(['message' => 'ไม่พบข้อมูลใบรับสินค้า'], 404);

        $items = GoodsReceiptItem::with('product')
            ->where('goods_receipt_id', $gr->id)
            ->get()
            ->map(function ($item) {
                return array_merge($item->toArray(), [
                    'product_name' => $item->product->name ?? null,
                ]);
            });

        return response()->json($items);
    }
}
