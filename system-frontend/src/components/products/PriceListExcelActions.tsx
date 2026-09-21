"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileSpreadsheet,
  Upload,
  Download,
  Loader2,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { getToken } from "@/lib/auth-storage";
import { VendorSearchDropdown } from "@/components/products/VendorSearchDropdown";

type VendorOption = { id: number; business_name?: string; contact_person_name?: string };

// 🚀 ปุ่ม "นำเข้า Price List" — ต้องเลือกผู้จำหน่ายก่อนเสมอ (ทั้งไฟล์เป็นราคาของผู้จำหน่ายรายเดียว ไม่ใช่คอลัมน์
// ต่อแถว ตามที่ยืนยันกับผู้ใช้ไว้) จากนั้นขั้นตอนดาวน์โหลด/อัปโหลดจึงเหมือน StockAdjustmentAction ทุกประการ
export function PriceListImportExportAction({ vendors }: { vendors: VendorOption[] }) {
  const canImport = usePermission("import_price_lists");
  const canExport = usePermission("export_price_lists");
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ชื่อบริษัทผู้จำหน่ายที่เลือกอยู่ — ใช้ทั้งในชื่อไฟล์ดาวน์โหลดและ popup ยืนยันก่อนนำเข้า
  const selectedVendor = vendors.find((v) => String(v.id) === String(vendorId));
  const vendorName = selectedVendor?.business_name || selectedVendor?.contact_person_name || "";

  const handleDownload = async () => {
    if (!vendorId) {
      toast.error("กรุณาเลือกผู้จำหน่ายก่อนดาวน์โหลด");
      return;
    }
    setLoadingExport(true);
    const tId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/product-price-lists/export?vendor_id=${vendorId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // ใส่ชื่อบริษัทผู้จำหน่ายในชื่อไฟล์ (ตัดอักขระที่ใช้ตั้งชื่อไฟล์ไม่ได้ออก)
      const vendorLabel = vendorName
        .replace(/[\\/:*?"<>|]/g, "")
        .trim();
      a.download = `price_list_${vendorLabel ? `${vendorLabel}_` : ""}${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: tId });
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาดในการโหลดไฟล์", { id: tId });
    } finally {
      setLoadingExport(false);
    }
  };

  const handleImport = async () => {
    if (!vendorId || !selectedFile) return;
    setConfirmOpen(false);
    setLoadingImport(true);
    const tId = toast.loading("กำลังประมวลผลไฟล์ Excel...");
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("vendor_id", vendorId);

    try {
      const res = await apiFetch("/product-price-lists/import", { method: "POST", body: formData });
      toast.success(res?.message || "นำเข้าสำเร็จ", { id: tId });
      window.dispatchEvent(new Event("refreshPriceLists"));
      setOpen(false);
      setSelectedFile(null);
    } catch (error: any) {
      toast.error(error.message || "รูปแบบไฟล์ไม่ถูกต้อง", { id: tId });
    } finally {
      setLoadingImport(false);
    }
  };

  if (!canImport && !canExport) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setSelectedFile(null);
          setVendorId("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-10 px-5 py-2 rounded-full border border-purple-200 hover:border-purple-300 text-purple-700 bg-background hover:bg-purple-50 text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
        >
          <FileSpreadsheet className="w-4 h-4" /> นำเข้า/ส่งออก Price List
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">
            นำเข้า/ส่งออก Price List ผู้จำหน่าย
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">
              เลือกผู้จำหน่าย (ทั้งไฟล์จะเป็นราคาของผู้จำหน่ายรายนี้)
            </Label>
            <VendorSearchDropdown
              value={vendorId}
              vendors={vendors}
              onChange={setVendorId}
            />
          </div>

          <div className="bg-purple-50 p-4 rounded-xl text-sm text-purple-800">
            <ul className="list-disc pl-5 space-y-1">
              <li>ดาวน์โหลดไฟล์ด้านล่างนี้ก่อน (รายชื่อสินค้าทั้งหมด + ราคาเดิมของผู้จำหน่ายรายนี้ถ้ามี)</li>
              {canExport && (
                <Button
                  onClick={handleDownload}
                  disabled={loadingExport || !vendorId}
                  className="w-full mt-3 border-dashed border-purple-300 text-purple-600 bg-background hover:bg-purple-100 h-10 rounded-full shadow-sm cursor-pointer transition-all disabled:opacity-50"
                >
                  {loadingExport ? (
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 w-4 h-4" />
                  )}
                  ดาวน์โหลดข้อมูลสินค้า
                </Button>
              )}
              <li className="mt-4">กรอกราคา/ส่วนลด/สถานะ/วันสิ้นสุดราคาที่ผู้จำหน่ายรายนี้ตั้งไว้</li>
              <li>ช่องราคาว่าง = ข้ามแถวนั้น ไม่แตะข้อมูลเดิม</li>
              <li>ไม่กรอก "สถานะ" ระบบจะคำนวณราคาขึ้น/ลง/คงที่ให้อัตโนมัติจากราคาก่อนหน้า</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-bold text-foreground">
              เลือกไฟล์ Excel (.xlsx, .xls, .csv)
            </Label>
            <div className="flex items-center gap-3">
              <Label
                htmlFor="upload-price-list"
                className={cn(
                  "cursor-pointer px-4 py-2.5 rounded-full font-bold text-sm transition-all border flex-shrink-0 flex items-center gap-2",
                  loadingImport || !vendorId
                    ? "opacity-50 cursor-not-allowed bg-muted"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200",
                )}
              >
                <Upload className="w-4 h-4" />
                เลือกไฟล์ Excel
              </Label>
              <span className="text-sm text-muted-foreground font-medium truncate max-w-[200px]">
                {selectedFile ? selectedFile.name : "ยังไม่ได้เลือกไฟล์"}
              </span>
              <Input
                id="upload-price-list"
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
                disabled={loadingImport || !vendorId}
              />
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loadingImport}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!selectedFile || !vendorId || loadingImport}
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

        {/* popup ยืนยันก่อนนำเข้าจริง — แสดงชื่อบริษัทผู้จำหน่ายที่ราคาในไฟล์จะถูกบันทึกให้ เพื่อกันเลือกผู้จำหน่ายผิดราย */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent showCloseButton={false} className="sm:max-w-sm rounded-3xl p-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto border-[6px] bg-purple-50 text-purple-600 border-purple-100/50">
              <Building2 className="w-6 h-6" />
            </div>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-xl font-bold text-foreground leading-normal">
                ยืนยันการนำเข้า Price List
              </DialogTitle>
              <DialogDescription className="leading-relaxed">
                ราคาทั้งหมดในไฟล์จะถูกบันทึกเป็นราคาของผู้จำหน่าย
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl bg-purple-50 border border-purple-100 px-4 py-3 text-left">
              <div className="text-xs text-purple-600">บริษัทผู้จำหน่าย</div>
              <div className="text-base font-bold text-purple-900 break-words">{vendorName || "-"}</div>
              {selectedFile && (
                <div className="text-xs text-muted-foreground mt-1 truncate">ไฟล์: {selectedFile.name}</div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-3 rounded-full border border-border text-foreground font-bold hover:bg-muted transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="flex-1 py-3 rounded-full text-white font-bold shadow-lg transition-all cursor-pointer bg-purple-600 hover:bg-purple-800 shadow-purple-600/20"
              >
                ยืนยันนำเข้า
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
