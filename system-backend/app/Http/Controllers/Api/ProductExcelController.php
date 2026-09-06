<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\Warehouse;
use Maatwebsite\Excel\Facades\Excel;

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
        try {
            Excel::import(new \App\Imports\ProductsImport, $request->file('file'));
            return response()->json(['message' => 'นำเข้าสินค้าใหม่และสต็อกสำเร็จเรียบร้อย!']);
        } catch (\Exception $e) {
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
            $companyId = auth()->user()->company_id;
            $warehouseId = Warehouse::resolveFor($companyId, $request->input('warehouse_id'));

            Excel::import(new \App\Imports\InventoryImport($companyId, $warehouseId), $request->file('file'));
            return response()->json(['message' => 'ปรับปรุงสต็อกและอัปเดต S/N สำเร็จเรียบร้อย!']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }
}
