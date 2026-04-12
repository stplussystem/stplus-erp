<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\ProductSerial;
use App\Models\StockBalance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockMovementController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'type' => 'required|in:in,out,adjust',
            'quantity' => 'required|integer|min:1',
            'reference_number' => 'nullable|string',
            'note' => 'nullable|string',
            'serials' => 'nullable|array',
        ]);

        // 💡 1. ดักจับ S/N ขา "รับเข้า" (ห้ามซ้ำกับที่มีอยู่แล้ว)
        if ($validated['type'] === 'in' && !empty($validated['serials'])) {
            $existingSns = ProductSerial::whereIn('serial_number', $validated['serials'])
                            ->pluck('serial_number')
                            ->toArray();

            if (!empty($existingSns)) {
                return response()->json([
                    'message' => "แจ้งเตือน: พบ S/N ซ้ำในระบบ (" . implode(', ', $existingSns) . ") กรุณาลบออกแล้วสแกนใหม่ครับ"
                ], 422);
            }
        }

        // 💡 2. ดักจับ S/N ขา "เบิกออก" (ต้องมีอยู่จริง, สถานะต้อง available, และต้องตรงกับสินค้านั้น)
        if ($validated['type'] === 'out' && !empty($validated['serials'])) {
            // ดึง S/N ที่ถูกต้องทั้งหมดของสินค้านี้ออกมาเช็ค
            $validSns = ProductSerial::where('product_id', $validated['product_id'])
                            ->where('status', 'available')
                            ->whereIn('serial_number', $validated['serials'])
                            ->pluck('serial_number')
                            ->toArray();

            // หาว่ามี S/N ไหนที่ User กรอกมา แต่ไม่ผ่านเงื่อนไขด้านบนบ้าง
            $invalidSns = array_diff($validated['serials'], $validSns);

            if (!empty($invalidSns)) {
                return response()->json([
                    'message' => "แจ้งเตือน: S/N ต่อไปนี้ไม่มีในสต็อก, ถูกขายไปแล้ว หรือไม่ตรงกับสินค้า (" . implode(', ', $invalidSns) . ")"
                ], 422);
            }
        }

        DB::beginTransaction();

        try {
            $product = Product::findOrFail($validated['product_id']);

            // 3. บันทึกประวัติการเคลื่อนไหว
            $movement = StockMovement::create([
                'product_id' => $product->id,
                'type' => $validated['type'],
                'quantity' => $validated['quantity'],
                'reference_number' => $validated['reference_number'],
                'note' => $validated['note'],
                'user_id' => 1,
            ]);

            // 4. อัปเดตยอดคงเหลือ
            $balance = StockBalance::where('product_id', $product->id)->first();
            $change = ($validated['type'] === 'in') ? $validated['quantity'] : -$validated['quantity'];

            if ($balance) {
                // เช็คว่าถ้าเบิกออก ของต้องพอให้เบิก (กันเหนียวอีกชั้น)
                if ($validated['type'] === 'out' && $balance->qty < $validated['quantity']) {
                    throw new \Exception("ยอดสินค้าคงเหลือไม่เพียงพอสำหรับการเบิกออก");
                }
                $balance->increment('qty', $change);
            } else {
                if ($validated['type'] === 'out') {
                    throw new \Exception("ไม่พบสต็อกสินค้านี้ในระบบ");
                }
                StockBalance::create([
                    'company_id' => 1,
                    'warehouse_id' => 1,
                    'product_id' => $product->id,
                    'qty' => $validated['quantity'],
                ]);
            }

            // 5. จัดการสถานะ S/N
            if ($product->has_serial_number && !empty($validated['serials'])) {
                if ($validated['type'] === 'in') {
                    // ขารับเข้า: สร้าง S/N ลงตารางใหม่
                    foreach ($validated['serials'] as $sn) {
                        ProductSerial::create([
                            'company_id' => 1,
                            'product_id' => $product->id,
                            'serial_number' => $sn,
                            'status' => 'available',
                            'stock_movement_id' => $movement->id,
                        ]);
                    }
                } elseif ($validated['type'] === 'out') {
                    // 💡 ขาเบิกออก: แค่อัปเดตสถานะของเก่าให้เป็น sold ไม่ต้องสร้างใหม่
                    ProductSerial::whereIn('serial_number', $validated['serials'])
                        ->update([
                            'status' => 'sold',
                            'stock_movement_id' => $movement->id,
                        ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'บันทึกรายการสต็อกเรียบร้อยแล้ว!',
                'data' => $movement
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()
            ], 500);
        }
    }
}
