# Checklist: แก้ไฟล์เอกสารขายเดิมให้ตรงมาตรฐาน UI ใหม่

ใช้คู่กับ `.claude/docs/frontend-page-template.md` (เลข section ที่อ้างในเช็คลิสต์นี้ตรงกับไฟล์นั้น) — **`sales/quotations`
คือ reference implementation ที่ผ่านครบทุกข้อแล้ว** เปิด 4 ไฟล์นี้เทียบข้างๆ ระหว่างตรวจแก้แต่ละโมดูล:
- `system-frontend/src/app/sales/quotations/page.tsx` (list)
- `system-frontend/src/app/sales/quotations/create/page.tsx` (create)
- `system-frontend/src/app/sales/quotations/[id]/edit/page.tsx` (edit)
- `system-frontend/src/app/sales/quotations/[id]/page.tsx` (view/detail + อนุมัติ)

## ขอบเขต

เช็คลิสต์นี้ครอบคลุม**เฉพาะการปรับ UI/style ของไฟล์ที่มีอยู่แล้ว** (สี/ปุ่ม/ไอคอน/tooltip/popup/table/ตัวอักษร) ให้ตรง
`frontend-page-template.md` เท่านั้น

**นอกขอบเขต (ห้ามทำในรอบนี้ ไม่ใช่ "แก้ไฟล์เดิม"):**
- โมดูลอื่นทั้ง 10 **ยังไม่มีหน้า view/detail+approve เลย** (มีแค่ list/create/edit) — การสร้างหน้า view+approve ใหม่ให้
  โมดูลเหล่านี้ (ตามที่ทำให้ quotations) เป็น**ฟีเจอร์ใหม่** ไม่ใช่การแก้ไฟล์เดิม ต้องขอเป็นงานแยกต่างหาก
- ปุ่ม "อนุมัติ" ที่หน้า list ของโมดูลอื่นยังคง**พฤติกรรมเดิม** (ยิง API อนุมัติทันทีที่หน้า list ไม่ navigate ไปหน้า view เพราะยังไม่มี
  หน้า view) — เช็คลิสต์นี้แค่เปลี่ยน `confirm()` เดิมเป็น `AppConfirmDialog` เท่านั้น ไม่เปลี่ยน flow การ navigate

## รายชื่อ 10 โมดูลที่ต้องตรวจ

- [x] `sales/billing-invoices` (list/create/edit) — **เสร็จแล้ว**
- [x] `sales/tax-invoices` (list/create/edit) — **เสร็จแล้ว**
- [x] `sales/cash-sales` (list/create/edit) — **เสร็จแล้ว**
- [x] `sales/receipts` (list/create/edit) — **เสร็จแล้ว**
- [x] `sales/credit-notes` (list/create/edit) — **เสร็จแล้ว**
- [x] `sales/debit-notes` (list/create/edit) — **เสร็จแล้ว**
- [x] `sales/delivery-notes` (list/create/edit) — **เสร็จแล้ว**
- [x] `sales/custom-quotations` (list/create/edit) — มีธีมโลโก้/หัวกระดาษเป็นของตัวเอง อย่าไปแตะส่วนนั้น แก้แค่ UI ปุ่ม/ตาราง/tooltip/popup — **เสร็จแล้ว** (คงธีม fuchsia และ custom logo upload UI ไว้ทั้งหมด แก้แค่ tooltip/popup)
- [x] `sales/stock-issues` (list/create/edit) — ไม่มีปุ่มพิมพ์ อย่าเพิ่มเอง — **เสร็จแล้ว**: list ใช้ AppTooltip/AppConfirmDialog ครบ, create/edit ตรวจแล้วไม่มี confirm()/title=/type=date ที่ต้องแก้
- [x] `sales/stock-returns` (list/create/edit) — ไม่มีปุ่มพิมพ์ อย่าเพิ่มเอง — **เสร็จแล้ว**: list ใช้ AppTooltip/AppConfirmDialog ครบ, create/edit ตรวจแล้วไม่มี confirm()/title=/type=date ที่ต้องแก้

