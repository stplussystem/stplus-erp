# มาตรฐานหน้าเว็บ Frontend (system-frontend)

หน้า Next.js ใหม่ทุกหน้าใน `system-frontend/` ต้องตามมาตรฐานนี้ตั้งแต่แรก ไม่ต้องรอมารื้อทีหลัง — อ้างอิงจากโมดูล `purchase-orders` สำหรับโครงหน้าพื้นฐาน และโมดูล `sales/quotations` (list/create/edit/view+approve ครบทั้ง 4 หน้า) สำหรับ table/status badge/สี/ไอคอน/tooltip/popup เพราะเป็นโมดูลที่ตรงมาตรฐานครบสมบูรณ์ที่สุดในระบบ

## 1. โครงหน้า (Page shell)

**Wrapper นอกสุด:** มี 2 pattern ที่อนุญาต ทั้งคู่ใช้ `px-4 py-4` เหมือนกัน ต่างกันแค่ความกว้าง:
```
w-full max-w-full px-4 py-4 text-foreground        /* หน้า list/create/edit ที่มีตาราง/ฟอร์มซับซ้อน — และหน้า view/detail ที่มีตาราง item เต็มรูปแบบด้วย (ดู sales/quotations/[id]/page.tsx) */
w-full max-w-3xl mx-auto px-4 py-4 text-foreground /* หน้ารายละเอียดแบบสั้นจริงๆ ที่ไม่มีตาราง item (single-record ล้วน) */
```
เลือกตามเนื้อหา ไม่ใช่ตามชื่อหน้า — หน้า "view"/"detail" ที่มีตารางรายการสินค้าเต็มรูปแบบให้ใช้ wrapper กว้างเสมอ

**Header — มี 3 รูปแบบที่อนุญาต ตามประเภทหน้า:**

รูปแบบ (ก) หน้า list/create — icon-box เต็มรูปแบบ:
```jsx
<div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
  <div className="flex items-center gap-3">
    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
      <IconComponent className="w-6 h-6" />
    </div>
    <div>
      <h1 className="text-md font-bold tracking-tight">ชื่อหน้า</h1>
      <p className="text-slate-500 text-[11px] mt-0.5">คำอธิบายสั้นๆ</p>
    </div>
  </div>
  {/* ปุ่ม action ทั้งหมด (ย้อนกลับ/บันทึก/ฯลฯ) อยู่ฝั่งขวา ตรงข้ามกับ title เสมอ */}
  <div className="flex items-center gap-3">...</div>
</div>
```

รูปแบบ (ข) หน้า edit — icon-box แบบไม่มี border/shadow:
```jsx
<div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
  <IconComponent className="w-6 h-6" />
</div>
```

รูปแบบ (ค) หน้า view/detail — ไม่มี icon-box เลย ใช้เลขที่เอกสาร/ชื่อรายการ + status badge แทน:
```jsx
<div>
  <div className="flex items-center gap-3">
    <h1 className="text-md font-bold tracking-tight text-slate-800">{doc.document_number}</h1>
    <StatusBadge status={doc.status} />
  </div>
  <p className="text-slate-500 text-sm mt-1">สร้างเมื่อ {วันที่} โดย {ผู้สร้าง}</p>
</div>
```

- Title ทุกรูปแบบใช้ `text-md font-bold tracking-tight` ขนาดเดียวกันหมด
- ปุ่มย้อนกลับ/action ต้องอยู่ฝั่งขวา (`justify-between`) ตรงข้ามกับ title เสมอ ไม่วางไว้ข้างปุ่ม back ทางซ้าย

**การ์ด (Card) ครอบเนื้อหา:**
```
bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden   /* list/create/edit */
bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden   /* การ์ดข้อมูล/ตารางในหน้า view */
```

