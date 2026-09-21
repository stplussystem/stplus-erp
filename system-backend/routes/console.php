<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// 🆕 [2026-09-21] สำรองข้อมูลอัตโนมัติ — เช็กทุกนาทีว่าถึงเวลาที่ตั้งไว้จากหน้า "สำรองข้อมูล" หรือยัง (ตั้ง/เปลี่ยนเวลาแล้วมีผลทันที)
// ต้องมีตัวรัน scheduler (service `scheduler` ใน docker-compose.yml → php artisan schedule:work)
// ใช้ closure แทน Schedule::command() เพื่อไม่ต้อง boot Laravel ซ้ำอีกรอบทุกนาที (ที่ Docker Desktop บน Windows แต่ละรอบช้าประมาณ 12 วินาที)
Schedule::call(fn () => app(\App\Services\BackupService::class)->runIfDue())->name('backup-auto')->everyMinute()->withoutOverlapping();
