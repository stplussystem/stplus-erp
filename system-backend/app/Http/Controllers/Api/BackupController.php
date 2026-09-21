<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\BackupService;
use Illuminate\Http\Request;

/**
 * 🆕 [2026-09-21] สำรอง/กู้คืนข้อมูลทั้งระบบจากหน้าเว็บ (เมนู "สำรองข้อมูล")
 *
 * ทุก endpoint (ยกเว้น restoreStatus) จำกัดเฉพาะ Platform Admin ด้วย hardcoded is_platform_admin check ตาม pattern
 * เดียวกับ CompanyAccessController — เพราะฐานข้อมูลเดียวใช้ร่วมทุกบริษัท ไฟล์สำรองจึงมีข้อมูลทุกบริษัทรวมถึง password hash
 * (ไม่ผูกกับ Spatie permission เพราะ Super Admin ของแต่ละบริษัทก็ได้ Permission::all() เท่ากันหมด)
 */
class BackupController extends Controller
{
    public function __construct(private BackupService $backups)
    {
    }

    private function authorizePlatformAdmin(Request $request): void
    {
        abort_unless((bool) $request->user()->is_platform_admin, 403, 'เฉพาะ Super Admin ของระบบเท่านั้นที่จัดการการสำรองข้อมูลได้');
    }

    // ?location=local|ext1|ext2 (ไม่ระบุ = ปลายทางหลัก) — ไฟล์เดียวกันอาจมีอยู่หลายปลายทาง (สำเนาที่สอง) จึงต้องระบุที่อยู่ไฟล์
    private function location(Request $request): ?string
    {
        $location = $request->input('location');
        if ($location === null || $location === '') return null;
        abort_unless(BackupService::isValidTarget((string) $location), 422, 'ปลายทางไม่ถูกต้อง');
        return (string) $location;
    }

    private function actor(Request $request): array
    {
        return ['id' => $request->user()->id, 'name' => $request->user()->name];
    }

    private function log(Request $request, string $action): void
    {
        $user = $request->user();
        ActivityLog::create([
            'company_id' => $user->company_id,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'user_email' => $user->email,
            'method' => $request->method(),
            'path' => $request->path(),
            'action' => $action,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);
    }

    // GET /api/backups
    public function index(Request $request)
    {
        $this->authorizePlatformAdmin($request);

        $location = $this->location($request);

        try {
            $files = $this->backups->list($location);
            $listError = null;
        } catch (\Throwable $e) {
            // ปลายทางที่เลือกดูไม่พร้อม (เช่นไดรฟ์หลุด) — ยังคืนตั้งค่า/รายการปลายทางให้หน้าเว็บแสดงสถานะได้
            $files = [];
            $listError = $e->getMessage();
        }

        return response()->json([
            'data' => $files,
            'location' => $location ?? $this->backups->primaryKey(),
            'list_error' => $listError,
            'targets' => $this->backups->targets(),
            'settings' => $this->backups->settings(),
            'restore_status' => $this->backups->restoreStatus(),
        ]);
    }

    // POST /api/backups — สำรองทันที
    public function store(Request $request)
    {
        $this->authorizePlatformAdmin($request);

        try {
            $info = $this->backups->create('manual', $this->actor($request));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'สำรองข้อมูลไม่สำเร็จ: ' . $e->getMessage()], 500);
        }

        $copyErrors = array_filter($info['copies'] ?? [], fn ($c) => $c !== 'ok');
        $message = 'สำรองข้อมูลสำเร็จ';
        if ($copyErrors) {
            $message .= ' — แต่คัดลอกสำเนาที่สองไม่สำเร็จ: ' . implode('; ', $copyErrors);
        }

