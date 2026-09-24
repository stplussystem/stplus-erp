<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

// 🎨 พื้นหลังหน้า login — ค่ากลางของทั้งระบบ (หน้า login แสดงก่อนเลือกบริษัท จึงผูกกับบริษัทใดบริษัทหนึ่งไม่ได้)
// เก็บเป็น JSON ใน system_settings key = login_background เหมือนตัวเลือกซ่อน/แสดงลิงก์สมัครบริษัท
// GET  /api/login-background            — public (หน้า /login เรียกก่อน login)
// GET  /api/settings/login-background   — เฉพาะ Platform Admin
// POST /api/settings/login-background   — เฉพาะ Platform Admin (multipart เพราะมีไฟล์รูป/วิดีโอ)
class LoginBackgroundController extends Controller
{
    private const KEY = 'login_background';

    // ภาพเคลื่อนไหวสำเร็จรูป — ต้องตรงกับที่หน้า login (LoginBackground.tsx) วาดได้จริง
    public const PRESETS = ['aurora', 'waves', 'particles', 'bokeh'];
    public const TYPES = ['none', 'image', 'video', 'preset', 'gradient'];

    private const DEFAULTS = [
        'type' => 'none',
        'image_path' => null,
        'video_path' => null,
        'preset' => 'aurora',
        'color1' => '#2563eb',
        'color2' => '#7c3aed',
        'gradient_animated' => true,
        'overlay' => 30,
    ];

    private function read(): array
    {
        $row = SystemSetting::find(self::KEY);
        $stored = $row ? json_decode((string) $row->value, true) : null;
        return array_merge(self::DEFAULTS, is_array($stored) ? $stored : []);
    }

    private function present(array $s): array
    {
        return [
            'type' => $s['type'],
            'image_url' => $s['image_path'] ? Storage::disk('public')->url($s['image_path']) : null,
            'video_url' => $s['video_path'] ? Storage::disk('public')->url($s['video_path']) : null,
            'has_image' => (bool) $s['image_path'],
            'has_video' => (bool) $s['video_path'],
            'preset' => $s['preset'],
            'color1' => $s['color1'],
            'color2' => $s['color2'],
            'gradient_animated' => (bool) $s['gradient_animated'],
            'overlay' => (int) $s['overlay'],
        ];
    }

    public function show()
    {
        return response()->json($this->present($this->read()));
    }

    public function showAdmin()
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin เท่านั้น'], 403);
        }
        return response()->json($this->present($this->read()));
    }

    public function update(Request $request)
    {
        if (!auth()->user()->is_platform_admin) {
            return response()->json(['message' => 'เฉพาะ Platform Admin เท่านั้น'], 403);
        }

        $request->validate([
            'type' => 'required|in:' . implode(',', self::TYPES),
            'preset' => 'nullable|in:' . implode(',', self::PRESETS),
            'color1' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'color2' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'gradient_animated' => 'nullable|boolean',
            'overlay' => 'nullable|integer|min:0|max:80',
            'image' => 'nullable|file|mimes:jpeg,jpg,png,webp,gif|max:8192',
            'video' => 'nullable|file|mimetypes:video/mp4,video/webm|max:51200',
            'remove_image' => 'nullable|boolean',
            'remove_video' => 'nullable|boolean',
        ]);

        $s = $this->read();

        if ($request->boolean('remove_image') && $s['image_path']) {
            Storage::disk('public')->delete($s['image_path']);
            $s['image_path'] = null;
        }
        if ($request->boolean('remove_video') && $s['video_path']) {
            Storage::disk('public')->delete($s['video_path']);
            $s['video_path'] = null;
        }
        if ($request->hasFile('image')) {
            if ($s['image_path']) Storage::disk('public')->delete($s['image_path']);
            $s['image_path'] = $request->file('image')->store('login-backgrounds', 'public');
        }
        if ($request->hasFile('video')) {
            if ($s['video_path']) Storage::disk('public')->delete($s['video_path']);
            $s['video_path'] = $request->file('video')->store('login-backgrounds', 'public');
        }

        // เลือกชนิดที่ต้องมีไฟล์แต่ยังไม่มี → ปฏิเสธ (กันหน้า login ว่างเปล่า)
        if ($request->type === 'image' && !$s['image_path']) {
            return response()->json(['message' => 'กรุณาอัปโหลดรูปภาพก่อน'], 422);
        }
        if ($request->type === 'video' && !$s['video_path']) {
            return response()->json(['message' => 'กรุณาอัปโหลดวิดีโอก่อน'], 422);
        }

        $s['type'] = $request->type;
        if ($request->filled('preset')) $s['preset'] = $request->preset;
        if ($request->filled('color1')) $s['color1'] = $request->color1;
        if ($request->filled('color2')) $s['color2'] = $request->color2;
        if ($request->has('gradient_animated')) $s['gradient_animated'] = $request->boolean('gradient_animated');
        if ($request->has('overlay')) $s['overlay'] = (int) $request->overlay;

        SystemSetting::updateOrCreate(['key' => self::KEY], ['value' => json_encode($s)]);

        return response()->json(['message' => 'บันทึกการตั้งค่าพื้นหลังสำเร็จ'] + $this->present($s));
    }
}
