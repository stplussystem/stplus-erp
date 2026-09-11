import React from "react";
import { cn } from "@/lib/utils";

// 🎨 สไตล์เดียวกับ tooltip เมนู AppLayout ตอนย่อ (sidebar collapsed) — ดึงมาทำเป็น component
// กลางใช้ซ้ำได้ทุกจุด (คอลัมน์ "จัดการ" ในตาราง ฯลฯ) แทน native title= attribute
// ดู convention เต็มที่ .claude/docs/frontend-page-template.md ส่วนที่ 6
type AppTooltipProps = {
  label: string;
  children: React.ReactNode;
  side?: "top" | "left";
};

export function AppTooltip({ label, children, side = "top" }: AppTooltipProps) {
  return (
    <div className="relative inline-flex group">
      {children}
      <div
        className={cn(
          "absolute z-[100] px-3 py-2 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl whitespace-nowrap border border-slate-700 dark:border-slate-200 pointer-events-none",
          side === "top"
            ? "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2"
            : "left-[calc(100%+14px)] top-1/2 -translate-y-1/2",
        )}
      >
        {side === "top" ? (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-slate-800 dark:border-t-white" />
        ) : (
          <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-800 dark:border-r-white" />
        )}
        {label}
      </div>
    </div>
  );
}
