<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    // 📖 รายการ log — ขอบเขตบริษัทถูกจัดการอัตโนมัติผ่าน BelongsToCompany global scope บนโมเดล
    // (Super Admin เห็นเฉพาะบริษัทตัวเอง, Platform Admin หลุดพ้น scope เห็นทุกบริษัท) ไม่ต้องเขียน
    // if/else แยก platform admin ในนี้เอง
    public function index(Request $request)
    {
        $query = ActivityLog::latest('created_at');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('user_name', 'like', "%{$search}%")
                    ->orWhere('user_email', 'like', "%{$search}%")
                    ->orWhere('action', 'like', "%{$search}%")
                    ->orWhere('path', 'like', "%{$search}%");
            });
        }

        if ($request->filled('method') && $request->input('method') !== 'all') {
            $query->where('method', $request->input('method'));
        }

        if ($request->filled('ip_address')) {
            $query->where('ip_address', 'like', "%{$request->ip_address}%");
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $perPage = $request->input('per_page', 15);

        return response()->json($query->paginate($perPage));
    }
}
