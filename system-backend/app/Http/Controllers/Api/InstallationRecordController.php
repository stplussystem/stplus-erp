<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InstallationRecord;
use App\Models\Product;
use App\Models\SaleDocumentItem;
use App\Services\DocumentService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class InstallationRecordController extends Controller
{
    private const STATUS_TRANSITIONS = [
        'scheduled' => ['installed', 'cancelled'],
        'installed' => [],
        'cancelled' => [],
    ];

    // เอกสารขายที่ตัดสต๊อกออกจริง — สำเนามาจาก RepairTicketController::STOCK_OUT_DOC_TYPES ตามแพทเทิร์นเดิมที่ไม่แยก shared const
    private const STOCK_OUT_DOC_TYPES = ['tax_invoice', 'cash', 'receipt'];

    public function index(Request $request)
    {
        $query = InstallationRecord::with(['project:id,name', 'contact:id,business_name', 'product:id,name,sku'])
            ->where('company_id', auth()->user()->company_id);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }
        if ($request->filled('contact_id')) {
            $query->where('contact_id', $request->contact_id);
        }
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('installation_number', 'like', "%{$q}%")
                    ->orWhereHas('contact', function ($c) use ($q) {
                        $c->where('business_name', 'like', "%{$q}%")->orWhere('contact_person_name', 'like', "%{$q}%");
                    });
            });
        }

        return response()->json($query->latest()->paginate(20));
    }

    public function show($id)
    {
        $record = InstallationRecord::with([
            'project', 'contact', 'saleDocumentItem.saleDocument', 'product', 'productSerial', 'creator', 'installer',
        ])->find($id);

        if (!$record) {
            return response()->json(['message' => 'ไม่พบข้อมูลงานติดตั้ง'], 404);
        }
        if (!auth()->user()->is_platform_admin && $record->company_id !== auth()->user()->company_id) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์เข้าถึงงานติดตั้งนี้'], 403);
        }

        return response()->json(['data' => $record]);
    }

    // GET /api/projects/{id}/installable-items — รายการในโครงการนี้ที่เกี่ยวกับงานติดตั้ง แบ่ง 2 ประเภทในผลลัพธ์เดียว:
    // item_type='equipment' = อุปกรณ์กายภาพที่ต้องติดตั้ง (is_install_job=true, ยังติดตั้งได้อีก)
    // item_type='service'   = แถว "ค่าติดตั้ง" (product_type=service) ไม่มี logic ตัดยอด/S/N เพราะไม่ใช่อุปกรณ์กายภาพ
    // แสดงเสมอ 1 ครั้งต่อ line item ใช้เป็นจุดเปิดหน้า "เลือกอุปกรณ์ที่นำไปติดตั้ง" ที่ frontend
    public function installableItems($projectId)
    {
        $companyId = auth()->user()->company_id;

        $items = SaleDocumentItem::query()
            ->join('sale_documents', 'sale_documents.id', '=', 'sale_document_items.sale_document_id')
            ->join('products', 'products.id', '=', 'sale_document_items.product_id')
            ->where('sale_documents.project_id', $projectId)
            ->where('sale_documents.company_id', $companyId)
            ->whereIn('sale_documents.document_type', self::STOCK_OUT_DOC_TYPES)
            ->where('sale_documents.status', 'Approved')
            ->where(function ($q) {
                $q->where('products.is_install_job', true)->orWhere('products.product_type', 'service');
            })
            ->select('sale_document_items.*')
            ->with([
                'product:id,name,sku,has_serial_number,is_install_job,product_type',
                'saleDocument:id,document_number,document_type,contact_id',
                'saleDocument.contact:id,business_name,address',
                'serials:id,serial_number,status',
            ])
            ->get();

        if ($items->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $itemIds = $items->pluck('id');

        $installedSerialIds = InstallationRecord::whereIn('sale_document_item_id', $itemIds)
            ->where('status', '!=', 'cancelled')
            ->pluck('product_serial_id')
            ->filter();

        $installedQtyByItem = InstallationRecord::whereIn('sale_document_item_id', $itemIds)
            ->where('status', '!=', 'cancelled')
            ->selectRaw('sale_document_item_id, SUM(quantity) as qty')
            ->groupBy('sale_document_item_id')
            ->pluck('qty', 'sale_document_item_id');

        $result = $items->map(function ($item) use ($installedSerialIds, $installedQtyByItem) {
            $isServiceRow = !$item->product->is_install_job && $item->product->product_type === 'service';
            $item->item_type = $isServiceRow ? 'service' : 'equipment';

            if ($isServiceRow) {
                $item->available_serials = null;
                $item->remaining_quantity = null;
                return $item;
            }

            $hasSerial = (bool) $item->product->has_serial_number;
            $item->available_serials = $hasSerial
                ? $item->serials->reject(fn ($s) => $installedSerialIds->contains($s->id))->values()
                : null;
            $item->remaining_quantity = $hasSerial
                ? null
                : ((float) $item->quantity - (float) ($installedQtyByItem[$item->id] ?? 0));
            return $item;
        })->filter(function ($item) {
            if ($item->item_type === 'service') {
                return true; // แถวบริการแสดงเสมอ ไม่มี logic ตัดยอด
            }
            $hasSerial = (bool) $item->product->has_serial_number;
            return $hasSerial ? $item->available_serials->isNotEmpty() : $item->remaining_quantity > 0;
        })->values();

        return response()->json(['data' => $result]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'sale_document_item_id' => 'required|exists:sale_document_items,id',
            'product_serial_id' => 'nullable|exists:product_serials,id',
            'quantity' => 'nullable|numeric|min:0.01',
            'site_name' => 'nullable|string|max:150',
            'site_address' => 'nullable|string',
            'room_location' => 'nullable|string|max:150',
            'install_notes' => 'nullable|string',
            'warranty_months' => 'nullable|integer|min:0|max:600',
            'scheduled_at' => 'nullable|date',
            'installed_at' => 'nullable|date',
        ]);

        $item = SaleDocumentItem::with(['saleDocument', 'product'])->findOrFail($request->sale_document_item_id);
        $doc = $item->saleDocument;
        $companyId = auth()->user()->company_id;

        if ($doc->company_id !== $companyId || (int) $doc->project_id !== (int) $request->project_id) {
            return response()->json(['message' => 'รายการสินค้าไม่ตรงกับโครงการนี้'], 422);
        }
        if (!in_array($doc->document_type, self::STOCK_OUT_DOC_TYPES) || $doc->status !== 'Approved') {
            return response()->json(['message' => 'เอกสารอ้างอิงต้องเป็นเอกสารขายที่อนุมัติแล้วเท่านั้น'], 422);
        }
        if (!$item->product->is_install_job) {
            return response()->json(['message' => 'สินค้านี้ไม่ได้ถูกตั้งค่าให้เป็นงานติดตั้ง'], 422);
        }

        $hasSerial = (bool) $item->product->has_serial_number;
        $quantity = $hasSerial ? 1 : ($request->quantity ?? 1);

        if ($hasSerial) {
            if (!$request->product_serial_id) {
                return response()->json(['message' => 'สินค้านี้คุม S/N กรุณาระบุ Serial Number ที่ติดตั้ง'], 422);
            }
            $alreadyInstalled = InstallationRecord::where('product_serial_id', $request->product_serial_id)
                ->where('status', '!=', 'cancelled')
                ->exists();
            if ($alreadyInstalled) {
                return response()->json(['message' => 'S/N นี้ถูกบันทึกการติดตั้งไปแล้ว'], 422);
            }
        } else {
            $installedQty = InstallationRecord::where('sale_document_item_id', $item->id)
                ->where('status', '!=', 'cancelled')
                ->sum('quantity');
            if ($installedQty + $quantity > $item->quantity) {
                return response()->json(['message' => 'จำนวนที่ต้องการติดตั้งเกินยอดคงเหลือของรายการนี้'], 422);
            }
        }

        $status = 'scheduled';
        $installedAt = null;
        $warrantyExpiresAt = null;

        if ($request->filled('installed_at') && Carbon::parse($request->installed_at)->lte(now())) {
            $status = 'installed';
            $installedAt = $request->installed_at;
            if ($request->warranty_months) {
                $warrantyExpiresAt = Carbon::parse($installedAt)->addMonths($request->warranty_months)->format('Y-m-d');
            }
        }

        $record = InstallationRecord::create([
            'company_id' => $companyId,
            'installation_number' => DocumentService::generate('installation_record', $companyId),
            'project_id' => $request->project_id,
            'contact_id' => $doc->contact_id,
            'sale_document_item_id' => $item->id,
            'product_id' => $item->product_id,
            'product_serial_id' => $request->product_serial_id,
            'quantity' => $quantity,
            'site_name' => $request->site_name,
            'site_address' => $request->site_address,
            'room_location' => $request->room_location,
            'install_notes' => $request->install_notes,
            'status' => $status,
            'warranty_months' => $request->warranty_months,
            'warranty_expires_at' => $warrantyExpiresAt,
            'scheduled_at' => $status === 'scheduled' ? $request->scheduled_at : null,
            'installed_at' => $installedAt,
            'created_by' => auth()->id(),
        ]);

        return response()->json([
            'message' => 'บันทึกการติดตั้งสำเร็จ',
            'data' => $record->load(['project', 'contact', 'product', 'productSerial']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $record = InstallationRecord::findOrFail($id);

        if ($record->status !== 'scheduled') {
            return response()->json(['message' => 'แก้ไขได้เฉพาะงานที่ยังไม่ติดตั้ง (สถานะนัดหมายแล้ว) เท่านั้น'], 400);
        }

        $request->validate([
            'site_name' => 'nullable|string|max:150',
            'site_address' => 'nullable|string',
            'room_location' => 'nullable|string|max:150',
            'install_notes' => 'nullable|string',
            'warranty_months' => 'nullable|integer|min:0|max:600',
            'installed_by' => 'nullable|exists:users,id',
            'scheduled_at' => 'nullable|date',
        ]);

        $record->update($request->only([
            'site_name', 'site_address', 'room_location', 'install_notes', 'warranty_months', 'installed_by', 'scheduled_at',
        ]));

        return response()->json(['message' => 'บันทึกการแก้ไขสำเร็จ', 'data' => $record->fresh()]);
    }

    public function transitionStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|string',
            'installed_at' => 'nullable|date',
        ]);

        $record = InstallationRecord::findOrFail($id);
        $allowed = self::STATUS_TRANSITIONS[$record->status] ?? [];

        if (!in_array($request->status, $allowed)) {
            return response()->json([
                'message' => "ไม่สามารถเปลี่ยนสถานะจาก \"{$record->status}\" เป็น \"{$request->status}\" ได้",
            ], 400);
        }

        $updates = ['status' => $request->status];

        if ($request->status === 'installed') {
            $installedAt = $request->installed_at ?? now()->format('Y-m-d');
            $updates['installed_at'] = $installedAt;
            if ($record->warranty_months) {
                $updates['warranty_expires_at'] = Carbon::parse($installedAt)->addMonths($record->warranty_months)->format('Y-m-d');
            }
        }

        $record->update($updates);

        return response()->json(['message' => 'อัปเดตสถานะงานติดตั้งสำเร็จ', 'data' => $record->fresh()]);
    }

    public function destroy($id)
    {
        $record = InstallationRecord::findOrFail($id);

        if ($record->status !== 'scheduled') {
            return response()->json(['message' => 'ลบได้เฉพาะงานที่ยังไม่ติดตั้ง (สถานะนัดหมายแล้ว) เท่านั้น'], 400);
        }

        $record->delete();

        return response()->json(['message' => 'ลบข้อมูลงานติดตั้งสำเร็จ']);
    }
}
