<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Illuminate\Support\Facades\Log;

class ProductsImport implements WithMultipleSheets, SkipsUnknownSheets
{
    public function sheets(): array
    {
        return [
            // 🚀 อ่านชีทหน้าแรกซ้ายสุดเสมอ (รับประกันว่ามีแน่นอน 100%)
            0 => new MasterProductSheetImport(),

            // 🚀 อ่านชีท S/N (ถ้าพี่แม็คอัปโหลดไฟล์หน้าเดียว มันจะข้ามบรรทัดนี้ไปอย่างปลอดภัย ไม่พัง!)
            'Serial Numbers' => new MasterSerialSheetImport(),
        ];
    }

    public function onUnknownSheet($sheetName)
    {
        Log::info("นำเข้าสินค้าใหม่: ไม่มีชีทชื่อ " . $sheetName . " (ข้ามการทำงานอย่างปลอดภัย)");
    }
}
