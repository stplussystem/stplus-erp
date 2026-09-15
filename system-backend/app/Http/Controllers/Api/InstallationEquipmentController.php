<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InstallationEquipmentItem;
use App\Models\Project;
use App\Models\SaleDocumentItem;
use Illuminate\Http\Request;

// 🚀 อุปกรณ์ที่เลือกไว้ "จะนำไปติดตั้ง" ต่อโครงการ — เก็บเป็นข้อมูลอ้างอิงเพื่อสรุปต้นทุนเท่านั้น (ตามที่ยืนยันไว้ตอนวางแผน)
// ไม่ตัดสต๊อก ไม่ผูกกับ StockMovement ใดๆ ต่างจาก InstallationRecord ที่ผูก S/N จริง
class InstallationEquipmentController extends Controller
{
    // GET /api/projects/{id}/installation-equipment-items
    public function index($projectId)
    {
        $items = InstallationEquipmentItem::where('project_id', $projectId)
            ->with(['product:id,name,sku', 'saleDocumentItem:id,product_id', 'creator:id,name'])
            ->latest()
            ->get();

        return response()->json(['data' => $items]);
    }

    // POST /api/installation-equipment-items — บันทึกรายการอุปกรณ์ที่เลือกไว้ (หลายรายการพร้อมกัน)
    public function store(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'sale_document_item_id' => 'nullable|exists:sale_document_items,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.location' => 'nullable|string|max:255',
        ]);

        $companyId = auth()->user()->company_id;
        $project = Project::findOrFail($request->project_id);

        // 🛡️ ถ้าระบุ sale_document_item_id มา ต้องเป็นแถวบริการของโครงการเดียวกันเท่านั้น (กันเลือกข้ามโครงการผิดที่)
        if ($request->sale_document_item_id) {
            $item = SaleDocumentItem::with('saleDocument')->findOrFail($request->sale_document_item_id);
            if ((int) $item->saleDocument->project_id !== (int) $request->project_id) {
                return response()->json(['message' => 'รายการอ้างอิงไม่ตรงกับโครงการนี้'], 422);
            }
        }

        // 🆕 ต้นทุนต่อสินค้า — อ่านจากมูลค่าล็อตคงเหลือจริง (StockCostService) แทนค่าเฉลี่ยทั้งประวัติแบบเดิม
        // (สแนปช็อตต้นทุนไว้เฉยๆ ไม่ตัดสต๊อก/ล็อตใดๆ ที่นี่ — ดู class-level comment ด้านบน)
        $productIds = collect($request->items)->pluck('product_id')->unique();
        $avgCostByProduct = \App\Services\StockCostService::averageCostByProduct($companyId, $productIds->all());

        $created = collect($request->items)->map(function ($row) use ($request, $companyId, $avgCostByProduct) {
            return InstallationEquipmentItem::create([
                'company_id' => $companyId,
                'project_id' => $request->project_id,
                'sale_document_item_id' => $request->sale_document_item_id,
                'product_id' => $row['product_id'],
                'quantity' => $row['quantity'],
                'location' => $row['location'] ?? null,
                'unit_cost_snapshot' => $avgCostByProduct[$row['product_id']] ?? null,
                'created_by' => auth()->id(),
            ]);
        });

        return response()->json([
            'message' => 'บันทึกรายการอุปกรณ์สำเร็จ',
            // 🐛 $created เป็น base Collection (มาจาก ->map()) ไม่ใช่ Eloquent Collection จึงไม่มี ->load() ต้องวนโหลดทีละตัวแทน
            'data' => $created->each->load('product:id,name,sku'),
        ], 201);
    }

    // DELETE /api/installation-equipment-items/{id}
    public function destroy($id)
    {
        $item = InstallationEquipmentItem::findOrFail($id);
        $item->delete();

        return response()->json(['message' => 'ลบรายการอุปกรณ์สำเร็จ']);
    }
}
