"use client";

import { CircleCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// 🆕 [2026-09-25] แสดงสิทธิ์ของ 1 กลุ่มเมนู (เช่น "ขาย") แบบ "จัดกลุ่มตามเอกสาร/หน้าจอ" — แต่ละเอกสารเป็น 1 การ์ด มีปุ่มย่อ
// ดู / สร้าง / แก้ไข / ลบ / อนุมัติ เรียงตามลำดับคงที่ (เดิมเรียงชิปยาวๆ ต่อกันเป็นพรืด หาสิทธิ์ของเอกสารหนึ่งๆ ยากมาก)
// จัดกลุ่มจาก "ชื่อ key ของสิทธิ์" ตามแพทเทิร์น [bt_]{create|edit|delete|approve|view}_{เอกสาร} — สิทธิ์ที่ไม่เข้าแพทเทิร์น
// (เช่น "/", stock_in_purchase, import_products) รวมไว้ในการ์ด "อื่นๆ" แสดงชื่อไทยเต็มเหมือนเดิม
// ไม่แก้ข้อมูลในตาราง permissions เลย (title_th/sort_order/group/sub_group) แค่จัดการแสดงผล

const ACTIONS: { key: string; label: string; thPrefix: string }[] = [
  { key: "view", label: "ดู", thPrefix: "" },
  { key: "create", label: "สร้าง", thPrefix: "สร้าง" },
  { key: "edit", label: "แก้ไข", thPrefix: "แก้ไข" },
  { key: "delete", label: "ลบ", thPrefix: "ลบ" },
  { key: "approve", label: "อนุมัติ", thPrefix: "อนุมัติ" },
];
const ACTION_ORDER = ACTIONS.map((a) => a.key);
const NAME_PATTERN = /^(?:bt_)?(create|edit|delete|approve|view)_(.+)$/;

// "ปุ่มสร้างใบเสนอราคา (กำหนดเอง)" → "ใบเสนอราคา (กำหนดเอง)"
function entityLabelFromTitle(title: string, action: string): string {
  let t = (title || "").trim();
  t = t.replace(/^ปุ่ม/, "");
  const prefix = ACTIONS.find((a) => a.key === action)?.thPrefix;
  if (prefix && t.startsWith(prefix)) t = t.slice(prefix.length).trim();
  return t;
}

type Perm = { id: number; name: string; title_th?: string | null; sub_group?: string | null };
type Entity = { key: string; label: string; items: { action: string; perm: Perm }[] };

function buildEntities(perms: Perm[]) {
  const entities = new Map<string, Entity>();
  const others: Perm[] = [];

  for (const perm of perms) {
    const m = NAME_PATTERN.exec(perm.name);
    if (!m) {
      others.push(perm);
      continue;
    }
    const [, action, entityKey] = m;
    let entity = entities.get(entityKey);
    if (!entity) {
      entity = { key: entityKey, label: "", items: [] };
      entities.set(entityKey, entity);
    }
    entity.items.push({ action, perm });
  }

  for (const entity of entities.values()) {
    // ชื่อเอกสาร: ใช้ชื่อของสิทธิ์ "ดู" (เป็นชื่อเมนูตรงๆ) ก่อน ไม่มีก็ตัดคำ "ปุ่ม+การกระทำ" ออกจากชื่อปุ่มแรก
    const view = entity.items.find((i) => i.action === "view");
    const first = entity.items[0];
    entity.label =
      (view?.perm.title_th || "").trim() ||
      entityLabelFromTitle(first.perm.title_th || "", first.action) ||
      entity.key;
    entity.items.sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action));
  }

  return { entities: Array.from(entities.values()), others };
}

interface PermissionMatrixProps {
  perms: Perm[];
  selected: string[];
  onToggle: (name: string) => void;
  // เลือก/ยกเลิกหลายสิทธิ์พร้อมกัน — ถ้าส่งมา จะมีปุ่ม "เลือกทั้งหมด" ของกลุ่มนี้ (การเลือกทีละรายการยังใช้ onToggle เหมือนเดิม)
  onSetMany?: (names: string[], checked: boolean) => void;
  disabled?: boolean;
  // จำนวนคอลัมน์ของการ์ดเอกสาร (Tailwind class) — หน้าแก้ไขผู้ใช้วางกลุ่มเป็น 2 คอลัมน์อยู่แล้ว จึงใช้ค่าที่แคบกว่า
  gridClassName?: string;
}

