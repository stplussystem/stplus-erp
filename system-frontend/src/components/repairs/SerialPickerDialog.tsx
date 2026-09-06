"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListOrdered, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";

interface SerialPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | number;
  productName?: string;
  quantity: number;
  value: string[];
  onConfirm: (serials: string[]) => void;
  // 🎪 endpoint ทางเลือก แทน /products/{id}/available-serials ปกติ — ต้องคืนรูปแบบเดียวกัน { data: string[] }
  // ใช้ตอนเลือก S/N ที่จะคืนจากใบเบิกสินค้าใบใดใบหนึ่งโดยเฉพาะ (เช่น /sale-documents/{issueId}/rented-serials?product_id=X)
  fetchUrl?: string;
  // 🎗️ โหมดยืดหยุ่น — ใช้ตอนยังไม่รู้จำนวนล่วงหน้า (เช่น ใบยืมสินค้า) เลือกได้ตั้งแต่ 1 ถึง `quantity` (ทำหน้าที่เป็นเพดานสูงสุด
  // แทนเป้าหมายที่ต้องตรงเป๊ะ) แล้ว onConfirm จะส่งจำนวนที่เลือกจริงกลับไปให้ผู้เรียกนำไปตั้งเป็น quantity ของแถวเอง
  flexible?: boolean;
}

// 🔧 เลือก S/N จากรายการที่ "มีอยู่จริงในสต๊อก" (ต่างจาก SerialManager ที่พิมพ์อิสระสำหรับรับเข้า/เบิกออกแบบ manual)
// ใช้สำหรับหน้าขาย (tax-invoice/cash-sale/receipt) ที่ต้องเลือก S/N จริงจากของที่มี ไม่ใช่พิมพ์เอง
export function SerialPickerDialog({
  isOpen,
  onClose,
  productId,
  productName,
  quantity,
  value,
  onConfirm,
  fetchUrl,
  flexible = false,
}: SerialPickerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [availableSerials, setAvailableSerials] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(value || []);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(value || []);
    fetchAvailableSerials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, productId, fetchUrl]);

  const fetchAvailableSerials = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const url =
        fetchUrl ||
        `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}/available-serials`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableSerials(data.data || []);
      }
    } catch (error) {
      toast.error("โหลดรายการ S/N ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const toggleSerial = (sn: string) => {
    setSelected((prev) => {
      if (prev.includes(sn)) return prev.filter((s) => s !== sn);
      if (prev.length >= quantity) {
        toast.error(`เลือกได้สูงสุด ${quantity} รายการ`);
        return prev;
      }
      return [...prev, sn];
    });
  };

  const handleConfirm = () => {
    if (flexible) {
      if (selected.length === 0) {
        toast.error("กรุณาเลือก S/N อย่างน้อย 1 รายการ");
        return;
      }
    } else if (selected.length !== quantity) {
      toast.error(`กรุณาเลือก S/N ให้ครบ ${quantity} รายการ (เลือกแล้ว ${selected.length})`);
      return;
    }
    onConfirm(selected);
    onClose();
  };

  // รวม S/N ที่ถูกเลือกไว้แล้ว (จาก value เดิม) เข้ากับรายการที่มีอยู่ในสต๊อกตอนนี้ เผื่อกรณีแก้ไขเอกสารที่เคยเลือกไปแล้ว
  const displaySerials = Array.from(new Set([...availableSerials, ...(value || [])]));

  return (
    <Dialog open={isOpen} onOpenChange={loading ? () => {} : onClose}>
      <DialogContent className="!max-w-[95vw] md:!max-w-[700px] dark:bg-slate-900 border-none shadow-2xl rounded-3xl overflow-hidden p-0">
        <DialogHeader className="p-6 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <DialogTitle className="flex flex-col gap-1 text-2xl font-bold">
            <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-blue-500" strokeWidth={2} />
              เลือก Serial Number{productName ? ` — ${productName}` : ""}
            </div>
            <p className="text-[11px] text-slate-400 italic font-normal">
              {flexible
                ? `เลือก S/N ที่จะยืม (เลือกแล้ว ${selected.length}, สูงสุด ${quantity} รายการ)`
                : `เลือก S/N ให้ครบ ${quantity} รายการ (เลือกแล้ว ${selected.length}/${quantity})`}
            </p>
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 md:p-8 max-h-[55vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> กำลังโหลด S/N คงเหลือ...
            </div>
          ) : displaySerials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 gap-2">
              <AlertCircle className="w-8 h-8" />
              ไม่มี S/N คงเหลือในสต๊อกสำหรับสินค้านี้
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {displaySerials.map((sn) => {
                const isSelected = selected.includes(sn);
                return (
                  <button
                    key={sn}
                    type="button"
                    onClick={() => toggleSerial(sn)}
                    className={cn(
                      "flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer text-left",
                      isSelected
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    <span className="font-mono">{sn}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl font-bold cursor-pointer transition-all"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 cursor-pointer transition-all disabled:opacity-50"
            >
              ยืนยัน ({flexible ? selected.length : `${selected.length}/${quantity}`})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
