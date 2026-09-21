<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AssetController extends Controller
{
    public function index(Request $request)
    {
        $query = Asset::with(['responsibleUser:id,name', 'photos']);
        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('search')) {
            // ค้นหาได้จาก ชื่อสินทรัพย์ / S/N / ชื่อผู้รับผิดชอบ (สถานะกรองแยกด้วย ?status=)
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhereHas('responsibleUser', fn($u) => $u->where('name', 'like', "%{$search}%"));
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
            'price' => 'nullable|numeric|min:0|max:9999999999999',
            'responsible_user_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:active,maintenance,retired',
            'next_maintenance_date' => 'nullable|date',
            'note' => 'nullable|string',
            'photos' => 'nullable|array|max:4',
            'photos.*' => 'file|image|mimes:jpeg,png,jpg,webp|max:1024',
            'remove_photo_ids' => 'nullable|array',
            'remove_photo_ids.*' => 'integer',
        ]);

        $asset = new Asset();
        $asset->name = $request->name;
        $asset->category = $request->category;
        $asset->serial_number = $request->serial_number;
        $asset->purchase_date = $request->purchase_date;
        $asset->price = $request->price;
        $asset->responsible_user_id = $request->responsible_user_id;
        $asset->status = $request->status ?? 'active';
        $asset->next_maintenance_date = $request->next_maintenance_date;
        $asset->note = $request->note;
        $asset->company_id = $request->user()->company_id;
        $asset->created_by = $request->user()->id;
        $asset->save();

        $this->storePhotos($request, $asset);

        return response()->json(['message' => 'เพิ่มสินทรัพย์สำเร็จ', 'data' => $asset->load('photos')], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'serial_number' => 'nullable|string|max:255',
            'purchase_date' => 'nullable|date',
            'price' => 'nullable|numeric|min:0|max:9999999999999',
            'responsible_user_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:active,maintenance,retired',
            'next_maintenance_date' => 'nullable|date',
            'note' => 'nullable|string',
            'photos' => 'nullable|array|max:4',
            'photos.*' => 'file|image|mimes:jpeg,png,jpg,webp|max:1024',
            'remove_photo_ids' => 'nullable|array',
            'remove_photo_ids.*' => 'integer',
        ]);

        $asset = Asset::findOrFail($id);

        // รูปเดิมที่ผู้ใช้กดลบ + รูปใหม่ที่เพิ่ม รวมกันต้องไม่เกิน 4 รูปต่อสินทรัพย์
        $removeIds = array_map('intval', (array) $request->input('remove_photo_ids', []));
        $remaining = $asset->photos()->whereNotIn('id', $removeIds ?: [0])->count();
        $incoming = count((array) $request->file('photos', []));
        if ($remaining + $incoming > 4) {
            return response()->json(['message' => 'แนบรูปได้สูงสุด 4 รูปต่อสินทรัพย์', 'errors' => ['photos' => ['แนบรูปได้สูงสุด 4 รูปต่อสินทรัพย์']]], 422);
        }

        $asset->name = $request->name;
        $asset->category = $request->category;
        $asset->serial_number = $request->serial_number;
        $asset->purchase_date = $request->purchase_date;
        $asset->price = $request->price;
        $asset->responsible_user_id = $request->responsible_user_id;
        $asset->status = $request->status ?? $asset->status;
        $asset->next_maintenance_date = $request->next_maintenance_date;
        $asset->note = $request->note;
        $asset->save();

        if ($removeIds) {
            foreach ($asset->photos()->whereIn('id', $removeIds)->get() as $photo) {
                Storage::disk('public')->delete($photo->path);
                $photo->delete();
            }
        }
        $this->storePhotos($request, $asset);

        return response()->json(['message' => 'อัปเดตข้อมูลสินทรัพย์สำเร็จ', 'data' => $asset->load('photos')]);
    }

    private function storePhotos(Request $request, Asset $asset): void
    {
        if (!$request->hasFile('photos')) return;
        foreach ($request->file('photos') as $photo) {
            $asset->photos()->create(['path' => $photo->store('assets', 'public')]);
        }
    }

    public function destroy($id)
    {
        $asset = Asset::findOrFail($id);
        $asset->delete();
        return response()->json(['message' => 'ลบสินทรัพย์สำเร็จ']);
    }
}
