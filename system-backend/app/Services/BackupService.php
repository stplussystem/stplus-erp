<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use ZipArchive;

/**
 * 🆕 [2026-09-21] สำรอง/กู้คืนข้อมูลทั้งระบบ (ฐานข้อมูล + ไฟล์อัปโหลดใน storage/app/public) เป็นไฟล์ zip เดียว
 *
 * - ใช้ PDO dump เองแทน mariadb-dump เพราะ container backend (php:8.4-cli) ไม่มี mariadb-client และฐานข้อมูลยังเล็ก
 *   (ถ้าโตมากในอนาคตควรเปลี่ยนไปติดตั้ง mariadb-client ใน Dockerfile แล้วเรียก mariadb-dump แทน)
 * - เก็บ settings/สถานะเป็น "ไฟล์" (storage/app/private/backups/*.json) ไม่ใช้ตารางในฐานข้อมูล เพราะการกู้คืน
 *   เขียนทับทั้งฐานข้อมูล ตารางตั้งค่าจะหายตามไปด้วย
 * - ฐานข้อมูลเดียวใช้ร่วมทุกบริษัท ไฟล์สำรองจึงมีข้อมูลทุกบริษัท → ผู้เรียกต้องจำกัดเฉพาะ Platform Admin
 */
class BackupService
{
    // แต่ละ statement ในไฟล์ .sql ปิดท้ายด้วยบรรทัดนี้ (กู้คืนแยก statement ด้วยบรรทัดนี้ ไม่ต้องเดาจาก ';')
    private const STATEMENT_END = '-- ---- END ----';

    private const TYPES = ['manual', 'auto', 'prerestore'];

    private const INSERT_BATCH_ROWS = 100;
    private const READ_CHUNK_ROWS = 1000;

    // เวลาที่ตั้งสำรองอัตโนมัติ/ชื่อไฟล์ใช้เวลาไทย (app timezone เป็น UTC)
    private const TIMEZONE = 'Asia/Bangkok';

    // 🗂️ ปลายทางที่เลือกได้: local = storage/app/private/backups (ในเครื่อง), ext1/ext2 = ที่เก็บภายนอกที่เมาต์เข้า container
    // (ไดรฟ์อื่น/NAS — ดู config/backup.php และ docker-compose.yml)
    private const TARGET_KEYS = ['local', 'ext1', 'ext2'];
    private const TARGET_LABELS = [
        'local' => 'ในเครื่อง (storage ของระบบ)',
        'ext1' => 'ที่เก็บภายนอก 1',
        'ext2' => 'ที่เก็บภายนอก 2',
    ];

    // โฟลเดอร์ "ในเครื่อง" — เก็บ settings.json / restore-status.json เสมอ (ไม่ย้ายตามปลายทาง เพราะปลายทางภายนอกอาจหลุด/ไม่พร้อม
    // แต่ระบบต้องอ่านการตั้งค่าและสถานะกู้คืนได้เสมอ) และเป็นปลายทาง "local"
    public function localDirectory(): string
    {
        $dir = storage_path('app/private/backups');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        return $dir;
    }

    public static function isValidTarget(string $key): bool
    {
        return in_array($key, self::TARGET_KEYS, true);
    }

    private function targetPath(string $key): string
    {
        return $key === 'local' ? $this->localDirectory() : (string) config("backup.targets.{$key}");
    }

    private function targetAvailable(string $key): bool
    {
        $path = $this->targetPath($key);
        return $path !== '' && is_dir($path) && is_writable($path);
    }

