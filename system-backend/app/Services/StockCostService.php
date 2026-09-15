<?php

namespace App\Services;

use App\Models\GoodsReceiptItem;
use App\Models\StockLot;
use Illuminate\Support\Collection;

// 🆕 รวมสูตร "ต้นทุนถัวเฉลี่ยของสินค้า" ที่เดิม copy-paste กันอยู่ 5 ที่ (ReportController, ProductController,
// DashboardController, InstallationEquipmentController) ไว้ที่เดียว — เปลี่ยนจากค่าเฉลี่ยถ่วงน้ำหนักทั้งประวัติ
// การรับสินค้า (ไม่เคยลดลงตามที่ขายออก) มาเป็นมูลค่าจริงจากล็อตที่ยังเหลืออยู่ (SUM(qty_remaining*unit_cost))
// ซึ่งถูกต้องกว่าและลดลงตามการขายจริงโดยอัตโนมัติ — สินค้าที่ยังไม่มีล็อตเลย (กรณีขอบ เช่น backfill ไม่ครอบคลุม)
// จึง fallback ไปสูตรเดิมแทน
class StockCostService
{
    /**
     * มูลค่าสต๊อกคงเหลือจริงจากล็อต ต่อสินค้า (รวมทุกคลัง หรือเฉพาะคลังที่ระบุ)
     * คืน Collection keyBy product_id: (object) ['qty'=>float, 'value'=>float, 'unit_cost'=>float]
     */
    public static function remainingByProduct(int $companyId, ?int $warehouseId = null): Collection
    {
        $query = StockLot::where('company_id', $companyId)->where('qty_remaining', '>', 0);
        if ($warehouseId) $query->where('warehouse_id', $warehouseId);

        return $query->selectRaw('product_id, SUM(qty_remaining) as total_qty, SUM(qty_remaining * unit_cost) as total_value')
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id')
            ->map(fn ($row) => (object) [
                'qty' => (float) $row->total_qty,
                'value' => round((float) $row->total_value, 2),
                'unit_cost' => (float) $row->total_qty > 0 ? round((float) $row->total_value / (float) $row->total_qty, 2) : 0.0,
            ]);
    }

    /**
     * ต้นทุนต่อหน่วยที่ใช้ในรายงาน: ใช้ค่าจากล็อตก่อน (สินค้าที่มีล็อต) ถ้าไม่มีล็อตเลยจึง fallback สูตรเดิม
     * คืน Collection keyBy product_id => float|null
     */
    public static function averageCostByProduct(int $companyId, ?array $productIds = null): Collection
    {
        $lotCosts = self::remainingByProduct($companyId)->map(fn ($row) => $row->unit_cost);
        $legacy = self::legacyReceiptAverageByProduct($companyId, $productIds);

        // 🛡️ ต้อง toBase() ก่อน merge — ทั้งสอง Collection นี้มาจาก Eloquent query (->get()->keyBy()->map())
        // แม้ item ข้างในจะถูก map เป็น float/null ไปแล้ว แต่ class ยังเป็น Eloquent Collection อยู่ ซึ่ง
        // merge() ของ Eloquent Collection จะเรียก $item->getKey() บน item ของฝั่งที่ส่งเข้ามาเสมอ (สมมติว่า
        // เป็น Model) พอ item เป็น float จริงจะพัง "Call to a member function getKey() on float" ทันทีที่
        // $lotCosts ไม่ว่างเปล่า (เจอจริงหลังรัน system:reset-data เพราะมี stock_lots ค้างอยู่) — toBase()
        // แปลงเป็น Illuminate\Support\Collection ธรรมดาก่อน ใช้ merge() แบบ array ปกติแทน
        return $legacy->toBase()->merge($lotCosts->toBase()); // ล็อตชนะเสมอถ้ามีข้อมูล (merge ทับด้วย key เดียวกัน)
    }

    public static function averageCostForProduct(int $productId, int $companyId): ?float
    {
        $lot = self::remainingByProduct($companyId)->get($productId);
        if ($lot) return $lot->unit_cost;

        return self::legacyReceiptAverageByProduct($companyId, [$productId])->get($productId);
    }

    /** สูตรเดิมเป๊ะ (goods_receipt_items ถัวเฉลี่ยทั้งประวัติ) — เก็บไว้เป็น fallback สำหรับสินค้าที่ไม่มีล็อตเลยเท่านั้น */
    public static function legacyReceiptAverageByProduct(int $companyId, ?array $productIds = null): Collection
    {
        $query = GoodsReceiptItem::whereHas('goodsReceipt', fn ($q) => $q->where('company_id', $companyId)->where('status', '!=', 'Cancelled'))
            ->whereNotNull('unit_price');
        if ($productIds !== null) $query->whereIn('product_id', $productIds);

        return $query->selectRaw('product_id, SUM(quantity * unit_price) as total_cost, SUM(quantity) as total_qty')
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id')
            ->map(fn ($row) => $row->total_qty > 0 ? round($row->total_cost / $row->total_qty, 2) : null);
    }
}