**การ์ด 2 คอลัมน์** (ใช้แสดงข้อมูลลูกค้า + meta เอกสารคู่กันในหน้า view):
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-0">
  <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100">
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">หัวข้อฝั่งซ้าย</h3>
    ...
  </div>
  <div className="p-6 bg-slate-50/50">
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">หัวข้อฝั่งขวา</h3>
    ...
  </div>
</div>
```

## 2. ปุ่ม (Buttons)

โปรเจกต์นี้**ไม่ได้**ใช้ component กลาง `<Button>` เป็นมาตรฐาน — เขียน `<button className="...">` ตรงๆ ตาม pattern นี้:

**ปุ่มหลัก (primary action)** เช่น "บันทึก", "สร้าง...", "อนุมัติเอกสาร":
```
flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50
```
(สีอื่นที่ไม่ใช่ primary เปลี่ยนแค่ชื่อสี เช่น `green-600`/`red-600` + shadow สีเดียวกัน)

**ปุ่มรอง (outline/secondary)** เช่น "ย้อนกลับ", "ตัวอย่าง PDF", "แก้ไขเอกสาร":
```
flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform
```

**ปุ่มไอคอนในตาราง** (พิมพ์/แก้ไข/ลบ/อนุมัติ/ยกเลิก ในแถวข้อมูล) — `rounded-xl` ไม่ใช่ `rounded-full` ไม่มีเงา สีตาม section 6:
```
p-2 text-slate-400 hover:text-{สี}-600 hover:bg-{สี}-50 rounded-xl transition-colors cursor-pointer
```

**ปุ่มใน Dialog/Modal** (ยืนยัน/ยกเลิก) — `rounded-xl`, `h-12`, `flex-1`:
```
flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 font-bold cursor-pointer transition-all
```

**กฎรวม:** ปุ่มทุกแบบต้องมี `cursor-pointer` และ `transition-all` (หรือ `transition-colors` สำหรับปุ่มไอคอน) เสมอ ปุ่มที่ disable ได้ต้องมี `disabled:opacity-50`

## 3. Input / Select / วันที่ / สถานะโหลด

**Input พื้นฐาน:**
```
w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm
```

**บังคับใช้ component กลาง 3 ตัวนี้เสมอ** สำหรับ dropdown ตัวเลือกคงที่/ช่องวันที่/สถานะโหลด:

- **`AppSelect`** (`@/components/ui/app-select`) — dropdown ตัวเลือกคงที่ (filter สถานะ, เลือก tax_type, ฯลฯ)
  ```tsx
  <AppSelect
    value={value}
    onValueChange={setValue}
    options={[{ value: "a", label: "ตัวเลือก A" }]}
    placeholder="-- เลือก --"
    error={!!errors.field}
  />
  ```
- **`AppDatePicker`** (`@/components/ui/app-date-picker`) — ทุกช่องวันที่ ห้ามใช้ `<input type="date">` ดิบๆ
  ```tsx
  <AppDatePicker value={formData.date} onChange={(v) => setFormData({ ...formData, date: v })} />
  ```
- **`AppLoading`** (`@/components/ui/app-loading`) — ทุกสถานะกำลังโหลด (แทน `<Loader2 className="animate-spin" />` เขียนเอง)
  ```tsx
  if (loading) return <AppLoading />;
  // หรือระหว่างบันทึก: <AppLoading text="กำลังบันทึกเอกสาร..." minHeight="min-h-0" />
  ```

สำหรับ dropdown ค้นหาแบบ custom (เช่น `ContactSearchDropdown`, `ProductSearchDropdown`) ที่ค้นหาข้อมูลแบบ type-ahead จากรายการยาว — ใช้ component เฉพาะที่มีอยู่แล้ว ไม่ใช่ `AppSelect` (คนละ use case กัน)

## 4. Validation error (ฟอร์มที่บันทึกข้อมูลจริงเท่านั้น)

1. เก็บ error ทั้งฟอร์มไว้ใน state เดียว: `const [errors, setErrors] = useState<Record<string, string>>({})`
2. Input ปกติ: ต่อท้าย className ด้วย `border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100` เมื่อมี error (ใช้ `cn()` จาก `@/lib/utils`)
3. Component กลาง (`AppSelect`, `ContactSearchDropdown`, `ProductSearchDropdown`) ใช้ prop `error`/`hasError` แทนการแต่ง className เอง
4. แสดงข้อความ error ใต้ช่องเสมอ: `{errors.field && <p className="text-red-500 text-xs font-medium mt-1">{errors.field}</p>}`
5. เคลียร์ error ของ field ทันทีที่ user แก้ไขค่าใหม่ (ไม่ต้องรอ submit ซ้ำ)
6. **เฉพาะฟอร์ม create/edit/dialog เท่านั้น** — หน้า list/filter ปรับแค่ style ไม่ต้องมี error state

## 5. ตาราง (Table)

มี 3 pattern แยกตามบริบท (ดูตัวอย่างจริงใน `sales/quotations`):

**(ก) ตาราง list** (`page.tsx` หลักของแต่ละโมดูล):
```
thead: text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200
th:    px-6 py-4 font-bold   (+ text-right / text-center ตามคอลัมน์)
tbody: divide-y divide-slate-100
tr:    hover:bg-slate-50/80 transition-colors
```

**(ข) ตาราง item-entry ในฟอร์ม create/edit** (รายการสินค้า):
```
thead:        bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200
th:           px-4 py-3 font-bold  (+ width คงที่ต่อคอลัมน์ เช่น w-24, w-32)
input cell:   w-full h-10 text-center|text-right border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100
              (ช่องส่วนลดเพิ่ม text-red-500)