        return response()->json(['message' => $message, 'data' => $info, 'copy_failed' => (bool) $copyErrors], 201);
    }

    // GET /api/backups/{file}/download
    public function download(Request $request, string $file)
    {
        $this->authorizePlatformAdmin($request);
        abort_unless(BackupService::isValidFileName($file), 404);

        try {
            $path = $this->backups->pathFor($file, $this->location($request));
        } catch (\RuntimeException $e) {
            abort(422, $e->getMessage());
        }
        abort_unless(is_file($path), 404, 'ไม่พบไฟล์สำรองนี้');

        $this->log($request, "ดาวน์โหลดไฟล์สำรองข้อมูล {$file}");

        return response()->download($path, $file, ['Content-Type' => 'application/zip']);
    }

    // DELETE /api/backups/{file}
    public function destroy(Request $request, string $file)
    {
        $this->authorizePlatformAdmin($request);
        abort_unless(BackupService::isValidFileName($file), 404);

        $location = $this->location($request);
        try {
            $this->backups->delete($file, $location);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        $this->log($request, "ลบไฟล์สำรองข้อมูล {$file}");

        return response()->json(['message' => 'ลบไฟล์สำรองเรียบร้อยแล้ว']);
    }

    // GET /api/backups/settings
    public function settings(Request $request)
    {
        $this->authorizePlatformAdmin($request);
        return response()->json(['data' => $this->backups->settings()]);
    }

    // PUT /api/backups/settings
    public function updateSettings(Request $request)
    {
        $this->authorizePlatformAdmin($request);

        $data = $request->validate([
            'enabled' => 'required|boolean',
            'frequency' => 'required|in:daily,weekly',
            'time' => ['required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'weekday' => 'required|integer|between:0,6',
            'keep' => 'required|integer|between:1,60',
        ]);

        return response()->json([
            'message' => 'บันทึกการตั้งค่าสำรองอัตโนมัติแล้ว',
            'data' => $this->backups->updateSettings($data),
        ]);
    }

    // POST /api/backups/{file}/restore — ต้องส่ง confirm_text = "กู้คืนข้อมูล" ยืนยันอีกชั้น
    public function restore(Request $request, string $file)
    {
        $this->authorizePlatformAdmin($request);
        abort_unless(BackupService::isValidFileName($file), 404);

        $request->validate(['confirm_text' => 'required|in:กู้คืนข้อมูล'], [
            'confirm_text.in' => 'กรุณาพิมพ์ "กู้คืนข้อมูล" เพื่อยืนยัน',
        ]);
        $location = $this->location($request);
        try {
            $exists = is_file($this->backups->pathFor($file, $location));
        } catch (\RuntimeException $e) {
            abort(422, $e->getMessage());
        }
        abort_unless($exists, 404, 'ไม่พบไฟล์สำรองนี้');

        if (($this->backups->restoreStatus()['state'] ?? 'idle') === 'running') {
            return response()->json(['message' => 'มีการกู้คืนข้อมูลกำลังทำงานอยู่'], 409);
        }

        $this->log($request, "สั่งกู้คืนข้อมูลจากไฟล์สำรอง {$file}");
        $this->backups->writeRestoreStatus(['state' => 'running', 'started_at' => now()->toIso8601String()]);

        // รันเป็น background process แยกจาก request นี้ (ระหว่างกู้คืน token/ผู้ใช้ถูกแทนที่ และใช้เวลานาน)
        $cmd = sprintf(
            'nohup %s %s backup:restore %s --by=%s --location=%s > /dev/null 2>&1 &',
            escapeshellarg(PHP_BINARY),
            escapeshellarg(base_path('artisan')),
            escapeshellarg($file),
            escapeshellarg($request->user()->name),
            escapeshellarg($location ?? $this->backups->primaryKey()),
        );
        exec($cmd);

        return response()->json(['message' => 'เริ่มกู้คืนข้อมูลแล้ว กรุณารอสักครู่'], 202);
    }

    // PUT /api/backups/destination — เลือกปลายทางหลัก + สำเนาที่สอง (ไม่บังคับ)
    public function updateDestination(Request $request)
    {
        $this->authorizePlatformAdmin($request);

        $data = $request->validate([
            'primary' => 'required|in:local,ext1,ext2',
            'secondary' => 'nullable|in:local,ext1,ext2',
        ]);

        try {
            $targets = $this->backups->updateDestination($data['primary'], $data['secondary'] ?? null);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $this->log($request, 'เปลี่ยนปลายทางสำรองข้อมูล: หลัก=' . $data['primary'] . ' สำเนา=' . ($data['secondary'] ?? '-'));

        return response()->json(['message' => 'บันทึกปลายทางการสำรองข้อมูลแล้ว', 'targets' => $targets, 'settings' => $this->backups->settings()]);
    }

    // POST /api/backups/targets/{key}/test — ทดสอบเขียน/อ่าน/ลบไฟล์เล็กๆ ในปลายทาง
    public function testTarget(Request $request, string $key)
    {
        $this->authorizePlatformAdmin($request);
        abort_unless(BackupService::isValidTarget($key), 404);

        try {
            $target = $this->backups->testTarget($key);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'เขียนไฟล์ทดสอบสำเร็จ ปลายทางนี้ใช้งานได้', 'target' => $target]);
    }

    // GET /api/backups/restore-status — ไม่ต้องล็อกอิน: ระหว่างกู้คืนตาราง token ถูกแทนที่ทำให้ auth ใช้ไม่ได้ชั่วคราว
    // คืนแค่สถานะรวม (ไม่เปิดเผยชื่อไฟล์/ข้อมูลใดๆ) ให้หน้าเว็บ poll ดูว่าเสร็จหรือยัง
    public function restoreStatus()
    {
        $status = $this->backups->restoreStatus();
        return response()->json(['state' => $status['state'] ?? 'idle', 'finished_at' => $status['finished_at'] ?? null]);
    }
}
