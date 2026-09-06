<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToArray;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockMovement;

class MasterProductSheetImport implements ToArray, WithStartRow, WithChunkReading
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
        // 🚀 ดึงไอดีบริษัท และเตรียมคลังสินค้า
        $companyId = auth()->user()->company_id ?? 1;
        $defaultWarehouse = \App\Models\Warehouse::firstOrCreate(
            ['company_id' => $companyId],
            ['name' => 'คลังสินค้าหลัก (Default)']
        );

        // 🚀 เอา $vatMap กลับมา (ระบบจะได้หาเจอ)
        $vatMap = [
            '7%' => '7',
            '0%' => '0',
            'ยกเว้น' => 'exempt'
        ];

        foreach ($rows as $index => $row) {
            try {
                $row = is_array($row) ? $row : [];
                $row = array_pad($row, 20, '');

                $sku = trim((string)$row[2]);
                $name = trim((string)$row[4]);

                // ข้ามแถวที่ไม่มี SKU หรือ ชื่อสินค้า
                if ($sku === '' || $name === '') continue;

                // ==========================================
                // 🚀 ย้ายการเช็คหมวดหมู่มาไว้ใน Loop!
                // ==========================================
                $rawType = trim((string)$row[1]);
                $productType = 'inventory'; // ค่าเริ่มต้น
                $canSell = true;
                $canRent = false;
                $isInstallJob = false;

                if ($rawType === 'สินค้าสำหรับเช่า') {
                    $productType = 'inventory';
                    $canSell = false;
                    $canRent = true;
                } elseif ($rawType === 'สินค้าสำหรับงานติดตั้ง') {
                    $productType = 'inventory';
                    $canSell = false;
                    $isInstallJob = true;
                } elseif ($rawType === 'บริการ') {
                    $productType = 'service';
                    $canSell = true;
                }
                // ==========================================

                $rawVat = trim((string)$row[9]);
                $vatType = array_key_exists($rawVat, $vatMap) ? $vatMap[$rawVat] : (in_array($rawVat, $vatMap) ? $rawVat : '0');

                $hasSnStr = trim((string)$row[12]);
                $hasSn = ($hasSnStr === 'มี' || $hasSnStr === '1');

                // 🚀 สร้างสินค้า
                $product = Product::updateOrCreate(
                    ['sku' => $sku],
                    [
                        'company_id' => $companyId,
                        'product_type' => $productType,
                        'can_sell' => $canSell,
                        'can_rent' => $canRent,
                        'is_install_job' => $isInstallJob,
                        'barcode' => trim((string)$row[3]),
                        'name' => $name,
                        'category_id' => $this->getId(\App\Models\ProductCategory::class, $row[5], $companyId),
                        'brand_id' => $this->getId(\App\Models\Brand::class, $row[6], $companyId),
                        'model_name' => trim((string)$row[7]),
                        'price' => (float)$row[8],
                        'vat_type' => $vatType,
                        'unit_id' => $this->getId(\App\Models\Unit::class, $row[10], $companyId),
                        'low_stock_threshold' => (int)$row[11],
                        'has_serial_number' => $hasSn,
                        'is_active' => 1
                    ]
                );

                $startQty = (int)$row[13];
                // 🚀 ถ้ายกมามีสต็อก และไม่มี S/N ให้เติมสต็อกเข้าคลังเลย
                if (!$hasSn && $startQty > 0) {
                    $balance = StockBalance::firstOrCreate(
                        ['product_id' => $product->id, 'company_id' => $companyId, 'warehouse_id' => $defaultWarehouse->id],
                        ['qty' => 0]
                    );

                    if ($balance->qty == 0) {
                        StockMovement::create([
                            'product_id' => $product->id,
                            'user_id' => auth()->id() ?? 1,
                            'type' => 'in',
                            'quantity' => $startQty,
                            'reference_number' => 'IMP-' . date('Ymd-His') . '-' . $sku,
                            'note' => 'ยอดยกมาจากการอัปโหลดสินค้าใหม่'
                        ]);
                        $balance->qty = $startQty;
                        $balance->save();
                    }
                }
            } catch (\Exception $e) {
                throw new \Exception("พังที่แถว " . ($index + 2) . " SKU [{$sku}]: " . $e->getMessage());
            }
        }
    }

    private function getId($modelClass, $name, $companyId)
    {
        $name = trim((string)$name);
        if (!$name || $name === '-' || !class_exists($modelClass)) return null;
        return $modelClass::firstOrCreate(
            ['name' => $name, 'company_id' => $companyId],
            ['company_id' => $companyId]
        )->id;
    }
}
