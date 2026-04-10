"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, Printer, FileDown } from "lucide-react";
import { toast } from "sonner";
import { withToastPromise } from "@/lib/toast-helper";

export default function ProductExcelActions() {
  const router = useRouter();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ฟังก์ชันดาวน์โหลด Excel
  const handleExport = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    window.open(`${apiUrl}/products/export`, "_blank");
  };

  // ฟังก์ชันดาวน์โหลด Template
  const handleDownloadTemplate = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    window.open(`${apiUrl}/products/template`, "_blank");
  };

  // ฟังก์ชันเปิดหน้าต่าง Print ของ Browser
  const handlePrint = () => {
    window.print();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // ฟังก์ชันอัปโหลดไฟล์ไปที่ API
  const handleImport = async () => {
    if (!file) {
      toast.error("กรุณาเลือกไฟล์ Excel ก่อนครับ");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    const importPromise = fetch(`${apiUrl}/products/import`, {
      method: "POST",
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
      }
      return res.json();
    });

    withToastPromise(importPromise, {
      loading: "กำลังนำเข้าข้อมูล... อาจใช้เวลาสักครู่",
      success: "นำเข้าข้อมูลสินค้าเรียบร้อยแล้ว!",
      error: (err) => err.message,
      onSuccessCallback: () => {
        setIsImportOpen(false);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh(); // รีเฟรชตารางหน้าเว็บ
      },
    });
  };

  return (
    <div className="flex gap-2 print:hidden">
      {/* ปุ่ม Print */}
      {/* <Button
        variant="outline"
        className="border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
        onClick={handlePrint}
      >
        <Printer className="mr-2 h-4 w-4" /> พิมพ์
      </Button> */}

      {/* ปุ่ม Export */}
      <Button
        variant="outline"
        className="border-green-600 text-green-600 hover:bg-green-50 cursor-pointer"
        onClick={handleExport}
      >
        <Download className="mr-2 h-4 w-4" /> ส่งออก
      </Button>

      {/* ปุ่ม Import (เปิดหน้าต่าง Pop-up) */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="bg-green-50 border-green-600 text-green-700 hover:bg-green-100 cursor-pointer"
          >
            <Upload className="mr-2 h-4 w-4" /> นำเข้า
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>นำเข้าข้อมูลสินค้า (Excel)</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
              <p className="font-semibold mb-1">คำแนะนำ:</p>
              <ul className="list-disc pl-5 space-y-1 text-blue-700">
                <li>กรุณาใช้ฟอร์แมตจากไฟล์ Template เท่านั้น</li>
                <li>ห้ามลบหรือแก้ไขชื่อหัวคอลัมน์ในแถวแรก</li>
                <li>
                  หากรหัส SKU ซ้ำ ระบบจะทำการ <b>"อัปเดต"</b> ข้อมูลให้แทน
                </li>
              </ul>
            </div>

            <Button
              variant="secondary"
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700"
              onClick={handleDownloadTemplate}
            >
              <FileDown className="mr-2 h-4 w-4" /> ดาวน์โหลดไฟล์ Template เปล่า
            </Button>

            <div className="grid gap-2 mt-2">
              <Label htmlFor="excel-file">
                เลือกไฟล์ Excel (.xlsx, .xls, .csv)
              </Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleImport}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!file}
            >
              เริ่มนำเข้าข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
