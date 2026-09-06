<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Illuminate\Http\Request;

class AssetController extends Controller
{
    public function index(Request $request)
    {
        $query = Asset::with(['responsibleUser:id,name']);
        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'serial_number' => 'nullable|string|max:255',
            'purchase_date' => 'nullable|date',
            'responsible_user_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:active,maintenance,retired',
            'next_maintenance_date' => 'nullable|date',
            'note' => 'nullable|string',
        ]);

        $asset = new Asset();
        $asset->name = $request->name;
        $asset->category = $request->category;
        $asset->serial_number = $request->serial_number;
        $asset->purchase_date = $request->purchase_date;
        $asset->responsible_user_id = $request->responsible_user_id;
        $asset->status = $request->status ?? 'active';
        $asset->next_maintenance_date = $request->next_maintenance_date;
        $asset->note = $request->note;
        $asset->company_id = $request->user()->company_id;
        $asset->created_by = $request->user()->id;
        $asset->save();

        return response()->json(['message' => 'เพิ่มสินทรัพย์สำเร็จ', 'data' => $asset], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'serial_number' => 'nullable|string|max:255',
            'purchase_date' => 'nullable|date',
            'responsible_user_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:active,maintenance,retired',
            'next_maintenance_date' => 'nullable|date',
            'note' => 'nullable|string',
        ]);

        $asset = Asset::findOrFail($id);
        $asset->name = $request->name;
        $asset->category = $request->category;
        $asset->serial_number = $request->serial_number;
        $asset->purchase_date = $request->purchase_date;
        $asset->responsible_user_id = $request->responsible_user_id;
        $asset->status = $request->status ?? $asset->status;
        $asset->next_maintenance_date = $request->next_maintenance_date;
        $asset->note = $request->note;
        $asset->save();

        return response()->json(['message' => 'อัปเดตข้อมูลสินทรัพย์สำเร็จ', 'data' => $asset]);
    }

    public function destroy($id)
    {
        $asset = Asset::findOrFail($id);
        $asset->delete();
        return response()->json(['message' => 'ลบสินทรัพย์สำเร็จ']);
    }
}
