<?php

namespace App\Http\Middleware;

use App\Models\ActivityLog;
use App\Models\Contact;
use App\Models\Product;
use App\Models\SaleDocument;
use App\Models\User;
use App\Support\ActivityActionLabeler;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

// 🕵️ บันทึก audit trail อัตโนมัติทุก request ที่แก้ไขข้อมูล (POST/PUT/PATCH/DELETE) ของทุกโมดูล
// โดยไม่ต้องแก้โค้ดใน controller ทีละจุด — ทำงานใน terminate() (หลังส่ง response กลับไปแล้ว) เพื่อไม่ให้
// การเขียน log กระทบความเร็วของ request จริงที่ user เห็นเลยแม้แต่มิลลิวินาทีเดียว
class LogActivity
{
    // เส้นทางที่ไม่ต้องบันทึก log ซ้ำ/ไม่มีประโยชน์พอจะเก็บ
    private const EXCLUDED_PATH_PREFIXES = [
        'api/logout', // มีการบันทึก action 'auth.logout' แบบระบุชัดเจนใน AuthController อยู่แล้ว ไม่ต้องให้ middleware นี้จับซ้ำ
        'api/notifications', // กด "อ่านแล้ว" ถี่มาก ไม่ใช่ "การกระทำ" ที่มีความหมายเชิง audit
    ];

    // 🎯 โมดูลสำคัญที่ผู้ใช้ขอให้แสดงชื่อเฉพาะเจาะจงของรายการที่โดนกระทำ (ทางเลือกที่คุ้มที่สุด — ไม่ทำทุก
    // โมดูล เพื่อจำกัดภาระ dev/ผลกระทบ performance) โมดูลอื่นนอกจากนี้ยังคงใช้แค่ label ทั่วไปจาก
    // ActivityActionLabeler เหมือนเดิมทุกประการ ไม่ได้รับผลกระทบเลย
    private const NAME_FIELDS = [
        'contacts' => 'business_name',
        'products' => null, // กรณีพิเศษ: ประกอบจาก sku+name เอง ดู resolveDisplayName()
        'users' => 'name',
        'sale-documents' => 'document_number',
    ];

    private const MODEL_CLASSES = [
        'contacts' => Contact::class,
        'products' => Product::class,
        'users' => User::class,
        'sale-documents' => SaleDocument::class,
    ];

    // ชื่อ route parameter ของแต่ละโมดูล (ต่างกันเพราะ contacts/products/users ใช้ {resource} แต่
    // sale-documents ใช้ {id} เฉยๆ) fetchSubjectName() จะลองชื่อนี้ก่อน แล้ว fallback ไปลอง 'id' เผื่อ
    // sub-route บางเส้นทาง (เช่น users/{id}/force) ใช้ชื่อพารามิเตอร์ไม่ตรงกับ resource หลัก
    private const ROUTE_PARAM_NAMES = [
        'contacts' => 'contact',
        'products' => 'product',
        'users' => 'user',
        'sale-documents' => 'id',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        // 🛡️ ต้องดักจับชื่อของรายการที่กำลังจะถูกลบไว้ "ก่อน" controller ทำงานเสมอ เพราะพอลบเสร็จ
        // ข้อมูลก็หายไปแล้ว รอไปดึงตอน terminate() (หลัง response) ไม่ทันแน่นอน — เฉพาะ 4 โมดูลด้านบน
        // และเฉพาะ DELETE เท่านั้น (POST/PUT/PATCH ข้อมูลยังอยู่ต่อ ไปดึงตอน terminate() ทีหลังได้)
        if ($request->method() === 'DELETE') {
            $resource = $this->resourceFromPath($request->path());
            if ($resource !== null) {
                $request->attributes->set(
                    'activity_subject_name',
                    $this->fetchSubjectName($resource, $request)
                );
            }
        }

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        if (!in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            return;
        }

        $user = $request->user();
        if (!$user) {
            return;
        }

        $path = $request->path();
        foreach (self::EXCLUDED_PATH_PREFIXES as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return;
            }
        }