    // ข้อมูลทุกปลายทางสำหรับหน้าเว็บ: พร้อมใช้ไหม / พื้นที่ว่าง / อยู่ดิสก์เดียวกับระบบไหม (ไม่ช่วยกรณีดิสก์เสีย)
    public function targets(): array
    {
        $settings = $this->settings();
        $localDev = @stat($this->localDirectory())['dev'] ?? null;
        $result = [];
        foreach (self::TARGET_KEYS as $key) {
            $path = $this->targetPath($key);
            $available = $this->targetAvailable($key);
            $result[] = [
                'key' => $key,
                'label' => self::TARGET_LABELS[$key],
                'path' => $path,
                'available' => $available,
                'free_bytes' => $available ? @disk_free_space($path) ?: null : null,
                'total_bytes' => $available ? @disk_total_space($path) ?: null : null,
                'same_disk_as_local' => $key !== 'local' && $available && $localDev !== null && (@stat($path)['dev'] ?? null) === $localDev,
                'is_primary' => $settings['primary'] === $key,
                'is_secondary' => $settings['secondary'] === $key,
            ];
        }
        return $result;
    }

    public function primaryKey(): string
    {
        $key = $this->settings()['primary'];
        return self::isValidTarget($key) ? $key : 'local';
    }

    public function secondaryKey(): ?string
    {
        $key = $this->settings()['secondary'];
        return $key && self::isValidTarget($key) && $key !== $this->primaryKey() ? $key : null;
    }

    // โฟลเดอร์ของปลายทาง $location (ไม่ระบุ = ปลายทางหลัก) — โยน error ถ้ายังไม่ได้เมาต์/เขียนไม่ได้
    public function directory(?string $location = null): string
    {
        $key = $location ?? $this->primaryKey();
        if (!self::isValidTarget($key)) {
            throw new RuntimeException('ปลายทางไม่ถูกต้อง');
        }
        if (!$this->targetAvailable($key)) {
            throw new RuntimeException(self::TARGET_LABELS[$key] . ' ไม่พร้อมใช้งาน (ยังไม่ได้เมาต์ หรือเขียนไฟล์ไม่ได้)');
        }
        return $this->targetPath($key);
    }

    // ทดสอบเขียน/อ่าน/ลบไฟล์เล็กๆ ในปลายทาง ก่อนตั้งเป็นปลายทางจริง
    public function testTarget(string $key): array
    {
        $dir = $this->directory($key);
        $probe = $dir . DIRECTORY_SEPARATOR . '.write_test_' . bin2hex(random_bytes(4));
        $payload = 'backup-write-test ' . Carbon::now(self::TIMEZONE)->toDateTimeString();
        if (file_put_contents($probe, $payload) === false || file_get_contents($probe) !== $payload) {
            @unlink($probe);
            throw new RuntimeException('เขียน/อ่านไฟล์ทดสอบในปลายทางนี้ไม่สำเร็จ');
        }
        unlink($probe);

        return collect($this->targets())->firstWhere('key', $key);
    }

    // ตั้งปลายทางหลัก + สำเนาที่สอง (ไม่บังคับ) — สำเนาที่สองต้องคนละที่กับปลายทางหลัก
    public function updateDestination(string $primary, ?string $secondary): array
    {
        $this->directory($primary);
        if ($secondary !== null && $secondary !== '') {
            if ($secondary === $primary) {
                throw new RuntimeException('สำเนาที่สองต้องเป็นคนละที่กับปลายทางหลัก');
            }
            $this->directory($secondary);
        } else {
            $secondary = null;
        }

        $this->saveSettings(['primary' => $primary, 'secondary' => $secondary]);
        return $this->targets();
    }

    // ชื่อไฟล์ที่อนุญาต — ใช้กัน path traversal ทุกจุดที่รับชื่อไฟล์จากผู้ใช้
    public static function isValidFileName(string $name): bool
    {
        return (bool) preg_match('/^backup_\d{8}_\d{6}_(manual|auto|prerestore)\.zip$/', $name);
    }

    public function pathFor(string $fileName, ?string $location = null): string
    {
        if (!self::isValidFileName($fileName)) {
            throw new RuntimeException('ชื่อไฟล์สำรองไม่ถูกต้อง');
        }
        return $this->directory($location) . DIRECTORY_SEPARATOR . $fileName;
    }

    // ================== สร้างไฟล์สำรอง ==================

