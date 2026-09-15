<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductSerial;
use App\Models\StockLot;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\StockOnHandExport;

// 🆕 หน้า "สินค้าคงเหลือ" — แยกรายชิ้นตาม S/N สำหรับสินค้าที่คุม S/N (has_serial_number=true) และแยกรายล็อต
// ที่รับเข้าสำหรับสินค้าที่ไม่คุม S/N (ตามที่ผู้ใช้เลือกไว้ตอนวางแผน — สมมาตรกับสินค้าคุม S/N ที่ 1 แถวต่อ
// 1 หน่วยจริงอยู่แล้ว) พร้อมต้นทุนจริงจากชั้นข้อมูลล็อต (StockLot) แยกจาก ReportController เพราะอยู่คนละ
// หมวดเมนู ("คลังสินค้า" ไม่ใช่ "รายงาน") และ ReportController ยาวเกิน 1000 บรรทัดแล้ว
class StockOnHandController extends Controller
{
    // GET /api/stock-on-hand?search=&category_id=&warehouse_id=&granularity=all|serial|lot
    public function index(Request $request)
    {
        $rows = $this->rows($request);

        return response()->json(['data' => [
            'rows' => $rows,
            'summary' => $this->summarize($rows),
        ]]);
    }

    public function export(Request $request)
    {
        $rows = $this->rows($request);
        return Excel::download(new StockOnHandExport($rows), 'stock_on_hand_' . now()->format('Ymd_His') . '.xlsx');
    }

    private function rows(Request $request): Collection
    {
        $companyId = auth()->user()->company_id;
        $warehouseId = $request->filled('warehouse_id') ? (int) $request->warehouse_id : null;
        $granularity = $request->input('granularity', 'all'); // all | serial | lot
        $search = trim((string) $request->input('search', ''));

        $productQuery = Product::where('company_id', $companyId);
        if ($request->filled('category_id')) $productQuery->where('category_id', $request->category_id);
        if ($granularity === 'serial') $productQuery->where('has_serial_number', true);
        if ($granularity === 'lot') $productQuery->where('has_serial_number', false);

        if ($search !== '') {
            $productQuery->where(function ($q) use ($search) {
                $q->where('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('model_name', 'like', "%{$search}%")
                    ->orWhereHas('serials', fn ($sq) => $sq->where('serial_number', 'like', "%{$search}%"));
            });
        }

        $products = $productQuery->with('category:id,name')
            ->get(['id', 'name', 'sku', 'price', 'category_id', 'has_serial_number']);

        if ($products->isEmpty()) return collect();

        $serialProductIds = $products->where('has_serial_number', true)->pluck('id');
        $lotProductIds = $products->where('has_serial_number', false)->pluck('id');

        $serialsByProduct = collect();
        if ($serialProductIds->isNotEmpty()) {
            $serialQuery = ProductSerial::whereIn('product_id', $serialProductIds)
                ->where('company_id', $companyId)
                ->where('status', 'available')
                ->with(['stockLot:id,unit_cost,received_at,reference_number,source_type,cost_is_estimated', 'warehouse:id,name']);
            if ($warehouseId) $serialQuery->where('warehouse_id', $warehouseId);

            $serialsByProduct = $serialQuery->get()
                ->sortBy(fn ($s) => optional($s->stockLot)->received_at ?? $s->created_at)
                ->groupBy('product_id');
        }

        $lotsByProduct = collect();
        if ($lotProductIds->isNotEmpty()) {
            $lotQuery = StockLot::whereIn('product_id', $lotProductIds)
                ->where('company_id', $companyId)
                ->where('qty_remaining', '>', 0)
                ->with('warehouse:id,name');
            if ($warehouseId) $lotQuery->where('warehouse_id', $warehouseId);

            $lotsByProduct = $lotQuery->orderBy('received_at')->orderBy('id')->get()->groupBy('product_id');
        }

        return $products->map(function ($product) use ($serialsByProduct, $lotsByProduct) {
            $isSerial = (bool) $product->has_serial_number;
            $units = $isSerial
                ? $this->mapSerialUnits($serialsByProduct->get($product->id, collect()))
                : $this->mapLotUnits($lotsByProduct->get($product->id, collect()));

            if ($units->isEmpty()) return null;

            $totalQty = $units->sum('qty');
            $totalCostValue = round($units->sum('cost_value'), 2);

            return (object) [
                'product' => $product,
                'granularity' => $isSerial ? 'serial' : 'lot',
                'total_qty' => $totalQty,
                'total_cost_value' => $totalCostValue,
                'avg_unit_cost' => $totalQty > 0 ? round($totalCostValue / $totalQty, 2) : 0,
                'unit_count' => $units->count(),
                'has_estimated_cost' => $units->contains(fn ($u) => $u['cost_is_estimated']),
                'units' => $units->values(),
            ];
        })->filter()->values();
    }

    private function mapSerialUnits(Collection $serials): Collection
    {
        return $serials->map(fn ($s) => [
            'kind' => 'serial',
            'serial_id' => $s->id,
            'serial_number' => $s->serial_number,
            'qty' => 1,
            'warehouse' => $s->warehouse,
            'stock_lot_id' => $s->stock_lot_id,
            'unit_cost' => (float) ($s->stockLot->unit_cost ?? 0),
            'cost_value' => (float) ($s->stockLot->unit_cost ?? 0),
            'received_at' => $s->stockLot->received_at ?? $s->created_at,
            'source_type' => $s->stockLot->source_type ?? null,
            'reference_number' => $s->stockLot->reference_number ?? null,
            'cost_is_estimated' => (bool) ($s->stockLot->cost_is_estimated ?? false),
        ]);
    }

    private function mapLotUnits(Collection $lots): Collection
    {
        return $lots->map(fn ($lot) => [
            'kind' => 'lot',
            'stock_lot_id' => $lot->id,
            'lot_label' => "ล็อต #{$lot->id}",
            'warehouse' => $lot->warehouse,
            'qty' => (float) $lot->qty_remaining,
            'qty_remaining' => (float) $lot->qty_remaining,
            'qty_received' => (float) $lot->qty_received,
            'unit_cost' => (float) $lot->unit_cost,
            'cost_value' => round((float) $lot->qty_remaining * (float) $lot->unit_cost, 2),
            'received_at' => $lot->received_at,
            'source_type' => $lot->source_type,
            'reference_number' => $lot->reference_number,
            'cost_is_estimated' => (bool) $lot->cost_is_estimated,
        ]);
    }

    private function summarize(Collection $rows): array
    {
        return [
            'product_count' => $rows->count(),
            'unit_count' => $rows->sum('unit_count'),
            'total_qty' => $rows->sum('total_qty'),
            'total_cost_value' => round($rows->sum('total_cost_value'), 2),
            'total_sale_value' => round($rows->sum(fn ($r) => $r->total_qty * (float) $r->product->price), 2),
            'serial_product_count' => $rows->where('granularity', 'serial')->count(),
            'lot_product_count' => $rows->where('granularity', 'lot')->count(),
            'estimated_cost_product_count' => $rows->where('has_estimated_cost', true)->count(),
        ];
    }
}
