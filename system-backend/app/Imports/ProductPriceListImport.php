<?php

namespace App\Imports;

use App\Models\Product;
use App\Models\ProductPriceList;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

// 🆕 อ่านไฟล์ Price List กลับเข้าระบบ — ทั้งไฟล์เป็นราคาของผู้จำหน่ายรายเดียว ($vendorId ที่เลือกไว้ก่อนอัปโหลด
// ไม่ใช่คอลัมน์ในไฟล์) 1 แถวต่อ 1 สินค้า เขียนทับแถวราคาเดิมของ (สินค้า, ผู้จำหน่ายนี้) ในที่ ไม่สร้างประวัติ —
// คอลัมน์ "สถานะ" ถ้ากรอกมาจะ override การคำนวณเทรนด์อัตโนมัติใน ProductPriceList::applyUpdate()
// ช่องราคาว่าง = ข้ามแถวนั้นไปเฉย (ไม่แตะข้อมูลเดิม) — ไม่ต้องกรอกครบทุกสินค้าในไฟล์
class ProductPriceListImport implements ToCollection, WithStartRow, WithChunkReading
{
    private int $companyId;
    private int $vendorId;
    private ?int $importBatchId;

    public int $processedCount = 0;
    public int $skippedNotFoundCount = 0;
    public array $errors = [];

    public function __construct(int $companyId, int $vendorId, ?int $importBatchId = null)
    {
        $this->companyId = $companyId;
        $this->vendorId = $vendorId;
        $this->importBatchId = $importBatchId;
    }

    public function startRow(): int
    {
        return 2;
    }

    public function chunkSize(): int
    {
        return 300;
    }

    public function collection(Collection $rows)
    {
        foreach ($rows as $row) {
            $productId = trim((string) ($row[0] ?? ''));
            if ($productId === '') continue;

            $rawPrice = trim((string) ($row[4] ?? ''));
            if ($rawPrice === '' || !is_numeric($rawPrice)) continue; // ว่าง = ข้าม ไม่แตะข้อมูลเดิม

            $product = Product::where('id', $productId)->where('company_id', $this->companyId)->first();
            if (!$product) {
                $this->skippedNotFoundCount++;
                continue;
            }

            $statusLabel = trim((string) ($row[3] ?? ''));
            $rawDiscount = trim((string) ($row[5] ?? ''));

            ProductPriceList::applyUpdate([
                'company_id' => $this->companyId,
                'product_id' => $product->id,
                'contact_id' => $this->vendorId,
                'price' => (float) $rawPrice,
                'discount_percent' => $this->normalizeDiscountPercent($rawDiscount),
                'price_trend' => $this->trendFromLabel($statusLabel),
                'expiry_date' => $this->parseDate($row[7] ?? null),
                'import_batch_id' => $this->importBatchId,
            ]);

            $this->processedCount++;
        }
    }

    // 🛡️ ถ้าผู้กรอกพิมพ์ "30%" ลงในเซลล์ตรงๆ Excel จะเปลี่ยน number format ของเซลล์นั้นเป็น Percentage
    // อัตโนมัติแล้วเก็บค่าจริงเป็นเศษส่วน (0.3) ให้ทันที — ค่าที่ PhpSpreadsheet คำนวณออกมาให้เราจึงเป็น 0.3
    // ไม่ใช่ 30 ทั้งที่ผู้ใช้ตั้งใจกรอก 30% — ส่วนลดในธุรกิจจริงแทบไม่มีกรณีต่ำกว่า 1% เลย จึงตีความค่าที่ตกอยู่
    // ในช่วง (0, 1) ว่ามาจากเซลล์ percentage แบบนี้เสมอ แล้วคูณ 100 กลับให้ตรงกับที่ผู้ใช้ตั้งใจกรอก
    private function normalizeDiscountPercent(string $raw): ?float
    {
        if ($raw === '' || !is_numeric($raw)) return null;

        $value = (float) $raw;
        if ($value > 0 && $value < 1) {
            $value *= 100;
        }

        return round($value, 2);
    }

    private function trendFromLabel(string $label): ?string
    {
        return match ($label) {
            'ราคาขึ้น' => 'up',
            'ราคาลง' => 'down',
            'ราคาคงที่' => 'stable',
            default => null, // ว่าง/ไม่ตรง dropdown เลย = ให้ระบบคำนวณเทรนด์อัตโนมัติเอง
        };
    }

    private function parseDate($raw): ?string
    {
        $raw = trim((string) ($raw ?? ''));
        if ($raw === '') return null;

        if (is_numeric($raw)) {
            try {
                return ExcelDate::excelToDateTimeObject((float) $raw)->format('Y-m-d');
            } catch (\Throwable $e) {
                return null;
            }
        }

        foreach (['d/m/Y', 'Y-m-d'] as $format) {
            try {
                return Carbon::createFromFormat($format, $raw)->format('Y-m-d');
            } catch (\Throwable $e) {
                continue;
            }
        }

        try {
            return Carbon::parse($raw)->format('Y-m-d');
        } catch (\Throwable $e) {
            return null;
        }
    }
}
