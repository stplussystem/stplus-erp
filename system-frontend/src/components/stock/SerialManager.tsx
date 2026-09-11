"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListOrdered,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";

export const SerialManager = ({
  isOpen,
  onClose,
  qty,
  serials,
  onSerialsChange,
  mode = "in",
  productId, // 🚨 [เพิ่มใหม่] รับค่า productId มาจากหน้า Multi
}: any) => {
  const [isValidating, setIsValidating] = useState(false);
  const [errors, setErrors] = useState<{ [key: number]: string }>({});

  const handleInputChange = (idx: number, value: string) => {
    const newSerials = [...serials];
    newSerials[idx] = value;
    onSerialsChange(newSerials);

    if (errors[idx]) {
      const newErrors = { ...errors };
      delete newErrors[idx];
      setErrors(newErrors);
    }
  };

  const handleSaveAndCheck = async () => {
    const filledItems = serials
      .map((sn: string, idx: number) => ({ sn, idx }))
      .filter((item: any) => item.sn && item.sn.trim() !== "");

    if (filledItems.length === 0) {
      toast.error("กรุณาระบุ Serial Number อย่างน้อย 1 รายการครับ");
      return;
    }

    setIsValidating(true);
    const newErrors: { [key: number]: string } = {};
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    const token =
      getToken();

    try {
      const seenSns = new Map();
      filledItems.forEach((item: any) => {
        if (seenSns.has(item.sn)) {
          newErrors[item.idx] = "S/N ซ้ำกับรายการอื่นในหน้านี้";
          newErrors[seenSns.get(item.sn)] = "S/N ซ้ำกับรายการอื่นในหน้านี้";
        }
        seenSns.set(item.sn, item.idx);
      });

      for (const item of filledItems) {
        if (newErrors[item.idx]) continue;

        const res = await fetch(
          `${apiUrl}/product-serials/check?sn=${item.sn}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (res.ok) {
          const data = await res.json();

          if (mode === "in" && data.exists) {
            newErrors[item.idx] = "มีอยู่ในระบบแล้ว ไม่สามารถรับซ้ำได้";
          }

          if (mode === "out") {
            if (!data.exists) {
              newErrors[item.idx] = "ไม่พบข้อมูลในระบบคลัง";
            } else if (data.status !== "available") {
              const statusText =
                data.status === "sold"
                  ? "จำหน่ายไปแล้ว"
                  : `สถานะปัจจุบัน: ${data.status}`;
              newErrors[item.idx] = `ไม่พร้อม (${statusText})`;
            } else if (data.product_id && data.product_id !== productId) {
              // 🚨 [เพิ่มใหม่] เช็คว่า S/N เป็นของสินค้านี้จริงๆ หรือเปล่า
              newErrors[item.idx] = "ไม่ใช่ S/N ของสินค้านี้";
            }
          }
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        toast.error("พบข้อผิดพลาด กรุณาตรวจสอบช่องสีแดงครับ");
      } else {
        toast.success("ตรวจสอบ Serial Number เรียบร้อย");
        onClose();
      }
    } catch (error: any) {
      toast.error("ระบบตรวจสอบขัดข้อง กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={isValidating ? () => {} : onClose}>
      <DialogContent className="!max-w-[95vw] md:!max-w-[900px] dark:bg-slate-900 border-none shadow-2xl rounded-3xl overflow-hidden p-0">
        <DialogHeader className="p-6 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <DialogTitle className="flex flex-col gap-1 text-2xl font-bold">
            <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-blue-500" strokeWidth={2} />
              ตรวจสอบ Serial Number ({qty} รายการ)
            </div>
            <p className="text-[11px] text-slate-400 italic font-normal">
              * ระบบจะตรวจสอบความซ้ำซ้อนและสถานะของ S/N ในคลังสินค้าทันที
            </p>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-8 p-6 md:p-10 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
          {Array.from({ length: qty }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "group space-y-2.5 p-4 rounded-2xl border transition-all",
                errors[idx]
                  ? "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500",
              )}
            >
              <div className="flex justify-between items-center px-1">
                <span
                  className={cn(
                    "text-[11px] font-black uppercase",
                    errors[idx] ? "text-red-500" : "text-slate-400",
                  )}
                >
                  ลำดับที่ {idx + 1}
                </span>
                {serials[idx] && serials[idx].trim() !== "" && !errors[idx] && (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 py-0.5 px-2 border-none font-bold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> กรอกแล้ว
                  </Badge>
                )}
              </div>
              <Input
                placeholder={`พิมพ์ หรือ สแกน S/N...`}
                value={serials[idx] || ""}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                disabled={isValidating}
                className={cn(
                  "h-10 text-sm rounded-2xl shadow-sm transition-all focus:shadow-md",
                  errors[idx]
                    ? "border-red-400 bg-white dark:bg-slate-950 focus-visible:ring-red-500"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950",
                )}
              />
              {errors[idx] && (
                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-bold px-1 animate-in fade-in slide-in-from-top-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {errors[idx]}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="pb-8 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-col items-center justify-center gap-0">
          <Button
            onClick={handleSaveAndCheck}
            disabled={isValidating}
            className="flex-1 py-3 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> กำลังตรวจสอบ...
              </>
            ) : (
              "ตรวจสอบและบันทึกข้อมูล"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
