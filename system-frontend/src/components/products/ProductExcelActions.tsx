"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileSpreadsheet,
  Upload,
  Download,
  Loader2,
  PackagePlus,
  ClipboardCheck,
  Trash2,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { getToken } from "@/lib/auth-storage";

// ✅ 1. เพิ่ม type เข้ามาใน Interface เพื่อให้ TypeScript ไม่ Error
interface Props {
  filters: {
    search: string;
    stock: string;
    active: string;
    category: string;
    type?: string;
  };
}

interface ImportBatch {
  id: number;
  type: "master" | "adjust";
  file_name: string | null;
  affected_count: number;
  status: "completed" | "partially_undone" | "undone";
  created_at: string;
}

export default function ProductExcelActions({ filters }: Props) {
  const canStockAdjustment = usePermission("stock_adjustment");
  const canImportPRO = usePermission("import_products");
  const canExportPRO = usePermission("export_products");

  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);

  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // 🚀 เลือกไฟล์ไว้ก่อน ยังไม่อัปโหลดทันที — ต้องกดปุ่ม "เริ่มนำเข้าข้อมูล" แยกต่างหาก กันเผลอเลือกไฟล์ผิด
  // (มิเรอร์ pattern จาก ContactExcelActions.tsx/UserExcelActions.tsx)
  const [selectedMasterFile, setSelectedMasterFile] = useState<File | null>(null);
  const [selectedAdjustFile, setSelectedAdjustFile] = useState<File | null>(null);

  // 1. โหลดไฟล์ Excel (พ่วงตัวกรองไปด้วย)
  const handleExport = async () => {
    setLoadingExport(true);
    const tId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append("search", filters.search);
      // ✅ 2. แนบประเภทสินค้าไปให้ API กรอง
      if (filters.type && filters.type !== "all")
        queryParams.append("type", filters.type);
      if (filters.stock !== "all")
        queryParams.append("stock_status", filters.stock);
      if (filters.active !== "all")
        queryParams.append("is_active", filters.active);
      if (filters.category !== "all")
        queryParams.append("category_id", filters.category);

      const res = await fetch(
        `${apiUrl}/products/excel/export?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!res.ok) {
        let errMsg = "Export failed";
        try {
          const errData = await res.json();
          errMsg = errData.message || errMsg;
        } catch (e) {}
        if (res.status === 401) errMsg = "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products_inventory_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", {
        id: tId,
      });
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาดในการโหลดไฟล์", { id: tId });
    } finally {
      setLoadingExport(false);
    }
  };

  // 🟢 2. โหลดไฟล์ Template สำหรับสินค้าใหม่
  const handleDownloadTemplate = async () => {
    const tId = toast.loading("กำลังเตรียมไฟล์ Template...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const res = await fetch(`${apiUrl}/products/excel/template`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        let errMsg = "Template failed";
        try {
          const errData = await res.json();
          errMsg = errData.message || errMsg;
        } catch (e) {}
        if (res.status === 401) errMsg = "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template_new_products.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", {
        id: tId,
      });
    } catch (error: any) {
      toast.error(error.message || "ไม่สามารถโหลด Template ได้", { id: tId });
    }
  };

  // 🟢 3. อัปโหลดไฟล์ (เรียกเมื่อกดปุ่ม "เริ่มนำเข้าข้อมูล" เท่านั้น ไม่ใช่ตอนเลือกไฟล์)
  const executeImport = async (type: "master" | "adjust") => {
    const file = type === "master" ? selectedMasterFile : selectedAdjustFile;
    if (!file) return;

    setLoadingImport(true);
    const tId = toast.loading("กำลังประมวลผลไฟล์ Excel...");
    const formData = new FormData();
    formData.append("file", file);
    const endpoint =
      type === "master"
        ? "/products/excel/import-master"
        : "/products/excel/import-adjust";

    try {
      await apiFetch(endpoint, { method: "POST", body: formData });
      toast.success(
        type === "master"
          ? "เพิ่มสินค้าใหม่เข้าระบบสำเร็จ!"
          : "ปรับปรุงสต็อกสำเร็จ!",
        { id: tId },
      );
      window.dispatchEvent(new Event("refreshProducts"));
      // 🚀 บอกให้ ImportUndoBanner (แยก component, render อยู่คนละจุดของหน้า) รีเฟรชแถบ "นำเข้าล่าสุด" ทันที
      window.dispatchEvent(new Event("refreshLastImportBatch"));
      setIsMasterModalOpen(false);
      setIsAdjustModalOpen(false);
      setSelectedMasterFile(null);
      setSelectedAdjustFile(null);
    } catch (error: any) {
      toast.error(error.message || "รูปแบบไฟล์ไม่ถูกต้อง", { id: tId });
    } finally {
      setLoadingImport(false);
    }
  };

  return (
    <div className="flex gap-2">
        {/* ปุ่ม 1: นำเข้าสินค้าใหม่ (Popup) */}
        <Dialog
          open={isMasterModalOpen}
          onOpenChange={(open) => {
            setIsMasterModalOpen(open);
            if (!open) setSelectedMasterFile(null);
          }}
        >
          <DialogTrigger asChild>
            {canImportPRO && (
              <Button
                variant="outline"
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-blue-700 bg-background hover:bg-blue-50 border border-blue-200 hover:border-blue-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              >
                <PackagePlus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">นำเข้าสินค้าใหม่</span>
              </Button>
            )}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">
                นำเข้าสินค้าใหม่ + ยอดยกมา
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800">
                <ul className="list-disc pl-5 space-y-1">
                  <li>โหลดไฟล์ Template อัจฉริยะ (มีตัวเลือก Dropdown)</li>
                  <Button
                    onClick={handleDownloadTemplate}
                    className="w-full mt-3 border-dashed border-blue-300 text-blue-600 bg-background hover:bg-blue-100 h-10 rounded-full shadow-sm cursor-pointer transition-all"
                  >
                    <Download className="mr-2 w-4 h-4" /> ดาวน์โหลด Template
                    สินค้าใหม่
                  </Button>
                  <li className="mt-4">
                    กรอกข้อมูลให้ครบถ้วน (ถ้าไม่มีในตัวเลือก
                    สามารถพิมพ์เพิ่มได้เลย)
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold text-foreground">
                  เลือกไฟล์ Excel (.xlsx, .xls, .csv)
                </Label>
                <div className="flex items-center gap-3">
                  <Label
                    htmlFor="upload-master"
                    className={cn(
                      "cursor-pointer px-4 py-2.5 rounded-full font-bold text-sm transition-all border flex-shrink-0 flex items-center gap-2",
                      loadingImport
                        ? "opacity-50 cursor-not-allowed bg-muted"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
                    )}
                  >
                    <Upload className="w-4 h-4" />
                    เลือกไฟล์ Excel
                  </Label>
                  <span className="text-sm text-muted-foreground font-medium truncate max-w-[200px]">
                    {selectedMasterFile ? selectedMasterFile.name : "ยังไม่ได้เลือกไฟล์"}
                  </span>
                  <Input
                    id="upload-master"
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => setSelectedMasterFile(e.target.files?.[0] || null)}
                    className="hidden"
                    disabled={loadingImport}
                  />
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMasterModalOpen(false)}
                  disabled={loadingImport}
                  className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  onClick={() => executeImport("master")}
                  disabled={!selectedMasterFile || loadingImport}
                  className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                >
                  {loadingImport ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  เริ่มนำเข้าข้อมูล
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ปุ่ม 2: ส่งออกข้อมูล */}
        {canExportPRO && (
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={loadingExport}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-emerald-700 bg-background hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            {loadingExport ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">ส่งออกข้อมูล</span>
          </Button>
        )}

        {/* ปุ่ม 3: ปรับปรุงสต๊อก (Popup) */}
        <Dialog
          open={isAdjustModalOpen}
          onOpenChange={(open) => {
            setIsAdjustModalOpen(open);
            if (!open) setSelectedAdjustFile(null);
          }}
        >
          <DialogTrigger asChild>
            {canStockAdjustment && (
              <Button
                variant="outline"
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-purple-700 bg-background hover:bg-purple-50 border border-purple-200 hover:border-purple-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              >
                <ClipboardCheck className="w-4 h-4 mr-2" /> ปรับปรุงสต๊อก
              </Button>
            )}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-800">
                นำเข้าข้อมูลตรวจนับสต๊อก
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-xl text-sm text-purple-800">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    ใช้ไฟล์ที่ได้จากปุ่ม <b>"ส่งออกข้อมูล"</b> (Export) เท่านั้น
                  </li>
                  <li>
                    ระบุยอดสต็อกที่นับจริง ในคอลัมน์ <b>"นับจริง"</b>
                  </li>
                  <li>สินค้าใดไม่ระบุเลข ระบบจะไม่เปลี่ยนแปลงสต็อกเดิม</li>
                </ul>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold text-foreground">
                  เลือกไฟล์ Excel (.xlsx, .xls, .csv)
                </Label>
                <div className="flex items-center gap-3">
                  <Label
                    htmlFor="upload-adjust"
                    className={cn(
                      "cursor-pointer px-4 py-2.5 rounded-full font-bold text-sm transition-all border flex-shrink-0 flex items-center gap-2",
                      loadingImport
                        ? "opacity-50 cursor-not-allowed bg-muted"
                        : "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200",
                    )}
                  >
                    <Upload className="w-4 h-4" />
                    เลือกไฟล์ Excel
                  </Label>
                  <span className="text-sm text-muted-foreground font-medium truncate max-w-[200px]">
                    {selectedAdjustFile ? selectedAdjustFile.name : "ยังไม่ได้เลือกไฟล์"}
                  </span>
                  <Input
                    id="upload-adjust"
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => setSelectedAdjustFile(e.target.files?.[0] || null)}
                    className="hidden"
                    disabled={loadingImport}
                  />
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdjustModalOpen(false)}
                  disabled={loadingImport}
                  className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  onClick={() => executeImport("adjust")}
                  disabled={!selectedAdjustFile || loadingImport}
                  className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-purple-600 hover:bg-purple-800 shadow-sm shadow-purple-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                >
                  {loadingImport ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  เริ่มนำเข้าข้อมูล
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}

// 🚀 แถบ "นำเข้าล่าสุด" + ปุ่มยกเลิกการนำเข้า — แยกเป็น component ต่างหาก (ไม่ได้อยู่ในกลุ่มปุ่มด้านบน) เพื่อให้
// products/page.tsx เอาไปวางเป็นแถบเต็มความกว้างใต้ header ได้ ไม่ถูกบีบอยู่ในแถวปุ่มเดิม — ฟังอีเวนต์
// "refreshLastImportBatch"/"refreshProducts" เพื่อรีเฟรชทันทีหลังนำเข้าสำเร็จ โดยไม่ต้องแชร์ state กับปุ่มด้านบน
export function ImportUndoBanner() {
  const canImportPRO = usePermission("import_products");
  const canStockAdjustment = usePermission("stock_adjustment");

  const [lastBatch, setLastBatch] = useState<ImportBatch | null>(null);
  const [isUndoDialogOpen, setIsUndoDialogOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const fetchLastBatch = async () => {
    try {
      const res = await apiFetch("/products/excel/last-import-batch");
      setLastBatch(res?.batch || null);
    } catch (error) {
      // เงียบไว้ — แถบนี้เป็นแค่ตัวช่วยเสริม ไม่ควรทำให้หน้าใช้งานไม่ได้ถ้าดึงไม่สำเร็จ
    }
  };

  useEffect(() => {
    fetchLastBatch();
    window.addEventListener("refreshLastImportBatch", fetchLastBatch);
    return () => window.removeEventListener("refreshLastImportBatch", fetchLastBatch);
  }, []);

  const confirmUndo = async () => {
    if (!lastBatch) return;
    setIsUndoing(true);
    const tId = toast.loading("กำลังยกเลิกการนำเข้า...");
    try {
      const res = await apiFetch(
        `/products/excel/import-batches/${lastBatch.id}/undo`,
        { method: "POST" },
      );
      toast.success(res?.message || "ยกเลิกการนำเข้าสำเร็จ", { id: tId, duration: 8000 });
      setIsUndoDialogOpen(false);
      setLastBatch(null);
      window.dispatchEvent(new Event("refreshProducts"));
    } catch (error: any) {
      toast.error(error.message || "ยกเลิกการนำเข้าไม่สำเร็จ", { id: tId });
    } finally {
      setIsUndoing(false);
    }
  };

  const canUndoLastBatch =
    lastBatch &&
    lastBatch.status !== "undone" &&
    (lastBatch.type === "master" ? canImportPRO : canStockAdjustment);

  if (!canUndoLastBatch) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-2.5 text-sm mb-4 print:hidden">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <History className="w-4 h-4 shrink-0" />
          <span>
            นำเข้าล่าสุด ({lastBatch.type === "master" ? "นำเข้าสินค้าใหม่" : "ปรับปรุงสต๊อก"}):{" "}
            <b>{lastBatch.file_name || "-"}</b> ({lastBatch.affected_count} รายการ)
            {lastBatch.status === "partially_undone" && " — ยกเลิกไปแล้วบางส่วน"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsUndoDialogOpen(true)}
          className="h-8 px-3 rounded-full text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> ยกเลิกการนำเข้านี้
        </Button>
      </div>

      <Dialog open={isUndoDialogOpen} onOpenChange={setIsUndoDialogOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-8 text-center bg-card border-0 shadow-2xl [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-100/50">
              <Trash2 className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
              ยืนยันยกเลิกการนำเข้านี้?
            </DialogTitle>
            <p className="text-muted-foreground text-sm leading-relaxed px-4">
              {lastBatch?.type === "master" ? (
                <>
                  ระบบจะลบสินค้าที่เพิ่งถูกสร้างใหม่จากไฟล์{" "}
                  <span className="font-bold text-foreground">{lastBatch?.file_name}</span>{" "}
                  ทั้งหมด (สินค้าที่ถูกใช้งานในเอกสารอื่นไปแล้วจะไม่ถูกลบ) — เมื่อยกเลิกแล้วจะไม่สามารถกู้คืนได้
                </>
              ) : (
                <>
                  ระบบจะคืนค่าจำนวนสต็อก/สถานะ S/N ที่ปรับจากไฟล์{" "}
                  <span className="font-bold text-foreground">{lastBatch?.file_name}</span>{" "}
                  กลับไปเป็นค่าก่อนนำเข้า — เมื่อยกเลิกแล้วจะไม่สามารถกู้คืนได้
                </>
              )}
            </p>
            <div className="flex justify-center gap-3 w-full mt-6 pt-2">
              <button
                type="button"
                disabled={isUndoing}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                onClick={() => setIsUndoDialogOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isUndoing}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-800 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                onClick={confirmUndo}
              >
                {isUndoing ? <Loader2 className="w-4 h-4 animate-spin" /> : "ยืนยันการยกเลิก"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