    public function create(string $type = 'manual', ?array $by = null): array
    {
        if (!in_array($type, self::TYPES, true)) {
            throw new RuntimeException('ประเภทไฟล์สำรองไม่ถูกต้อง');
        }
        @set_time_limit(0);

        // ตรวจปลายทางหลักก่อนเริ่ม (โยน error ถ้าไม่พร้อม) — สร้างไฟล์ชั่วคราวในเครื่องเสมอ แล้วค่อยส่งไปปลายทาง
        // เพื่อไม่ให้การเขียน zip ค้างครึ่งๆ กลางๆ บน NAS/ไดรฟ์ที่หลุดระหว่างทาง
        $primary = $this->primaryKey();
        $this->directory($primary);
        $local = $this->localDirectory();
        $stamp = Carbon::now(self::TIMEZONE)->format('Ymd_His');
        $fileName = "backup_{$stamp}_{$type}.zip";
        $zipPath = $local . DIRECTORY_SEPARATOR . 'tmp_' . bin2hex(random_bytes(6)) . '.zip';
        $tmpSql = $local . DIRECTORY_SEPARATOR . 'tmp_' . bin2hex(random_bytes(6)) . '.sql';

        try {
            $stats = $this->dumpDatabase($tmpSql);

            $zip = new ZipArchive();
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new RuntimeException('สร้างไฟล์ zip ไม่สำเร็จ');
            }
            $zip->addFile($tmpSql, 'database.sql');

            $fileCount = 0;
            $publicRoot = storage_path('app/public');
            if (is_dir($publicRoot)) {
                $iterator = new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator($publicRoot, \FilesystemIterator::SKIP_DOTS),
                );
                foreach ($iterator as $file) {
                    if (!$file->isFile() || $file->getFilename() === '.gitignore') continue;
                    $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($publicRoot) + 1));
                    $zip->addFile($file->getPathname(), 'files/' . $relative);
                    $fileCount++;
                }
            }

            $manifest = [
                'version' => 1,
                'type' => $type,
                'created_at' => Carbon::now(self::TIMEZONE)->toIso8601String(),
                'created_by' => $by,
                'database' => DB::connection()->getDatabaseName(),
                'tables' => $stats['tables'],
                'total_rows' => array_sum($stats['tables']),
                'file_count' => $fileCount,
                'latest_migration' => DB::table('migrations')->orderByDesc('id')->value('migration'),
            ];
            $zip->addFromString('manifest.json', json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

            if (!$zip->close()) {
                throw new RuntimeException('บันทึกไฟล์ zip ไม่สำเร็จ');
            }

            // ส่งไปปลายทางหลัก (ต้องสำเร็จ) แล้วคัดลอกไปสำเนาที่สอง (ล้มเหลวได้ — ไม่ทำให้การสำรองล้มทั้งงาน)
            $this->publish($zipPath, $fileName, $primary);
            $copies = [];
            $secondary = $this->secondaryKey();
            if ($secondary) {
                try {
                    $this->publish($zipPath, $fileName, $secondary);
                    $copies[$secondary] = 'ok';
                } catch (\Throwable $e) {
                    $copies[$secondary] = 'error: ' . $e->getMessage();
                }
            }
        } finally {
            @unlink($zipPath);
            @unlink($tmpSql);
        }

        $info = $this->describe($fileName, $primary);
        $info['copies'] = $copies;
        return $info;
    }

    // คัดลอกไฟล์ไปปลายทาง: เขียนเป็น .part ก่อนแล้วค่อย rename (รายการไฟล์จะไม่เห็นไฟล์ที่เขียนไม่เสร็จ) + เช็กขนาดตรงกัน
    private function publish(string $sourcePath, string $fileName, string $location): void
    {
        $dir = $this->directory($location);
        $dest = $dir . DIRECTORY_SEPARATOR . $fileName;
        $part = $dest . '.part';

        if (!@copy($sourcePath, $part) || filesize($part) !== filesize($sourcePath)) {
            @unlink($part);
            throw new RuntimeException(self::TARGET_LABELS[$location] . ': คัดลอกไฟล์ไม่สำเร็จ (พื้นที่เต็มหรือปลายทางหลุด)');
        }
        if (!@rename($part, $dest)) {
            @unlink($part);
            throw new RuntimeException(self::TARGET_LABELS[$location] . ': บันทึกไฟล์ปลายทางไม่สำเร็จ');
        }
    }

    /**
     * dump ทุกตาราง (base table) เป็น SQL — คืน ['tables' => [ชื่อตาราง => จำนวนแถว]]
     * อ่านภายใต้ snapshot เดียวกัน (REPEATABLE READ) เพื่อให้ข้อมูลข้ามตารางสอดคล้องกัน
     */
    private function dumpDatabase(string $path): array
    {
        $pdo = DB::connection()->getPdo();
        $fh = fopen($path, 'w');
        if (!$fh) {
            throw new RuntimeException('เขียนไฟล์ชั่วคราวไม่ได้');
        }

        $end = self::STATEMENT_END . "\n";
        $write = fn (string $sql) => fwrite($fh, $sql . "\n" . $end);

        fwrite($fh, "-- Backup " . Carbon::now(self::TIMEZONE)->toDateTimeString() . "\n");
        $write('SET NAMES utf8mb4;');
        $write('SET FOREIGN_KEY_CHECKS=0;');
        $write('SET UNIQUE_CHECKS=0;');
        $write("SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';");

        $counts = [];
        DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        DB::statement('START TRANSACTION WITH CONSISTENT SNAPSHOT');
        try {
            $tables = array_map(
                fn ($r) => array_values((array) $r)[0],
                DB::select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"),
            );
            $schema = DB::connection()->getDatabaseName();

            foreach ($tables as $table) {
                $create = (array) DB::selectOne("SHOW CREATE TABLE `{$table}`");
                $write("DROP TABLE IF EXISTS `{$table}`;");
                $write($create['Create Table'] . ';');

                // คอลัมน์ generated (คำนวณเอง) ห้ามใส่ใน INSERT — คอลัมน์ binary ต้อง dump เป็น hex
                $columns = DB::select(
                    'SELECT COLUMN_NAME AS name, DATA_TYPE AS type, EXTRA AS extra
                     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
                    [$schema, $table],
                );
                $columns = array_values(array_filter($columns, fn ($c) => !str_contains(strtoupper($c->extra), 'GENERATED')));
                if (!$columns) {
                    $counts[$table] = 0;
                    continue;
                }
                $binary = [];
                foreach ($columns as $i => $c) {
                    if (in_array(strtolower($c->type), ['blob', 'tinyblob', 'mediumblob', 'longblob', 'binary', 'varbinary', 'bit'], true)) {
                        $binary[$i] = true;
                    }
                }
                $colList = implode(',', array_map(fn ($c) => "`{$c->name}`", $columns));

                $pk = DB::select("SHOW KEYS FROM `{$table}` WHERE Key_name = 'PRIMARY'");
                usort($pk, fn ($a, $b) => $a->Seq_in_index <=> $b->Seq_in_index);
                $orderBy = $pk ? ' ORDER BY ' . implode(',', array_map(fn ($k) => "`{$k->Column_name}`", $pk)) : '';

                $rows = 0;
                $offset = 0;
                do {
                    $chunk = $pdo->query("SELECT {$colList} FROM `{$table}`{$orderBy} LIMIT " . self::READ_CHUNK_ROWS . " OFFSET {$offset}")
                        ->fetchAll(\PDO::FETCH_NUM);
                    $offset += self::READ_CHUNK_ROWS;

                    foreach (array_chunk($chunk, self::INSERT_BATCH_ROWS) as $batch) {
                        $values = [];
                        foreach ($batch as $row) {
                            $values[] = '(' . implode(',', array_map(function ($v, $i) use ($pdo, $binary) {
                                if ($v === null) return 'NULL';
                                if (isset($binary[$i])) return $v === '' ? "''" : '0x' . bin2hex($v);
                                return $pdo->quote((string) $v);
                            }, $row, array_keys($row))) . ')';
                        }
                        $write("INSERT INTO `{$table}` ({$colList}) VALUES " . implode(',', $values) . ';');
                        $rows += count($batch);
                    }
                } while (count($chunk) === self::READ_CHUNK_ROWS);

                $counts[$table] = $rows;
            }
        } finally {
            DB::statement('COMMIT');
        }

        $write('SET FOREIGN_KEY_CHECKS=1;');
        $write('SET UNIQUE_CHECKS=1;');
        fclose($fh);

        return ['tables' => $counts];
    }

    // ================== รายการ / ลบ / ดาวน์โหลด ==================

    public function list(?string $location = null): array
    {
        $location = $location ?? $this->primaryKey();
        $items = [];
        foreach (glob($this->directory($location) . DIRECTORY_SEPARATOR . 'backup_*.zip') ?: [] as $path) {
            $name = basename($path);
            if (!self::isValidFileName($name)) continue;
            $items[] = $this->describe($name, $location);
        }
        usort($items, fn ($a, $b) => strcmp($b['file_name'], $a['file_name']));
        return $items;
    }

    public function describe(string $fileName, ?string $location = null): array
    {
        $location = $location ?? $this->primaryKey();
        $path = $this->pathFor($fileName, $location);
        $manifest = [];
        $zip = new ZipArchive();
        if ($zip->open($path) === true) {
            $raw = $zip->getFromName('manifest.json');
            if ($raw) $manifest = json_decode($raw, true) ?: [];
            $zip->close();
        }

        return [
            'file_name' => $fileName,
            'location' => $location,
            'size' => filesize($path),
            'type' => $manifest['type'] ?? 'manual',
            'created_at' => $manifest['created_at'] ?? Carbon::createFromTimestamp(filemtime($path), self::TIMEZONE)->toIso8601String(),
            'created_by' => $manifest['created_by'] ?? null,
            'total_rows' => $manifest['total_rows'] ?? null,
            'file_count' => $manifest['file_count'] ?? null,
            'table_count' => isset($manifest['tables']) ? count($manifest['tables']) : null,
        ];
    }

    public function delete(string $fileName, ?string $location = null): void
    {
        $path = $this->pathFor($fileName, $location);
        if (!is_file($path)) {
            throw new RuntimeException('ไม่พบไฟล์สำรองนี้');
        }
        unlink($path);
    }

    // เก็บเฉพาะไฟล์ auto ล่าสุด $keep ไฟล์ — ไฟล์ manual และ prerestore ไม่ลบเอง
    // ใช้กับปลายทางหลักและสำเนาที่สอง (แต่ละที่แยกกัน — ปลายทางที่ไม่พร้อมจะข้ามไป)
    public function applyRetention(int $keep): int
    {
        $removed = 0;
        foreach (array_filter([$this->primaryKey(), $this->secondaryKey()]) as $location) {
            try {
                $auto = array_values(array_filter($this->list($location), fn ($b) => $b['type'] === 'auto'));
            } catch (\Throwable $e) {
                continue;
            }
            foreach (array_slice($auto, max(1, $keep)) as $old) {
                $this->delete($old['file_name'], $location);
                $removed++;
            }
        }
        return $removed;
    }

    // ================== ตั้งค่าสำรองอัตโนมัติ ==================

    private function settingsPath(): string
    {
        return $this->localDirectory() . DIRECTORY_SEPARATOR . 'settings.json';
    }

    public function settings(): array
    {
        $defaults = [
            'enabled' => false,
            'frequency' => 'daily',   // daily | weekly
            'time' => '02:00',        // HH:MM เวลาไทย
            'weekday' => 0,           // 0=อาทิตย์ … 6=เสาร์ (ใช้เมื่อ frequency=weekly)
            'keep' => 7,              // จำนวนไฟล์ auto ที่เก็บย้อนหลัง
            'primary' => 'local',     // ปลายทางหลัก: local | ext1 | ext2
            'secondary' => null,      // สำเนาที่สอง (ไม่บังคับ): local | ext1 | ext2 คนละที่กับปลายทางหลัก
            'last_auto_run' => null,
            'last_auto_status' => null,
            'last_auto_message' => null,
        ];
        $saved = is_file($this->settingsPath()) ? (json_decode(file_get_contents($this->settingsPath()), true) ?: []) : [];
        return array_merge($defaults, $saved);
    }

    // ใช้จากหน้าเว็บ: ตรวจค่า + ตั้ง baseline (last_auto_run = ตอนนี้) เมื่อเปิดใช้งาน/เปลี่ยนเวลา
    // เพื่อไม่ให้สำรองทันทีเพียงเพราะเวลาที่ตั้งผ่านไปแล้วของวันนี้
    public function updateSettings(array $input): array
    {
        $old = $this->settings();
        $new = [
            'enabled' => (bool) $input['enabled'],
            'frequency' => $input['frequency'],
            'time' => $input['time'],
            'weekday' => (int) $input['weekday'],
            'keep' => (int) $input['keep'],
        ];
        $scheduleChanged = $new['enabled'] && (
            !$old['enabled'] || $old['frequency'] !== $new['frequency'] || $old['time'] !== $new['time'] || (int) $old['weekday'] !== $new['weekday']
        );
        if ($scheduleChanged) {
            $new['last_auto_run'] = Carbon::now(self::TIMEZONE)->toIso8601String();
        }
        return $this->saveSettings($new);
    }

    public function saveSettings(array $data): array
    {
        $settings = array_merge($this->settings(), $data);
        file_put_contents($this->settingsPath(), json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
        return $settings;
    }

    /**
     * เรียกทุกนาทีจาก scheduler — สำรองเมื่อถึงเวลาที่ตั้งไว้และยังไม่เคยรันในรอบนั้น
     * คืน null ถ้ายังไม่ถึงเวลา/ปิดอยู่, คืนข้อมูลไฟล์ถ้าสำรองสำเร็จ
     */
    public function runIfDue(?Carbon $now = null): ?array
    {
        $s = $this->settings();
        if (!$s['enabled']) return null;

        $now = ($now ?? Carbon::now(self::TIMEZONE))->copy()->setTimezone(self::TIMEZONE);
        [$h, $m] = array_map('intval', explode(':', $s['time']));
        $slot = $now->copy()->setTime($h, $m, 0);

        if ($s['frequency'] === 'weekly') {
            // ถอยไปหาวันที่ตรงกับวันในสัปดาห์ที่ตั้งไว้ (วันนี้หรือก่อนหน้า) เพื่อรองรับกรณีเครื่องปิดตอนถึงเวลา
            $slot->subDays(($slot->dayOfWeek - (int) $s['weekday'] + 7) % 7);
        }
        if ($slot->gt($now)) {
            $slot->subDays($s['frequency'] === 'weekly' ? 7 : 1);
        }

        $last = $s['last_auto_run'] ? Carbon::parse($s['last_auto_run']) : null;
        if ($last && $last->gte($slot)) return null;   // รอบนี้รันไปแล้ว

        // บันทึกเวลารันก่อนเริ่ม (ไม่ใช่หลังสำเร็จ) เพื่อไม่ให้ scheduler วนลองซ้ำทุกนาทีถ้าสำรองล้มเหลว
        $this->saveSettings(['last_auto_run' => $now->toIso8601String()]);

        try {
            $info = $this->create('auto', ['id' => null, 'name' => 'ระบบอัตโนมัติ']);
            $removed = $this->applyRetention((int) $s['keep']);
            $copyErrors = array_filter($info['copies'] ?? [], fn ($c) => $c !== 'ok');
            $this->saveSettings([
                'last_auto_status' => 'success',
                'last_auto_message' => "สำรองสำเร็จ ({$info['file_name']})"
                    . ($removed ? " ลบไฟล์เก่า {$removed} ไฟล์" : '')
                    . ($copyErrors ? ' — แต่คัดลอกสำเนาที่สองไม่สำเร็จ: ' . implode('; ', $copyErrors) : ''),
            ]);
            return $info;
        } catch (\Throwable $e) {
            $this->saveSettings(['last_auto_status' => 'failed', 'last_auto_message' => $e->getMessage()]);
            throw $e;
        }
    }

    // ================== กู้คืน ==================

    private function restoreStatusPath(): string
    {
        return $this->localDirectory() . DIRECTORY_SEPARATOR . 'restore-status.json';
    }

    public function restoreStatus(): array
    {
        return is_file($this->restoreStatusPath())
            ? (json_decode(file_get_contents($this->restoreStatusPath()), true) ?: ['state' => 'idle'])
            : ['state' => 'idle'];
    }

    public function writeRestoreStatus(array $status): void
    {
        file_put_contents($this->restoreStatusPath(), json_encode($status, JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    /**
     * กู้คืนจากไฟล์สำรอง: safety backup → ล้างทุกตาราง → โหลด SQL → คืนไฟล์อัปโหลด → migrate
     * (ควรเรียกจาก CLI ผ่าน `backup:restore` เพราะระหว่างกู้คืนตาราง token/ผู้ใช้จะถูกแทนที่)
     */
    public function restore(string $fileName, ?array $by = null, ?string $location = null): array
    {
        @set_time_limit(0);
        $path = $this->pathFor($fileName, $location);
        if (!is_file($path)) {
            throw new RuntimeException('ไม่พบไฟล์สำรองนี้');
        }

        $zip = new ZipArchive();
        if ($zip->open($path) !== true || $zip->locateName('database.sql') === false) {
            throw new RuntimeException('ไฟล์สำรองไม่ถูกต้อง (ไม่พบ database.sql)');
        }

        // safety backup ของข้อมูลปัจจุบันก่อนเสมอ — ถ้ากู้คืนแล้วผิดพลาดยังย้อนกลับได้
        $safety = $this->create('prerestore', $by);

        $tmpSql = $this->localDirectory() . DIRECTORY_SEPARATOR . 'restore_' . bin2hex(random_bytes(6)) . '.sql';
        try {
            $in = $zip->getStream('database.sql');
            $out = fopen($tmpSql, 'w');
            if (!$in || !$out) {
                throw new RuntimeException('อ่านไฟล์ฐานข้อมูลจากไฟล์สำรองไม่ได้');
            }
            stream_copy_to_stream($in, $out);
            fclose($in);
            fclose($out);

            $pdo = DB::connection()->getPdo();
            $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
            foreach (DB::select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'") as $r) {
                $name = array_values((array) $r)[0];
                $pdo->exec("DROP TABLE IF EXISTS `{$name}`");
            }

            $fh = fopen($tmpSql, 'r');
            $buffer = '';
            $statements = 0;
            while (($line = fgets($fh)) !== false) {
                if (rtrim($line, "\r\n") === self::STATEMENT_END) {
                    if (trim($buffer) !== '') {
                        $pdo->exec($buffer);
                        $statements++;
                    }
                    $buffer = '';
                } else {
                    $buffer .= $line;
                }
            }
            fclose($fh);
            $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        } finally {
            @unlink($tmpSql);
        }

        // คืนไฟล์อัปโหลด (เขียนทับ/เพิ่มไฟล์ตามที่มีในไฟล์สำรอง ไม่ลบไฟล์อื่นที่มีอยู่เดิม)
        $publicRoot = storage_path('app/public');
        $restoredFiles = 0;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (!str_starts_with($name, 'files/') || str_ends_with($name, '/')) continue;
            $relative = substr($name, strlen('files/'));
            if (str_contains($relative, '..')) continue;   // กัน zip-slip
            $target = $publicRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);
            if (!is_dir(dirname($target))) mkdir(dirname($target), 0775, true);
            file_put_contents($target, $zip->getFromIndex($i));
            $restoredFiles++;
        }
        $zip->close();

        // ไฟล์สำรองเก่ากว่า schema ปัจจุบัน → ให้ migration ที่ค้างรันต่อ
        Artisan::call('migrate', ['--force' => true]);

        return [
            'restored_from' => $fileName,
            'safety_backup' => $safety['file_name'],
            'statements' => $statements,
            'restored_files' => $restoredFiles,
        ];
    }
}
