"use client";
import React, { Suspense } from "react";
import { PackagePlus } from "lucide-react";
import dynamic from "next/dynamic";

// 💡 ใช้ Dynamic Import เพื่อลดภาระการ Compile หน้าหลัก
const StockMovementForm = dynamic(() => import("@/components/stock/StockMovementForm"), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
});

export default function SingleStockInPage() {
  return (
    <div className="w-full max-w-full px-4 md:px-4 py-6 overflow-x-hidden">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
          <PackagePlus className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">รับเข้าสินค้าทีละรายการ</h1>
          <p className="text-xs text-muted-foreground mt-1 italic">
            * บันทึกรายการแบบรวดเร็วทีละหนึ่งรายการ
          </p>
        </div>
      </div>
      
      <div className="max-w-4xl bg-white dark:bg-slate-900 border border-border rounded-2xl p-6 shadow-sm">
        <Suspense fallback={<div>กำลังโหลดฟอร์ม...</div>}>
          <StockMovementForm mode="in" />
        </Suspense>
      </div>
    </div>
  );
}