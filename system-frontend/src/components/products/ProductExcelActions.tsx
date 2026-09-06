"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

export default function ProductExcelActions({ filters }: Props) {
  const canStockAdjustment = usePermission("stock_adjustment");
  const canImportPRO = usePermission("import_products");
  const canExportPRO = usePermission("export_products");

  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);

  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  const masterInputRef = useRef<HTMLInputElement>(null);
  const adjustInputRef = useRef<HTMLInputElement>(null);

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

  // 🟢 3. อัปโหลดไฟล์
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "master" | "adjust",
  ) => {
    const file = e.target.files?.[0];
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
      setIsMasterModalOpen(false);
      setIsAdjustModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "รูปแบบไฟล์ไม่ถูกต้อง", { id: tId });
    } finally {
      setLoadingImport(false);
      if (masterInputRef.current) masterInputRef.current.value = "";
      if (adjustInputRef.current) adjustInputRef.current.value = "";
    }
  };

  return (
    <div className="flex gap-2">
      {/* ปุ่ม 1: ส่งออก */}
      {canExportPRO && (
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={loadingExport}
          className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
        >
          {loadingExport ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 mr-2" />
          )}
          <span className="hidden sm:inline">ส่งออกข้อมูล</span>
        </Button>
      )}

      {/* ปุ่ม 2: นำเข้าสินค้าใหม่ (Popup) */}
      <Dialog open={isMasterModalOpen} onOpenChange={setIsMasterModalOpen}>
        <DialogTrigger asChild>
          {canImportPRO && (
            <Button
              variant="outline"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 hover:border-blue-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <PackagePlus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">นำเข้าสินค้าใหม่</span>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800">
              นำเข้าสินค้าใหม่ + ยอดยกมา
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800">
              <ul className="list-disc pl-5 space-y-1">
                <li>โหลดไฟล์ Template อัจฉริยะ (มีตัวเลือก Dropdown)</li>
                <Button
                  onClick={handleDownloadTemplate}
                  className="w-full mt-3 border-dashed border-blue-300 text-blue-600 bg-white hover:bg-blue-100 h-10 rounded-full shadow-sm cursor-pointer transition-all"
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
            <div className="flex items-center gap-3 justify-center">
              <Label
                htmlFor="upload-master"
                className={cn(
                  "flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform",
                  loadingImport
                    ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg",
                )}
              >
                {loadingImport ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> กำลังอัปโหลด...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" /> อัปโหลดไฟล์ที่กรอกแล้ว
                  </>
                )}
              </Label>
              <input
                id="upload-master"
                type="file"
                ref={masterInputRef}
                accept=".xlsx, .xls, .csv"
                onChange={(e) => handleFileUpload(e, "master")}
                className="hidden"
                disabled={loadingImport}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ปุ่ม 3: ปรับปรุงสต๊อก (Popup) */}
      <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
        <DialogTrigger asChild>
          {canStockAdjustment && (
            <Button
              variant="outline"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-purple-700 bg-white hover:bg-purple-50 border border-purple-200 hover:border-purple-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
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
            <div className="flex items-center gap-3 justify-center">
              <Label
                htmlFor="upload-adjust"
                className={cn(
                  "flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50",
                  loadingImport
                    ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                    : "bg-purple-600 text-white hover:bg-purple-700 shadow-lg",
                )}
              >
                {loadingImport ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> กำลังอัปโหลด...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" /> อัปโหลดไฟล์ตรวจนับสต๊อก
                  </>
                )}
              </Label>
              <input
                id="upload-adjust"
                type="file"
                ref={adjustInputRef}
                accept=".xlsx, .xls, .csv"
                onChange={(e) => handleFileUpload(e, "adjust")}
                className="hidden"
                disabled={loadingImport}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// เล็กน้อยแก้ React warning ให้ผ่าน
function Label({ children, className, htmlFor }: any) {
  return (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  );
}
