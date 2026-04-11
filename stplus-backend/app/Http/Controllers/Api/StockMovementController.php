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

        DB::beginTransaction();

        try {
            $product = Product::findOrFail($validated['product_id']);

            // 1. บันทึกประวัติการเคลื่อนไหว
            $movement = StockMovement::create([
                'product_id' => $product->id,
                'type' => $validated['type'],
                'quantity' => $validated['quantity'],
                'reference_number' => $validated['reference_number'],
                'note' => $validated['note'],
                'user_id' => 1,
            ]);

            // 2. อัปเดตยอดคงเหลือในตาราง stock_balances
           $balance = StockBalance::where('product_id', $product->id)->first();
            $change = ($validated['type'] === 'in') ? $validated['quantity'] : -$validated['quantity'];

            if ($balance) {
                $balance->increment('qty', $change);
            } else {
                StockBalance::create([
                    'company_id' => 1, // 👈 ส่งค่า ID บริษัทไปด้วย
                    'warehouse_id' => 1,
                    'product_id' => $product->id,
                    'qty' => $validated['quantity'],
                ]);
            }

            // 💡 3. บันทึก Serial Number ลงตาราง product_serials
            if ($product->has_serial_number && !empty($validated['serials'])) {
                foreach ($validated['serials'] as $sn) {
                    ProductSerial::create([
                        'company_id' => 1, // 👈 เติมจุดนี้เพื่อแก้ Error 1364
                        'product_id' => $product->id,
                        'serial_number' => $sn,
                        'status' => ($validated['type'] === 'in') ? 'available' : 'sold',
                        'stock_movement_id' => $movement->id,
                    ]);
                }
            }

            DB::commit();
            return response()->json(['message' => 'บันทึกสำเร็จ!', 'data' => $movement]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }
}
