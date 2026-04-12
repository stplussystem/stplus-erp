"use client";
import React, { Suspense } from "react";
import { PackagePlus } from "lucide-react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";

// 💡 ใช้ Dynamic Import เพื่อลดภาระการ Compile หน้าหลัก
const StockMovementForm = dynamic(
  () => import("@/components/stock/StockMovementForm"),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
    ),
  },
);

export default function SingleStockInPage() {
  return (
    <div className="max-w-4xl bg-white dark:bg-slate-900 border border-border rounded-2xl p-6 shadow-sm">
      <div className="w-full max-w-full px-4 md:px-4 py-6 overflow-x-hidden">
        <Suspense fallback={<div>กำลังโหลดฟอร์ม...</div>}>
          <StockMovementForm mode="in" />
        </Suspense>
      </div>
    </div>
  );
}