ช่องรวมต่อแถว: px-4 py-3 text-right font-bold text-slate-700 bg-slate-50/50
ปุ่มเพิ่มแถว:   text-blue-600 text-sm font-bold flex items-center gap-1.5 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors cursor-pointer
```
ช่องค้นหาสินค้า (`ProductSearchDropdown`) วางคู่กับปุ่ม "ดูรายการขายล่าสุด" (ถ้ามี) ใน `flex items-center gap-1.5` — dropdown ใช้ `flex-1`

**(ค) ตาราง read-only ในหน้า view:**
```
thead:          bg-white text-slate-600 text-xs uppercase border-b border-slate-200
th:             px-6 py-4   (ไม่มี font-bold)
ชื่อสินค้า:      font-bold text-slate-800
รหัสสินค้า:      text-xs text-slate-500 mt-1
ยอดรวมท้ายตาราง: p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end
                กล่องสรุป: w-full max-w-xs space-y-2
```

**คอลัมน์ "จัดการ"** (ทุก pattern ตาราง): wrapper `flex items-center justify-center gap-1` ปุ่มไอคอนแต่ละปุ่ม**ต้อง**ห่อด้วย `<AppTooltip label="...">` (ดู section 8) แทนการใส่ `title=` ตรงๆ

## 5.1 Pagination

ทุกหน้า list ที่มี pagination ต้องใช้ **`AppPagination`** (`@/components/ui/app-pagination`) เท่านั้น — ห้ามเขียนปุ่ม "ก่อนหน้า/ถัดไป" หรือข้อความสรุปจำนวนเองใหม่ (สไตล์ปุ่มอ้างอิงจาก `sales/quotations`, ตำแหน่ง/ข้อความสรุป/disabled logic อ้างอิงจาก `stock-movements`):

```tsx
<AppPagination
  currentPage={currentPage}
  lastPage={lastPage}       // Math.ceil(total / perPage) ถ้าเป็น client-side
  total={total}
  perPage={perPage}
  onPageChange={setCurrentPage}   // หรือ (p) => router.push(`?page=${p}`) ถ้า URL-driven
