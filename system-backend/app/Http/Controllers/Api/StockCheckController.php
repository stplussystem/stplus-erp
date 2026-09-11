<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockBalance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockCheckController extends Controller
{
    // POST /api/stock-balances/check
    // เช็คสต๊อกแบบ bulk: รับรายการ product_id + จำนวนที่ต้องการ คืนยอดคงเหลือรวมทุกคลัง
    // และ breakdown รายคลังต่อสินค้า ใช้สำหรับปุ่ม "เช็คสินค้า" ในหน้าโครงการ (เทียบกับใบเสนอราคา)
    public function check(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1|max:200',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0',
        ]);

        $companyId = $request->user()->company_id;
        $productIds = collect($request->items)->pluck('product_id')->unique()->values();

        $totalsByProduct = StockBalance::whereIn('product_id', $productIds)
            ->where('company_id', $companyId)
            ->select('product_id', DB::raw('SUM(qty) as total_qty'))
            ->groupBy('product_id')
            ->pluck('total_qty', 'product_id');

        $balancesByProduct = StockBalance::whereIn('product_id', $productIds)
            ->where('company_id', $companyId)
            ->with('warehouse:id,name')
            ->get()
            ->groupBy('product_id');

        $products = Product::whereIn('id', $productIds)->get(['id', 'name', 'sku'])->keyBy('id');

        $result = collect($request->items)->map(function ($item) use ($totalsByProduct, $balancesByProduct, $products) {
            $productId = $item['product_id'];
            $requestedQty = (float) $item['quantity'];
            $availableQty = (float) ($totalsByProduct[$productId] ?? 0);

            return [
                'product_id' => $productId,
                'product_name' => $products[$productId]->name ?? null,
                'sku' => $products[$productId]->sku ?? null,
                'requested_qty' => $requestedQty,
                'available_qty' => $availableQty,
                'in_stock' => $availableQty >= $requestedQty,
                'shortfall_qty' => max(0, $requestedQty - $availableQty),
                'warehouses' => ($balancesByProduct[$productId] ?? collect())->map(fn ($balance) => [
                    'warehouse_id' => $balance->warehouse_id,
                    'warehouse_name' => $balance->warehouse?->name,
                    'qty' => $balance->qty,
                ])->values(),
            ];
        });

        return response()->json(['data' => $result]);
    }
}