        try {
            // 🗣️ แปลง method+path เป็นคำอธิบายภาษาไทยอ่านง่าย (เช่น "ลบข้อมูลผู้ติดต่อ") ครอบคลุมทุกโมดูล
            // — ดู ActivityActionLabeler สำหรับวิธีเพิ่ม label ของ route ใหม่ในอนาคต
            $action = ActivityActionLabeler::resolve($request->method(), $path);

            $subjectName = $this->resolveSubjectName($request);
            if ($subjectName) {
                $action .= ': ' . $subjectName;
            }

            ActivityLog::create([
                'company_id' => $user->company_id,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_email' => $user->email,
                'method' => $request->method(),
                'path' => $path,
                'action' => $action,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // 🛡️ log ล้มเหลวต้องไม่ทำให้อะไรพังต่อ (response ถูกส่งไปแล้วตั้งแต่ก่อนเข้า terminate() ด้วยซ้ำ)
            Log::warning('บันทึก activity log ไม่สำเร็จ: ' . $e->getMessage());
        }
    }

    // หาชื่อเฉพาะเจาะจงของรายการที่โดนกระทำ (4 โมดูลสำคัญเท่านั้น) แยกวิธีตาม HTTP method:
    // - DELETE: ใช้ค่าที่ pre-fetch ไว้ใน handle() แล้ว (ข้อมูลจริงถูกลบไปแล้วตอนนี้)
    // - PUT/PATCH: ข้อมูลยังอยู่ในฐานข้อมูล (แค่ถูกแก้ไข ไม่ได้ถูกลบ) ดึงสดได้เลยตอนนี้
    // - POST: ยังไม่มี record ให้ดึง (หรือถ้าเป็น action ย่อยอื่นที่ไม่ใช่ store ก็ไม่มี record ใหม่ตรงๆ)
    //   ใช้ค่าที่ผู้ใช้กรอกส่งมาในฟอร์มแทน ซึ่งมีชื่ออยู่แล้วโดยไม่ต้อง query เพิ่มเลย
    private function resolveSubjectName(Request $request): ?string
    {
        $resource = $this->resourceFromPath($request->path());
        if ($resource === null) {
            return null;
        }

        return match ($request->method()) {
            'DELETE' => $request->attributes->get('activity_subject_name'),
            'PUT', 'PATCH' => $this->fetchSubjectName($resource, $request),
            'POST' => $this->nameFromRequestInput($resource, $request),
            default => null,
        };
    }

    private function resourceFromPath(string $path): ?string
    {
        $trimmed = preg_replace('#^api/#', '', $path);
        $first = explode('/', $trimmed)[0] ?? '';
        return isset(self::MODEL_CLASSES[$first]) ? $first : null;
    }

    // ลอง route parameter ที่ Laravel resolve เป็น Eloquent model ให้แล้วก่อน (implicit route-model
    // binding ของ Product/User — ไม่ต้อง query เพิ่มเลย เพราะ SubstituteBindings ของ framework รันก่อน
    // middleware ตัวนี้เสมอ) ถ้าไม่ใช่ (Contact/SaleDocument รับ raw id เอง ไม่มี implicit binding)
    // ค่อย query เองด้วย id ที่ได้
    private function fetchSubjectName(string $resource, Request $request): ?string
    {
        $modelClass = self::MODEL_CLASSES[$resource] ?? null;
        if ($modelClass === null) {
            return null;
        }

        $paramNames = array_unique(array_filter([self::ROUTE_PARAM_NAMES[$resource] ?? null, 'id']));
        foreach ($paramNames as $paramName) {
            $bound = $request->route($paramName);
            if ($bound instanceof Model) {
                return $this->displayName($resource, $bound);
            }
            if ($bound) {
                $record = $modelClass::find($bound);
                if ($record) {
                    return $this->displayName($resource, $record);
                }
            }
        }

        return null;
    }

    // ตอนสร้างใหม่ (POST) record ยังไม่มี — อ่านชื่อจากสิ่งที่ผู้ใช้กรอกส่งมาในฟอร์มแทน (มีอยู่แล้วใน
    // request payload ไม่ต้อง query อะไรเลย)
    private function nameFromRequestInput(string $resource, Request $request): ?string
    {
        return match ($resource) {
            'products' => trim(($request->input('sku') ?? '') . ' - ' . ($request->input('name') ?? ''), ' -') ?: null,
            default => $request->input(self::NAME_FIELDS[$resource] ?? '') ?: null,
        };
    }

    private function displayName(string $resource, Model $record): ?string
    {
        if ($resource === 'products') {
            $sku = $record->sku ?? '';
            $name = $record->name ?? '';
            $combined = trim($sku . ' - ' . $name, ' -');
            return $combined ?: null;
        }

        $field = self::NAME_FIELDS[$resource] ?? null;
        return $field ? ($record->{$field} ?? null) : null;
    }
}
