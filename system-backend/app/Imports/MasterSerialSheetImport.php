<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToArray;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use App\Models\Product;
use App\Models\ProductSerial; // 🚀 แก้เส้นแดงตรงนี้ครับ!
use App\Models\StockBalance;
use App\Models\StockMovement;

class MasterSerialSheetImport implements ToArray, WithStartRow, WithChunkReading
{
    public function startRow(): int
    {
        return 2;
    }
    public function chunkSize(): int
    {
        return 300;
    }

    public function array(array $rows)
    {
        $companyId = auth()->user()->company_id ?? 1;
        $defaultWarehouse = \App\Models\Warehouse::firstOrCreate(
            ['company_id' => $companyId],
            ['name' => 'คลังสินค้าหลัก (Default)']
        );

        foreach ($rows as $row) {
            $row = is_array($row) ? $row : [];
            $row = array_pad($row, 10, '');

            $sku = trim((string)$row[1]);
            $sn = trim((string)$row[2]);
            $status = trim((string)$row[3]);
            if ($status === '') $status = 'พร้อมขาย';

            if ($sn === '' || $sku === '') continue;

            $product = Product::where('sku', $sku)->first();
            if (!$product || !$product->has_serial_number) continue;

            $exists = ProductSerial::where('serial_number', $sn)->exists();

            if (!$exists && $status === 'พร้อมขาย') {
                $movement = StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => auth()->id() ?? 1,
                    'type' => 'in',
                    'quantity' => 1,
                    'reference_number' => 'IMP-SN-' . date('Ymd-His') . '-' . $sn,
                    'note' => "รับเข้า S/N ใหม่ ($sn)"
                ]);

                ProductSerial::create([
                    'company_id' => $companyId,
                    'product_id' => $product->id,
                    'serial_number' => $sn,
                    'status' => 'available',
                    'stock_movement_id' => $movement->id,
                ]);

                $balance = StockBalance::firstOrCreate(
                    ['product_id' => $product->id, 'company_id' => $companyId, 'warehouse_id' => $defaultWarehouse->id],
                    ['qty' => 0]
                );
                $balance->increment('qty', 1);
            }
        }
    }
}