/>
```

- วางไว้**นอกตารางเสมอ** ด้านล่างสุดของการ์ดที่ครอบตาราง (component มี `mt-6` ในตัวเองแล้ว ไม่ต้องเพิ่ม wrapper อีกชั้น) ไม่แสดงอะไรเลยถ้า `total<=0` (จัดการในตัว component แล้ว)
- **ถ้า backend ยังไม่มี `paginate()` จริง** ให้ทำแบบ client-side: `useState(currentPage)` + `itemsPerPage` คงที่ (ปกติ 15) + `.slice()` หลังกรอง/ค้นหาเสร็จแล้วเท่านั้น (ตัวอย่าง `warehouses/page.tsx`, `purchase-orders/page.tsx`) — **ต้อง reset `currentPage` กลับเป็น 1 ทุกครั้งที่ค่าค้นหา/filter เปลี่ยน** ด้วย `useEffect` (ดูตัวอย่าง `purchase-orders/page.tsx:88-90`) ไม่งั้นค้นหาแล้วอาจค้างอยู่หน้าที่ไม่มีข้อมูล
- **ถ้า backend มี `paginate()` จริงอยู่แล้ว** (เก็บเลขหน้าไว้ที่ URL ผ่าน `useSearchParams`) ให้ `onPageChange` เรียก `router.push` เปลี่ยน query `page` แทน (ตัวอย่าง `products/page.tsx`) — คง query param อื่นที่มีอยู่เดิม (search/filter) ไว้ในการ build href ด้วยเสมอ
- **อย่าเปลี่ยนหน้าที่มีช่องค้นหาแบบ client-side (`.filter()` บน array ที่โหลดมาทั้งหมด) ให้ไปพึ่ง backend `paginate()` โดยพลการ** — ถ้า backend endpoint นั้นไม่มีความสามารถค้นหาฝั่ง server ด้วย การสลับไปพึ่ง `page`/`per_page` ตรงๆ จะทำให้ค้นหาได้แค่ในหน้าที่โหลดมาเท่านั้น (พังทันที) ให้ใช้ client-side pagination (ข้อด้านบน) แทนจนกว่าจะมีการเพิ่มระบบค้นหาฝั่ง backend คู่กัน

## 6. สี (Color palette)

ใช้สีตามความหมายนี้เท่านั้น ห้ามเลือกสีใหม่เองตามใจ:

| สี (Tailwind token) | ความหมาย / ใช้ที่ไหน |
|---|---|
| `blue-600` | แอ็กชันหลัก (ปุ่ม primary), อนุมัติ, สร้างเวอร์ชันใหม่ (revise), tax_type badge |
| `indigo-400` / `indigo-600` | พิมพ์/พรีวิว PDF, ปุ่ม "ดูรายการขายล่าสุด" |
| `amber-500` / `amber-600` | ไอคอนแก้ไข, สถานะ "รออนุมัติ" (Pending) |
| `green-600` | ไอคอน/badge สถานะ "อนุมัติแล้ว" (Approved) |
| `orange-500` | ยกเลิกเอกสาร (ไอคอน+ปุ่ม) |
| `red-500` / `red-600` | ลบ, อันตราย/ทำลายถาวร, ตัวเลขส่วนลด |
| `purple-600` | สถานะ "ถูกสร้างเวอร์ชันใหม่แล้ว" (Revised) |
| `slate-400` / `slate-500` / `slate-700` | สีกลาง/ข้อความรอง/ไอคอนปิดใช้งานเริ่มต้น |

## 7. ไอคอน (Icon legend)

ใช้ `lucide-react` ไอคอนเดิมสำหรับความหมายเดิมเสมอ ห้ามสลับไอคอนคนละความหมายกัน:

| ไอคอน | ความหมาย |
|---|---|
| `Printer` | พิมพ์เอกสาร |
| `CopyPlus` | สร้างเวอร์ชันใหม่ (Revise) |
| `Edit2` | แก้ไข |
| `CheckCircle2` | อนุมัติ |
| `XCircle` | ยกเลิก / ปิด modal |
| `Trash2` | ลบ |
| `History` | ดูประวัติ (เช่นรายการขายล่าสุด) |
| `FileText` | เอกสาร PDF |
| `ArrowLeft` | ย้อนกลับ |
| `Loader2` (+ `animate-spin`) | กำลังโหลด/กำลังดำเนินการ |
| `Clock` | สถานะรออนุมัติ (Pending) |
| `RefreshCw` | สถานะถูกสร้างเวอร์ชันใหม่แล้ว (Revised) |
| `AlertTriangle` | คำเตือนใน popup ยืนยัน |
| `FileBox` | ไอคอนหัวข้อหน้า list/create |
| `Save` | บันทึก |
| `Plus` | เพิ่มรายการ/แถว |

## 8. Tooltip

ทุกจุดที่ต้องมี tooltip (เช่นปุ่มไอคอนในคอลัมน์ "จัดการ") ให้ใช้ `AppTooltip` (`@/components/ui/app-tooltip`)
ที่ดึงสไตล์มาจาก tooltip เมนู `AppLayout` ตอนย่อ (sidebar collapsed) — **ห้าม**ใช้ native `title=` attribute
หรือ import shadcn/Radix Tooltip ใหม่:
```tsx
<AppTooltip label="แก้ไข" side="top">
  <button ...><Edit2 className="w-4 h-4" /></button>
