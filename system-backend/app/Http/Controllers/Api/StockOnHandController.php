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
        $canViewCost = $this->canViewCost($request);
        if (!$canViewCost) $rows = $this->stripCost($rows);

        return response()->json(['data' => [
            'rows' => $rows,
            'summary' => $this->summarize($rows, $canViewCost),
            'can_view_cost' => $canViewCost,
        ]]);
    }

    public function export(Request $request)
    {
        $rows = $this->rows($request);
        $canViewCost = $this->canViewCost($request);
        if (!$canViewCost) $rows = $this->stripCost($rows);
        return Excel::download(new StockOnHandExport($rows, $canViewCost), 'stock_on_hand_' . now()->format('Ymd_His') . '.xlsx');
    }

    // 🆕 แยกสิทธิ์ "เห็นราคาต้นทุน" ออกจาก "เห็นหน้าสินค้าคงเหลือ" (view_stock_on_hand) —
    // คนที่เข้าหน้านี้ได้ทุกคนเห็นจำนวนคงเหลือเหมือนเดิม แต่ต้องมี view_stock_cost เพิ่มถึงจะเห็นข้อมูลต้นทุน
    private function canViewCost(Request $request): bool
    {
        $user = $request->user();
        return $user->is_platform_admin || $user->isCompanyAdmin() || $user->can('view_stock_cost');
    }

    private function stripCost(Collection $rows): Collection
    {
        return $rows->map(function ($row) {
            $units = collect($row->units)->map(function ($unit) {
                unset($unit['unit_cost'], $unit['cost_value'], $unit['cost_is_estimated']);
                return $unit;
            })->values();

            $stripped = (array) $row;
            unset($stripped['total_cost_value'], $stripped['avg_unit_cost'], $stripped['has_estimated_cost']);
            $stripped['units'] = $units;

            return (object) $stripped;
        });
    }

    private function rows(Request $request): Collection
    {
        $companyId = auth()->user()->company_id;
        $warehouseId = $request->filled('warehouse_id') ? (int) $request->warehouse_id : null;
        $granularity = $request->input('granularity', 'all'); // all | serial | lot
        $search = trim((string) $request->input('search', ''));

        // 🆕 [2026-09-20] แสดงสินค้าทั้งระบบ (รวมสินค้าที่คงเหลือ 0) — ตัวกรอง stock_status: all | in_stock (มีสินค้า) | zero (สินค้าเป็น 0)
        // สินค้าบริการ (service) ไม่มีสต๊อกให้นับ จึงไม่แสดง
        $stockStatus = $request->input('stock_status', 'all');
        $productQuery = Product::where('company_id', $companyId)->where('product_type', '!=', 'service');
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
            ->orderBy('name')
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

        // 🆕 ของที่ "ติดยืม/จอง" — สินค้าคุม S/N: S/N สถานะ rented (ถูกเบิก/ยืม/จองอยู่ ไม่นับเป็นพร้อมขาย แต่ยังเป็นของเราอยู่);
        // สินค้าไม่คุม S/N: reserved_qty ในยอดคงเหลือ (เป็นส่วนหนึ่งของยอดคงเหลืออยู่แล้ว แสดงเป็นข้อมูลประกอบ)
        $heldSerialsByProduct = collect();
        if ($serialProductIds->isNotEmpty()) {
            $heldQuery = ProductSerial::whereIn('product_id', $serialProductIds)
                ->where('company_id', $companyId)
                ->where('status', 'rented')
                ->with(['rentedViaSaleDocument:id,document_number,document_type', 'warehouse:id,name']);
            if ($warehouseId) $heldQuery->where('warehouse_id', $warehouseId);
            $heldSerialsByProduct = $heldQuery->get()->groupBy('product_id');
        }
        $reservedByProduct = collect();
        if ($lotProductIds->isNotEmpty()) {
            $reservedQuery = \App\Models\StockBalance::whereIn('product_id', $lotProductIds)->where('company_id', $companyId);
            if ($warehouseId) $reservedQuery->where('warehouse_id', $warehouseId);
            $reservedByProduct = $reservedQuery->selectRaw('product_id, SUM(reserved_qty) as reserved')
                ->groupBy('product_id')->pluck('reserved', 'product_id');
        }

        return $products->map(function ($product) use ($serialsByProduct, $lotsByProduct, $heldSerialsByProduct, $reservedByProduct, $stockStatus) {
            $isSerial = (bool) $product->has_serial_number;
            $units = $isSerial
                ? $this->mapSerialUnits($serialsByProduct->get($product->id, collect()))
                : $this->mapLotUnits($lotsByProduct->get($product->id, collect()));

            $heldUnits = $isSerial
                ? $heldSerialsByProduct->get($product->id, collect())->map(fn ($s) => [
                    'serial_number' => $s->serial_number,
                    'warehouse' => $s->warehouse,
                    'reference_number' => $s->rentedViaSaleDocument->document_number ?? null,
                    'reference_type' => $s->rentedViaSaleDocument->document_type ?? null,
                    'rented_at' => $s->rented_at,
                ])->values()
                : collect();
            $heldQty = $isSerial ? $heldUnits->count() : (float) ($reservedByProduct[$product->id] ?? 0);

            $totalQty = $units->sum('qty');
            $hasStock = $totalQty > 0 || $heldQty > 0;
            if ($stockStatus === 'in_stock' && !$hasStock) return null;
            if ($stockStatus === 'zero' && $hasStock) return null;
            $totalCostValue = round($units->sum('cost_value'), 2);

            return (object) [
                'product' => $product,
                'granularity' => $isSerial ? 'serial' : 'lot',
                'total_qty' => $totalQty,
                'total_cost_value' => $totalCostValue,
                'avg_unit_cost' => $totalQty > 0 ? round($totalCostValue / $totalQty, 2) : 0,
                'unit_count' => $units->count(),
                // ติดยืม/จอง: สินค้าคุม S/N นับแยกจากคงเหลือ (ของที่ไม่ว่าง) — คงเหลือ 0 แต่ติดยืม N = ยังมีของ N ชิ้นแค่ไม่ว่าง
                'held_qty' => $heldQty,
                'held_units' => $heldUnits,
                'held_only' => $isSerial && $totalQty == 0 && $heldQty > 0,
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

    private function summarize(Collection $rows, bool $canViewCost = true): array
    {
        $summary = [
            'product_count' => $rows->count(),
            'unit_count' => $rows->sum('unit_count'),
            'held_qty' => $rows->sum('held_qty'),
            'total_qty' => $rows->sum('total_qty'),
            'total_sale_value' => round($rows->sum(fn ($r) => $r->total_qty * (float) $r->product->price), 2),
            'serial_product_count' => $rows->where('granularity', 'serial')->count(),
            'lot_product_count' => $rows->where('granularity', 'lot')->count(),
        ];

        if ($canViewCost) {
            $summary['total_cost_value'] = round($rows->sum('total_cost_value'), 2);
            $summary['estimated_cost_product_count'] = $rows->where('has_estimated_cost', true)->count();
        }

        return $summary;
    }
}
