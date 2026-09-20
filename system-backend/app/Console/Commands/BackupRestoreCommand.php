<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;

// 🆕 [2026-09-21] กู้คืนข้อมูลจากไฟล์สำรอง — ให้ BackupController เรียกเป็น background process (ระหว่างกู้คืนตารางผู้ใช้/token
// ถูกแทนที่ทั้งชุด และใช้เวลานานเกิน request ปกติ) สถานะเขียนลง restore-status.json ให้หน้าเว็บ poll ดู
class BackupRestoreCommand extends Command
{
    protected $signature = 'backup:restore {file : ชื่อไฟล์สำรอง เช่น backup_20260921_020000_auto.zip} {--by= : ชื่อผู้สั่งกู้คืน (บันทึกลง manifest ของ safety backup)}';

    protected $description = 'กู้คืนฐานข้อมูล + ไฟล์อัปโหลดจากไฟล์สำรอง (เขียนทับข้อมูลปัจจุบันทั้งระบบ)';

    public function handle(BackupService $backups): int
    {
        $file = $this->argument('file');
        $by = $this->option('by') ? ['id' => null, 'name' => $this->option('by')] : null;

        $backups->writeRestoreStatus(['state' => 'running', 'started_at' => now()->toIso8601String()]);
        try {
            $result = $backups->restore($file, $by);
            $backups->writeRestoreStatus([
                'state' => 'done',
                'finished_at' => now()->toIso8601String(),
                'message' => "กู้คืนจาก {$result['restored_from']} สำเร็จ (สำรองข้อมูลก่อนกู้คืนไว้ที่ {$result['safety_backup']})",
            ]);
            $this->info("กู้คืนสำเร็จ: {$result['statements']} statements, {$result['restored_files']} ไฟล์");
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $backups->writeRestoreStatus([
                'state' => 'failed',
                'finished_at' => now()->toIso8601String(),
                'message' => $e->getMessage(),
            ]);
            $this->error('กู้คืนไม่สำเร็จ: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
