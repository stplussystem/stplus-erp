"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";

export default function UserExcelActions() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // ฟังก์ชันตัวช่วยดึงไฟล์ (Blob)
  const fetchExcelFile = async (endpoint: string, filename: string) => {
    const token =
      getToken();
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("ไม่สามารถเชื่อมต่อระบบได้");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = async () => {
    const tId = toast.loading("กำลังเตรียมไฟล์ Template...");
    try {
      // 🚀 Endpoint สำหรับโหลด Template ผู้ใช้งาน
      await fetchExcelFile("/users/excel/template", "user_template.xlsx");
      toast.success("ดาวน์โหลด Template สำเร็จ!", { id: tId });
    } catch (error) {
      toast.error("ไม่สามารถเชื่อมต่อระบบได้กรุณาตรวจสอบ Network", { id: tId });
    }
  };

  const handleExportData = async () => {
    const tId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const date = new Date();
      const formattedDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
      const filename = `users_data_${formattedDate}.xlsx`;

      // 🚀 Endpoint สำหรับ Export ผู้ใช้งาน
      await fetchExcelFile(`/users/excel/export`, filename);
      toast.success("ส่งออกข้อมูลสำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", {
        id: tId,
      });
    } catch (error) {
      toast.error("ไม่สามารถเชื่อมต่อระบบได้กรุณาตรวจสอบ Network", { id: tId });
    }
  };

  const executeImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    const tId = toast.loading("กำลังนำเข้าข้อมูลผู้ใช้งาน กรุณารอสักครู่...");
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // 🚀 Endpoint สำหรับ Import ผู้ใช้งาน
      await apiFetch("/users/excel/import", {
        method: "POST",
        body: formData,
      });
      toast.success("นำเข้าข้อมูลสำเร็จเรียบร้อย!", { id: tId });

      setIsImportModalOpen(false);
      setSelectedFile(null);

      // สั่งให้ตารางรีเฟรชข้อมูล (ส่งสัญญาณให้หน้า page.tsx รู้)
      window.dispatchEvent(new Event("refreshUsers"));
    } catch (error: any) {
      toast.error(error.message || "นำเข้าข้อมูลไม่สำเร็จ", { id: tId });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleExportData}
        className="h-10 px-4 rounded-full gap-2 font-semibold shadow-sm text-emerald-600 hover:text-emerald-800 border-emerald-200 hover:bg-emerald-50 cursor-pointer transition-all hover:scale-102 transition-transform"
      >
        <FileSpreadsheet className="w-4 h-4 mr-2" /> ส่งออกข้อมูล
      </Button>

      <Dialog
        open={isImportModalOpen}
        onOpenChange={(open) => {
          setIsImportModalOpen(open);
          if (!open) setSelectedFile(null);
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="h-10 px-4 rounded-full gap-2 font-semibold shadow-sm text-purple-600 hover:text-purple-800 border-purple-200 hover:bg-purple-50 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Upload className="w-4 h-4 mr-2" /> นำเข้าข้อมูล
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              นำเข้าข้อมูลผู้ใช้งาน (Excel)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-bold mb-2 text-blue-700">คำแนะนำ:</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600 font-medium">
                <li>
                  กรุณาใช้ฟอร์มแมตจากไฟล์ Template เท่านั้น
                  <Button
                    variant="outline"
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="w-full mt-3 border-dashed border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-100 bg-background h-10 rounded-lg cursor-pointer"
                  >
                    <Download className="mr-2 w-4 h-4" /> ดาวน์โหลดไฟล์ Template
                    เปล่า
                  </Button>
                </li>
                <li>ห้ามลบหรือแก้ไขชื่อหัวคอลัมน์ในแถวแรก</li>
                <li>
                  หากอีเมล ซ้ำ ระบบจะทำการ <strong>"อัปเดต"</strong>{" "}
                  ข้อมูลแถวนั้น
                </li>
              </ul>
            </div>

            {/* UI เลือกไฟล์แบบ Custom */}
            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground">
                เลือกไฟล์ Excel (.xlsx, .xls, .csv)
              </Label>
              <div className="flex items-center gap-3">
                <Label
                  htmlFor="user-excel-upload"
                  className={cn(
                    "cursor-pointer px-4 py-2.5 rounded-lg font-bold text-sm transition-all border flex-shrink-0 flex items-center gap-2",
                    isImporting
                      ? "opacity-50 cursor-not-allowed bg-muted"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
                  )}
                >
                  <Upload className="w-4 h-4" />
                  เลือกไฟล์ Excel
                </Label>

                <span className="text-sm text-muted-foreground font-medium truncate max-w-[200px]">
                  {selectedFile ? selectedFile.name : "ยังไม่ได้เลือกไฟล์"}
                </span>

                <Input
                  id="user-excel-upload"
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={isImporting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsImportModalOpen(false)}
                disabled={isImporting}
                className="h-10 rounded-xl cursor-pointer"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={executeImport}
                disabled={!selectedFile || isImporting}
                className="h-10 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold cursor-pointer"
              >
                เริ่มนำเข้าข้อมูล
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
