import MultiStockMovementForm from "@/components/stock/MultiStockMovementForm";
import { Suspense } from "react";

export default function MultiStockInPage() {
  return (
    <div className="max-w-4xl bg-white dark:bg-slate-900 border border-border rounded-2xl p-6 shadow-sm">
      <div className="w-full max-w-full px-4 md:px-4 py-6 overflow-x-hidden">
        <Suspense fallback={<div>กำลังโหลดฟอร์ม...</div>}>
          <MultiStockMovementForm mode="in" />
        </Suspense>
      </div>
    </div>
  );
}