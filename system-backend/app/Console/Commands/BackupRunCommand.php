<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;

// 🆕 [2026-09-21] สำรองข้อมูลทั้งระบบ — `--auto` ใช้กับ scheduler (เช็กเวลาตามที่ตั้งจากหน้าเว็บก่อน ถ้ายังไม่ถึงเวลาจะไม่ทำอะไร)
class BackupRunCommand extends Command
{
    protected $signature = 'backup:run {--auto : เรียกจาก scheduler — สำรองเฉพาะเมื่อถึงเวลาที่ตั้งไว้}';

    protected $description = 'สำรองฐานข้อมูล + ไฟล์อัปโหลดเป็นไฟล์ zip (เก็บที่ storage/app/private/backups)';

    public function handle(BackupService $backups): int
    {
        try {
            if ($this->option('auto')) {
                $info = $backups->runIfDue();
                if ($info) $this->info("สำรองอัตโนมัติสำเร็จ: {$info['file_name']}");
                return self::SUCCESS;
            }

            $info = $backups->create('manual', ['id' => null, 'name' => 'คำสั่ง artisan']);
            $this->info("สำรองสำเร็จ: {$info['file_name']} ({$info['size']} bytes, {$info['total_rows']} แถว, {$info['file_count']} ไฟล์)");
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('สำรองไม่สำเร็จ: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
