import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// 🎨 Popup ยืนยันการทำรายการ ดึงโครงสร้าง/สไตล์มาจาก modal ที่มีอยู่แล้วใน purchase-orders/[id]/page.tsx
// (isApproveModalOpen / isForceCloseModalOpen) — extract เป็น component กลางแทน confirm()/prompt() ของ browser
// ดู convention เต็มที่ .claude/docs/frontend-page-template.md ส่วนที่ 7
type AppConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: React.ComponentType<{ className?: string }>;
  iconColorClass?: string;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmColorClass?: string;
  onConfirm: () => void;
  loading?: boolean;
  children?: React.ReactNode;
};

export function AppConfirmDialog({
  open,
  onOpenChange,
  icon: Icon = AlertTriangle,
  iconColorClass = "bg-blue-50 text-blue-600 border-blue-100/50",
  title,
  description,
  confirmLabel,
  cancelLabel = "ยกเลิก",
  confirmColorClass = "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20",
  onConfirm,
  loading = false,
  children,
}: AppConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center transform animate-in zoom-in-95 duration-200">
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-[6px]",
            iconColorClass,
          )}
        >
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
        <div className="text-slate-500 text-sm mb-6 leading-relaxed">
          {description}
        </div>
        {children && <div className="mb-4 text-left">{children}</div>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1 py-3 rounded-full border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex-1 py-3 rounded-full text-white font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2",
              confirmColorClass,
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