## Checklist ต่อไฟล์ — หน้า List (`page.tsx`)

- [ ] Wrapper ตรง section 1 (`w-full max-w-full px-4 py-4 text-foreground`), header ตรงรูปแบบ (ก)
- [ ] ปุ่ม primary/secondary ใน header ตรง className section 2 เป๊ะ (จุดที่มักเพี้ยน: ปุ่ม outline บางที่ใช้
      `hover:bg-slate-50 hover:border-slate-300` ผสมกับ `hover:bg-slate-200` — เลือกให้ตรงกับ section 2 ให้เหมือนกันทุกโมดูล)
- [ ] ตาราง list ตรง pattern section 5(ก) — `thead`/`th`/`tbody`/`tr` class ครบ
- [ ] Status badge ใช้สี 4 สถานะตาม section 6 ครบ (Pending=amber, Approved=green, Cancelled=red, Revised=purple)
      — ห้ามใช้สีอื่นนอกชุดนี้
- [ ] คอลัมน์ "จัดการ": ปุ่มไอคอนทุกปุ่มห่อด้วย `<AppTooltip label="...">` (import จาก `@/components/ui/app-tooltip`)
      แทน native `title=` เดิม
- [ ] ไอคอนแต่ละปุ่มตรงความหมายตาม section 7 (พิมพ์=`Printer`, แก้ไข=`Edit2`, อนุมัติ=`CheckCircle2`, ยกเลิก=`XCircle`,
      ลบ=`Trash2`, revise=`CopyPlus`) — สีของแต่ละปุ่มตรง section 6
- [ ] `confirm()`/`prompt()` เดิม (อนุมัติ/ยกเลิก/revise) แทนที่ด้วย `<AppConfirmDialog>` ตาม section 9(ก) — คง flow เดิม
      (ยิง API ที่หน้า list เลย ไม่ navigate ไปไหน ตามที่ระบุใน "ขอบเขต" ด้านบน)
- [ ] Dialog ลบเอกสาร (ถ้ามี) ยังใช้ shadcn `Dialog` ตาม section 9(ข) ไม่ใช่ `AppConfirmDialog`
- [ ] ปุ่ม "พิมพ์" เปิด PDF-preview modal ตาม pattern section 9(ค) (`z-[100]`, panel `max-w-4xl h-[90vh]`)

## Checklist ต่อไฟล์ — หน้า Create/Edit (`create/page.tsx`, `[id]/edit/page.tsx`)

- [ ] Wrapper/header ตรง section 1 รูปแบบ (ก) หรือ (ข) แล้วแต่หน้า
- [ ] ตาราง item-entry ตรง pattern section 5(ข) — input cell classes, ช่องส่วนลด `text-red-500`, ช่องรวมต่อแถว
      `bg-slate-50/50`, ปุ่ม "เพิ่มแถวสินค้า" ตรง class
- [ ] `AppSelect`/`AppDatePicker`/`AppLoading` ใช้ครบตาม section 3 (ไม่มี `<input type="date">` ดิบๆ, ไม่มี
      `<Loader2 className="animate-spin">` เขียนเองแทน `AppLoading`)
- [ ] Validation error ตรง pattern section 4 (error state เดียวทั้งฟอร์ม, แสดงข้อความใต้ช่อง, เคลียร์ทันทีที่แก้ไข)
- [ ] ปุ่ม primary ("บันทึก")/secondary ("ยกเลิก", "ตัวอย่าง PDF") ตรง section 2
- [ ] Popup ยืนยัน (ถ้ามี เช่นก่อนบันทึก) ใช้ `AppConfirmDialog` ตาม section 9(ก) ไม่ใช่ `confirm()`
- [ ] ตัวอักษร (label ฟอร์ม, ยอดรวม) ตรง section 10

## หลังแก้แต่ละโมดูลเสร็จ

อัปเดตแถวในตาราง rollout (section 11 ของ `frontend-page-template.md`) ว่าโมดูลนั้นผ่านมาตรฐานใหม่ครบแล้ว — ติ๊ก checkbox
รายชื่อโมดูลด้านบนในไฟล์นี้ด้วย
