<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GovernmentContract;
use App\Services\DocumentService;
use Illuminate\Http\Request;

// 📋 ใบคุมสัญญาราชการ — CRUD ล้วน ไม่มี approve/cancel (เป็นทะเบียนติดตาม ไม่ใช่เอกสารอนุมัติ)
class GovernmentContractController extends Controller
{
    private function hasPermission(string $action): bool
    {
        $user = auth()->user();
        if ($user->is_platform_admin || $user->isCompanyAdmin()) return true;
        return $user->can("{$action}_government_contracts");
    }

    public function index(Request $request)
    {
        if (!$this->hasPermission('view')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูข้อมูลนี้'], 403);
        }
        $query = GovernmentContract::with(['project', 'dueDates'])->where('company_id', auth()->user()->company_id);
        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }
        return response()->json($query->orderByDesc('contract_date')->get());
    }

    public function store(Request $request)
    {
        if (!$this->hasPermission('create')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์เพิ่มข้อมูลนี้'], 403);
        }
        $companyId = auth()->user()->company_id;

        $request->validate([
            'project_id' => 'required|integer',
            'agency_name' => 'required|string|max:255',
            'contract_number' => 'required|string|max:255',
            'contract_date' => 'nullable|date',
            'contract_amount' => 'nullable|numeric|min:0',
            'guarantee_number' => 'nullable|string|max:255',
            'guarantee_amount' => 'nullable|numeric|min:0',
            'guarantee_date' => 'nullable|date',
            'due_dates' => 'nullable|array',
            'due_dates.*.due_date' => 'nullable|date',
            'due_dates.*.note' => 'nullable|string|max:255',
            'guarantee_return_requested_date' => 'nullable|date',
            'guarantee_returned_date' => 'nullable|date',
            'receipt_voucher_text' => 'nullable|string',
            'note' => 'nullable|string',
        ]);

        $contract = GovernmentContract::create([
            'company_id' => $companyId,
            'project_id' => $request->project_id,
            'agency_name' => $request->agency_name,
            'contract_number' => $request->contract_number,
            'contract_date' => $request->contract_date,
            'contract_amount' => $request->contract_amount ?? 0,
            'guarantee_number' => $request->guarantee_number,
            'guarantee_amount' => $request->guarantee_amount,
            'guarantee_date' => $request->guarantee_date,
            'guarantee_return_requested_date' => $request->guarantee_return_requested_date,
            'guarantee_returned_date' => $request->guarantee_returned_date,
            'receipt_voucher_text' => $request->receipt_voucher_text,
            'note' => $request->note,
            'created_by' => auth()->id(),
        ]);

        $this->syncDueDates($contract, $request->input('due_dates', []));

        // 🧾 ถ้าตั้งค่าวันที่ได้คืนหลักประกันมาตั้งแต่ตอนสร้างเลย ก็จองเลขใบสำคัญรับเงินให้ทันที
        if ($contract->guarantee_returned_date && !$contract->receipt_voucher_number) {
            $contract->update(['receipt_voucher_number' => DocumentService::generate('receipt_voucher', $companyId)]);
        }

        return response()->json(['message' => 'เพิ่มข้อมูลสัญญาสำเร็จ', 'data' => $contract->load('dueDates')], 201);
    }

    public function show($id)
    {
        if (!$this->hasPermission('view')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ดูข้อมูลนี้'], 403);
        }
        $contract = GovernmentContract::with(['project', 'dueDates'])->find($id);
        if (!$contract) return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        return response()->json(['data' => $contract]);
    }

    public function update(Request $request, $id)
    {
        if (!$this->hasPermission('edit')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้'], 403);
        }
        $contract = GovernmentContract::find($id);
        if (!$contract) return response()->json(['message' => 'ไม่พบข้อมูล'], 404);

        $request->validate([
            'project_id' => 'required|integer',
            'agency_name' => 'required|string|max:255',
            'contract_number' => 'required|string|max:255',
            'contract_date' => 'nullable|date',
            'contract_amount' => 'nullable|numeric|min:0',
            'guarantee_number' => 'nullable|string|max:255',
            'guarantee_amount' => 'nullable|numeric|min:0',
            'guarantee_date' => 'nullable|date',
            'due_dates' => 'nullable|array',
            'due_dates.*.due_date' => 'nullable|date',
            'due_dates.*.note' => 'nullable|string|max:255',
            'guarantee_return_requested_date' => 'nullable|date',
            'guarantee_returned_date' => 'nullable|date',
            'receipt_voucher_text' => 'nullable|string',
            'note' => 'nullable|string',
        ]);

        $contract->update($request->only([
            'project_id', 'agency_name', 'contract_number', 'contract_date', 'contract_amount',
            'guarantee_number', 'guarantee_amount', 'guarantee_date',
            'guarantee_return_requested_date', 'guarantee_returned_date', 'receipt_voucher_text', 'note',
        ]));

        if ($request->has('due_dates')) {
            $this->syncDueDates($contract, $request->input('due_dates', []));
        }

        // 🧾 จองเลขใบสำคัญรับเงินอัตโนมัติครั้งแรกที่ guarantee_returned_date เปลี่ยนจาก null → มีค่า
        // (เช็คก่อนว่ายังไม่เคยจองมาก่อน กันเลขเปลี่ยนทุกครั้งที่กดบันทึกซ้ำ)
        if ($contract->guarantee_returned_date && !$contract->receipt_voucher_number) {
            $contract->update(['receipt_voucher_number' => DocumentService::generate('receipt_voucher', auth()->user()->company_id)]);
        }

        return response()->json(['message' => 'อัปเดตข้อมูลสำเร็จ', 'data' => $contract->load('dueDates')]);
    }

    // 🔁 แทนที่วันครบกำหนดทั้งหมดของสัญญานี้ด้วยชุดใหม่ที่ส่งมา — ลบของเดิมทิ้งแล้วสร้างใหม่ทั้งชุด
    // (ง่ายกว่า diff ทีละแถว และจำนวนแถวต่อสัญญาน้อยอยู่แล้ว) ข้ามแถวที่ไม่มีทั้งวันที่และ note
    private function syncDueDates(GovernmentContract $contract, array $dueDates): void
    {
        $contract->dueDates()->delete();
        $rows = collect($dueDates)
            ->filter(fn($row) => !empty($row['due_date']) || !empty($row['note']))
            ->map(fn($row) => [
                'due_date' => $row['due_date'] ?? null,
                'note' => $row['note'] ?? null,
            ])
            ->values()
            ->all();

        if (!empty($rows)) {
            $contract->dueDates()->createMany($rows);
        }
    }

    public function destroy($id)
    {
        if (!$this->hasPermission('delete')) {
            return response()->json(['message' => 'คุณไม่มีสิทธิ์ลบข้อมูลนี้'], 403);
        }
        $contract = GovernmentContract::find($id);
        if (!$contract) return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        $contract->delete();
        return response()->json(['message' => 'ลบข้อมูลเรียบร้อยแล้ว']);
    }
}
