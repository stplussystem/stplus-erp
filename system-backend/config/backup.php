<?php

// 🆕 [2026-09-21] ที่เก็บไฟล์สำรองภายนอก (ไดรฟ์อื่น / NAS) — เป็นโฟลเดอร์ "ภายใน container" ที่ docker-compose.yml เมาต์มาจาก
// โฟลเดอร์จริงบนเครื่อง (ตั้งผ่านตัวแปร BACKUP_HOST_DIR_1 / BACKUP_HOST_DIR_2 ในไฟล์ .env ข้าง docker-compose.yml)
// เลือกปลายทางหลัก/สำเนาที่สองได้ที่หน้า "สำรองข้อมูล" — ส่วนปลายทาง "ในเครื่อง" (local) คือ storage/app/private/backups เสมอ
return [
    'targets' => [
        'ext1' => env('BACKUP_EXT1_PATH', '/backup-targets/ext1'),
        'ext2' => env('BACKUP_EXT2_PATH', '/backup-targets/ext2'),
    ],
];