</AppTooltip>
```
`side="top"` เหมาะกับปุ่มไอคอนแนวนอนในตาราง (ใช้เป็นค่า default ในทุกจุดของ `sales/quotations`), `side="left"` เหมาะกับเมนูแนวตั้งชิดขอบซ้าย (ตามต้นแบบ `AppLayout`)

## 9. Popup / Dialog

**(ก) Confirm Dialog** (แทน `confirm()`/`prompt()`) — **ห้าม**ใช้ browser-native `confirm()`/`prompt()`/`alert()` อีกต่อไป
ใช้ `AppConfirmDialog` (`@/components/ui/app-confirm-dialog`) แทนทุกจุด (อนุมัติ/ยกเลิก/สร้างเวอร์ชันใหม่ ฯลฯ)
กรณีต้องการช่องกรอกเหตุผลเพิ่มเติม (เช่นเหตุผลยกเลิก) ส่งผ่าน `children`:
```tsx
<AppConfirmDialog
  open={isCancelOpen}
  onOpenChange={setIsCancelOpen}
  icon={AlertTriangle}
  iconColorClass="bg-orange-50 text-orange-600 border-orange-100/50"
  title="ยกเลิกเอกสาร?"
  description={<>ยืนยันยกเลิกใบเสนอราคาเลขที่ <b>{doc.document_number}</b> ใช่หรือไม่?</>}
  confirmLabel="ยืนยันยกเลิก"
  confirmColorClass="bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
  onConfirm={executeCancel}
  loading={isCancelling}
>
  <input type="text" placeholder="เหตุผลในการยกเลิก" value={reason} onChange={(e) => setReason(e.target.value)} />
</AppConfirmDialog>
```

**(ข) Delete Dialog** — การลบเป็นแอ็กชันทำลายถาวร ใช้ shadcn `Dialog` เดิมของระบบ (ไม่ใช่ `AppConfirmDialog`):
```tsx
<DialogContent className="max-w-sm rounded-3xl p-8 text-center bg-white border-0 shadow-2xl [&>button]:hidden">
  <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-100/50">
    <Trash2 className="w-10 h-10" />
  </div>
  ...
</DialogContent>
```

**(ค) PDF-preview iframe modal** (ปุ่ม "ตัวอย่าง PDF"/"พิมพ์"):
```jsx
<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
  <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">...</div>
    <div className="flex-1 bg-slate-100 p-2">
      <iframe src={previewUrl} className="w-full h-full rounded-xl border border-slate-200" title="PDF Preview" />
    </div>
  </div>
