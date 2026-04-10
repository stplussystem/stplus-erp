<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\ProductSerial;
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
            'serials' => 'nullable|array', // รับค่าเป็น Array ของเลข S/N (เช่น ['SN001', 'SN002'])
        ]);

        // เริ่มต้นการทำงานแบบ Transaction (ถ้า Error กลางทาง ระบบจะ Rollback คืนค่าให้หมด)
        DB::beginTransaction();

        try {
            $product = Product::findOrFail($validated['product_id']);

            // 1. สร้างประวัติความเคลื่อนไหวสต็อก
            $movement = StockMovement::create([
                'product_id' => $product->id,
                'type' => $validated['type'],
                'quantity' => $validated['quantity'],
                'reference_number' => $validated['reference_number'],
                'note' => $validated['note'],
                'user_id' => 1, // Mock ไว้ก่อน (อนาคตดึงจากคนที่ Login)
            ]);

            // 2. จัดการเรื่อง Serial Number (ถ้าสินค้านั้นบังคับให้เก็บ S/N)
            if ($product->has_serial_number && !empty($validated['serials'])) {

                if ($validated['type'] === 'in') {
                    // กรณี "รับเข้า": สร้าง S/N ใหม่เข้าคลัง
                    foreach ($validated['serials'] as $sn) {
                        ProductSerial::create([
                            'company_id' => 1,
                            'product_id' => $product->id,
                            'serial_number' => $sn,
                            'status' => 'available', // สถานะ: พร้อมขาย
                            'stock_movement_id' => $movement->id
                        ]);
                    }
                } elseif ($validated['type'] === 'out') {
                    // กรณี "เบิกออก": เปลี่ยนสถานะ S/N นั้นเป็น "ขายแล้ว/เบิกแล้ว"
                    ProductSerial::whereIn('serial_number', $validated['serials'])
                        ->where('product_id', $product->id)
                        ->update(['status' => 'sold']);
                }
            }

            DB::commit(); // ยืนยันการบันทึกข้อมูลทั้งหมด

            return response()->json([
                'message' => 'บันทึกการทำรายการสต็อกสำเร็จ!',
                'data' => $movement
            ]);
        } catch (\Exception $e) {
            DB::rollBack(); // ถ้ายิงบาร์โค้ดซ้ำ หรือเกิด Error ให้ยกเลิกการบันทึกทั้งหมด
            return response()->json([
                'message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()
            ], 500);
        }
    }
}
