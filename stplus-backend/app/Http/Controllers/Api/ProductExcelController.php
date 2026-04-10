<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\ProductsExport;
use App\Imports\ProductsImport;

class ProductExcelController extends Controller
{
    // 1. ฟังก์ชันส่งออกข้อมูลทั้งหมดเป็น Excel
    public function export()
    {
        return Excel::download(new ProductsExport, 'products.xlsx');
    }

    // 2. ฟังก์ชันดาวน์โหลด Template
    public function template()
    {
        return Excel::download(new ProductsExport, 'product_template.xlsx');
    }

    // 3. ฟังก์ชันรับไฟล์อัปโหลดและบันทึกลง Database
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv|max:5120', // จำกัดขนาด 5MB
        ]);

        try {
            Excel::import(new ProductsImport, $request->file('file'));
            return response()->json(['message' => 'นำเข้าข้อมูลสินค้าสำเร็จ!']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()], 500);
        }
    }
}