export function PermissionMatrix({
  perms,
  selected,
  onToggle,
  onSetMany,
  disabled = false,
  gridClassName = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
}: PermissionMatrixProps) {
  const allNames = perms.map((p) => p.name);
  const selectedCount = allNames.filter((n) => selected.includes(n)).length;
  const allSelected = allNames.length > 0 && selectedCount === allNames.length;

  const chipClass = (isChecked: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all select-none",
      disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-blue-400",
      isChecked
        ? disabled
          ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
          : "border-blue-600 bg-blue-600 text-white shadow-sm"
        : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    );

  const renderChip = (perm: Perm, label: string) => {
    const isChecked = selected.includes(perm.name);
    return (
      <label
        key={perm.id}
        title={`${perm.title_th || perm.name}  (${perm.name})`}
        className={chipClass(isChecked)}
      >
        <input
          type="checkbox"
          className="hidden"
          disabled={disabled}
          checked={isChecked}
          onChange={() => onToggle(perm.name)}
        />
        {isChecked ? (
          <CircleCheck className="h-3.5 w-3.5" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5 opacity-40" />
        )}
        <span>{label}</span>
      </label>
    );
  };

  // แยกตามหมวดย่อย (sub_group ในตาราง permissions เช่น "ทั่วไป" = สิทธิ์เข้าเมนู, "ปุ่ม" = ปุ่ม สร้าง/แก้ไข/ลบ/อนุมัติ)
  // "ทั่วไป" ขึ้นก่อน "ปุ่ม" แล้วจึงหมวดอื่น (เช่นหมวดย่อยของรายงาน) ตามลำดับที่เจอ
  const sectionMap = new Map<string, Perm[]>();
  for (const perm of perms) {
    const key = (perm.sub_group || "อื่นๆ").trim() || "อื่นๆ";
    if (!sectionMap.has(key)) sectionMap.set(key, []);
    sectionMap.get(key)!.push(perm);
  }
  const rank = (name: string) => (name === "ทั่วไป" ? 0 : name === "ปุ่ม" ? 1 : 2);
  const sections = Array.from(sectionMap.entries())
    .map(([name, items], index) => ({ name, items, index }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.index - b.index);

  const sectionHint = (name: string) =>
    name === "ทั่วไป" ? "เข้าถึงเมนู/หน้าจอ" : name === "ปุ่ม" ? "สร้าง / แก้ไข / ลบ / อนุมัติ แยกตามเอกสาร" : "";

  return (
    <div className="space-y-4">
      {onSetMany && allNames.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100/70 px-3 py-2 dark:bg-slate-800/60">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            เลือกแล้ว {selectedCount}/{allNames.length} สิทธิ์
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSetMany(allNames, !allSelected)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all",
              disabled
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:border-blue-400",
              allSelected
                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
            )}
          >
            <CircleCheck className="h-3.5 w-3.5" />
            {allSelected ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
          </button>
        </div>
      )}
      {sections.map((section) => {
        // หมวด "ปุ่ม": จัดเป็นการ์ดต่อเอกสาร (ปุ่มย่อ สร้าง/แก้ไข/ลบ/อนุมัติ) — หมวดอื่นแสดงเป็นชิปชื่อไทยเรียงกัน
        const useCards = section.name === "ปุ่ม";
        const { entities, others } = useCards
          ? buildEntities(section.items)
          : { entities: [] as Entity[], others: section.items };
        return (
          <div key={section.name}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {section.name}
              </span>
              {sectionHint(section.name) && (
                <span className="text-xs text-slate-400">{sectionHint(section.name)}</span>
              )}
            </div>

            {entities.length > 0 && (
              <div className={cn("grid gap-3", gridClassName)}>
                {entities.map((entity) => (
                  <div
                    key={entity.key}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <div className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100" title={entity.key}>
                      {entity.label}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entity.items.map(({ action, perm }) =>
                        renderChip(perm, ACTIONS.find((a) => a.key === action)?.label || action),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {others.length > 0 && (
              <div className={cn("flex flex-wrap gap-2", entities.length > 0 && "mt-3")}>
                {others.map((perm) => renderChip(perm, perm.title_th || perm.name))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