</div>
```
ถ้าหน้าเดียวกันมี modal อื่นซ้อนอยู่แล้ว (เช่นหน้า view ที่มี `SalesHistoryModal` ของตัวเองอยู่ที่ `z-[100]`/`z-[110]`) ให้ขยับ PDF-preview modal เป็น `z-[120]` เพื่อให้ลอยอยู่บนสุดเสมอ

**(ง) History/Lookup Modal** (ต้นแบบ `SalesHistoryModal.tsx` — ดูประวัติ/ค้นหาข้อมูลอ้างอิงแบบเป็น popup):
```
overlay: fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4
panel:   bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200
empty state: py-10 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200
```
ถ้ากดรายการในนี้แล้วต้องเปิด PDF preview ต่อ ให้ modal ลูกใช้ `z-[110]` (สูงกว่า modal แม่)

## 10. ตัวอักษร (Text style)

| องค์ประกอบ | className |
|---|---|
| Title หน้า | `text-md font-bold tracking-tight` |
| Subtitle/คำอธิบายหน้า | `text-slate-500 text-[11px] mt-0.5` |
| หัวข้อในการ์ดข้อมูล (view page) | `text-xs font-bold text-slate-400 uppercase tracking-wider` |
| Label ฟอร์ม | `text-xs font-medium text-slate-500 mb-1` |
| หัวตาราง | `text-xs uppercase` (ดูสี/weight เต็มใน section 5 ตาม pattern) |
| ตัวเลขเงิน | จัดชิดขวา (`text-right`) เสมอ, format ด้วย `.toLocaleString(undefined, { minimumFractionDigits: 2 })` เสมอ |
| ยอดรวมสุทธิ (เน้น) | `text-lg font-black text-slate-800` (ในฟอร์ม create/edit) หรือ `text-base font-bold` (ในหน้า view) |
| ข้อความ status badge | `text-xs font-bold` |

## 11. สถานะการใช้งานจริง (rollout status)

| โมดูล | Padding/Title | ปุ่ม | AppSelect/AppLoading/AppDatePicker |
|---|---|---|---|
| **Purchase Orders** (list/create/edit/view) | ✅ | ส่วนใหญ่ตรง (มีปุ่มเล็กๆ 2-3 จุดยังใช้ radius/class ไม่ตรงเป๊ะ รอ retrofit) | ✅ |
| **Tier 1**: repairs, installations, warehouses, permissions, movements, reports (repairs-summary/frequently-repaired-products/serial-history), products, users (+trash) | ✅ | ✅ | ✅ |
| **Tier 2**: roles, contacts (list/create/edit), goods-receipts (list/create/create-direct), projects (list/create/edit/view), profile | ✅ | ✅ | ✅ |
| **Tier 2**: company | ✅ | ✅ (tab button `rounded-4xl`→`rounded-full`) | ✅ (shadcn `<Select>` 4 จุดแปลงเป็น `AppSelect` แล้ว) |
| **Tier 3**: sales/\* ทั้ง 8 ประเภท (quotations, billing-invoices, tax-invoices, cash-sales, receipts, credit-notes, debit-notes, delivery-notes — list/create/edit ครบทุกไฟล์) | ✅ | ✅ | ✅ |
| **กรณีพิเศษ**: stock/in, stock/out (หน้า hub เลือกโหมดรับ/เบิก) | ✅ | ✅ | ✅ (loading state) |
| settings, dashboard | ✅ | ✅ | ✅ |
| stock/in/single, stock/in/multi, stock/out/single, stock/out/multi | 🗑️ ลบแล้ว — เป็น route กำพร้าไม่มีลิงก์เรียกใช้จากที่ไหนในระบบ (ตรวจ grep ทั้ง repo ยืนยันแล้ว) ลบพร้อมไฟล์ backup ที่เกี่ยวข้อง (`page copy.tsx` ×2, `_components/SerialManager.tsx` ในเส้นทางนั้น, `StockMovementForm copy.tsx`, `MultiStockMovementForm copy.tsx`) — component หลักที่ยังใช้จริง (`StockMovementForm.tsx`, `MultiStockMovementForm.tsx`, `SerialManager.tsx` ใน `components/stock/`) ไม่แตะ | | |
| **sales/quotations** (list/create/edit/view+approve) | ✅ | ✅ | ✅ — **Reference implementation เต็มรูปแบบ**: table (section 5), สี (section 6), ไอคอน (section 7), Tooltip (section 8), Popup ทุกแบบ (section 9), ตัวอักษร (section 10) ครบทุกข้อ | | |
| **sales/\*** อีก 10 โมดูล (billing-invoices, tax-invoices, cash-sales, receipts, credit-notes, debit-notes, delivery-notes, custom-quotations, stock-issues, stock-returns) | ✅ | ✅ | ✅ — Retrofit ครบตาม `.claude/docs/sales-document-retrofit-checklist.md` แล้ว: `AppTooltip`/`AppConfirmDialog` แทน native `title=`/`confirm()`/`prompt()` ครบทุกไฟล์ list (ปุ่มพิมพ์/revise/แก้ไข/อนุมัติ/ยกเลิก/ลบ), create/edit ตรวจแล้วใช้ `AppSelect`/`AppDatePicker`/`AppLoading` ถูกต้องอยู่แล้วไม่ต้องแก้ (`custom-quotations` คงธีม fuchsia และ custom logo upload UI ของตัวเองไว้ทั้งหมด) | | |

**สถานะ rollout ของ `AppPagination` (section 5.1)**: ใช้ครบทุกหน้า list ที่มี pagination แล้วทั้งโปรเจกต์ (24 ไฟล์) ณ วันที่ทำ — `sales/quotations, sales/billing-invoices, sales/tax-invoices, sales/cash-sales, sales/receipts, sales/credit-notes, sales/debit-notes, sales/delivery-notes, sales/custom-quotations, sales/custom-cash-sales, sales/stock-issues, sales/stock-returns, sales/material-issues, sales/invoices, loans/returns, loans/issues, government-contracts, contractor-work-orders` (client-side pagination ใหม่ทั้งหมด — เดิมปุ่มเป็น dead UI ไม่ทำงาน), `warehouses, goods-receipts, purchase-orders, users, contacts` (มี client-side pagination ทำงานอยู่แล้ว สลับมาใช้ UI กลาง), `products` (URL-driven ผ่าน backend `paginate()` จริง สลับมาใช้ UI กลาง) — ยกเว้น `assets/page.tsx` ที่ยังไม่มี pagination เลย (ข้อมูลน้อย ยังไม่จำเป็น) หน้าใหม่ที่สร้างต่อจากนี้ให้ใช้ `AppPagination` ตั้งแต่แรกตาม section 5.1 เสมอ

อัปเดตตารางนี้ทุกครั้งที่ทำโมดูลใดให้ตรงมาตรฐานครบแล้ว

**หมายเหตุ**: `roles/page.tsx` และ `TrashUserDialog.tsx`, `company/letter-layout/page.tsx` retrofit ครบแล้ว (Tooltip/Popup
ตาม section 8-9) — ส่วน `products/page.tsx` (`ProductActions.tsx`) ตรวจแล้วไม่ต้องแก้ เพราะใช้ dropdown menu ที่มีข้อความกำกับ
อยู่แล้วและ delete dialog ตรง pattern section 9(ข) อยู่แล้ว

---
*เพิ่ม/แก้กฎได้โดยแก้ไฟล์นี้ตรงๆ ไม่มีขั้นตอนพิเศษ — แก้แล้วมีผลตั้งแต่ session ถัดไปทันที*
