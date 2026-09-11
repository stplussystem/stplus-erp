"use client";

import React, { useState, useEffect } from "react";
import { PackagePlus, ListPlus, FileText, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import StockMovementForm from "@/components/stock/StockMovementForm";
import MultiStockMovementForm from "@/components/stock/MultiStockMovementForm";
import { getUserRaw } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";

export default function StockInPage() {
  const [activeTab, setActiveTab] = useState<string>("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 💡 1. ดึงข้อมูล User (และ Permissions) ที่เก็บไว้ตอน Login มาเช็ค
    const userStr = getUserRaw();
    if (userStr) {
      const userObj = JSON.parse(userStr);
      const userPerms = userObj.user.permissions || [];
      setPermissions(userPerms);

      // 💡 2. ให้ระบบเลือก Tab แรกที่ User มีสิทธิ์ให้อัตโนมัติ
      if (userPerms.includes("stock_in_single")) setActiveTab("single");
      else if (userPerms.includes("stock_in_multi")) setActiveTab("multi");
      else if (userPerms.includes("stock_in_po")) setActiveTab("po");
    }
    setIsLoading(false);
  }, []);

  const hasPerm = (permName: string) => permissions.includes(permName);

  if (isLoading) {
    return <AppLoading text="กำลังตรวจสอบสิทธิ์..." />;
  }

  // ถ้าเข้ามาแล้วไม่มีสิทธิ์สักแท็บเดียว ให้โชว์หน้ากุญแจล็อค
  if (
    !hasPerm("stock_in_single") &&
    !hasPerm("stock_in_multi") &&
    !hasPerm("stock_in_po")
  ) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-muted-foreground">
        <Lock className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-bold text-foreground dark:text-slate-200">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้
        </h2>
        <p className="text-sm mt-2">
          กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การรับสินค้าเข้าคลัง
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
          <PackagePlus className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-md font-bold tracking-tight">
            รับสินค้าเข้าคลัง
          </h1>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            เลือกรูปแบบการรับสินค้าเข้าสู่ระบบคลังสินค้า
          </p>
        </div>
      </div>

      {/* โซน TAB MENU (จะโชว์เฉพาะ Tab ที่มีสิทธิ์เท่านั้น) */}
      <div className="flex flex-wrap gap-2 mb-6 pb-2">
        {hasPerm("stock_in_single") && (
          <button
            onClick={() => setActiveTab("single")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
              activeTab === "single"
                ? "h-10 px-3 rounded-xl gap-2 font-semibold text-emerald-600 border border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer"
                : "text-muted-foreground hover:bg-muted dark:hover:bg-slate-800",
            )}
          >
            <PackagePlus className="w-4 h-4" /> รับเข้าทีละรายการ
          </button>
        )}

        {hasPerm("stock_in_multi") && (
          <button
            onClick={() => setActiveTab("multi")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
              activeTab === "multi"
                ? "h-10 px-3 rounded-xl gap-2 font-semibold text-emerald-600 border border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer"
                : "text-muted-foreground hover:bg-muted dark:hover:bg-slate-800",
            )}
          >
            <ListPlus className="w-4 h-4" /> รับเข้าหลายรายการ
          </button>
        )}

        {hasPerm("stock_in_po") && (
          <button
            onClick={() => setActiveTab("po")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
              activeTab === "po"
                ? "h-10 px-3 rounded-xl gap-2 font-semibold text-emerald-600 border border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer"
                : "text-muted-foreground hover:bg-muted dark:hover:bg-slate-800",
            )}
          >
            <FileText className="w-4 h-4" /> รับจากใบสั่งซื้อ (PO)
          </button>
        )}
      </div>

      {/* โซนเนื้อหา (CONTENT) ของแต่ละ TAB */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-border dark:border-slate-800 min-h-[400px]">
        {activeTab === "single" && (
          <div className="animate-in fade-in duration-300">
            {/* เสียบฟอร์มรับเข้าทีละรายการ พร้อมส่งโหมด "in" */}
            <StockMovementForm mode="in" />
          </div>
        )}

        {activeTab === "multi" && (
          <div className="animate-in fade-in duration-300">
            {/* เสียบฟอร์มรับเข้าหลายรายการ พร้อมส่งโหมด "in" */}
            <MultiStockMovementForm mode="in" />
          </div>
        )}

        {activeTab === "po" && (
          <div className="animate-in fade-in duration-300">
            <h3 className="font-bold text-lg text-blue-700 dark:text-blue-400 mb-4">
              ดึงข้อมูลจากใบสั่งซื้อ (PO)
            </h3>
            <p className="text-muted-foreground">
              ฟอร์มสำหรับดึง PO (รอการพัฒนาเพิ่ม)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
