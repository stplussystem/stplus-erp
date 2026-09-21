"use client";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Lock, Loader2, XCircle } from "lucide-react";
import { getToken } from "@/lib/auth-storage";

interface ReservationDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | number;
  productName?: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  stock_issue: "ใบเบิกสินค้าเช่า",
  loan_issue: "ใบยืมสินค้า",
};

// 🎗️ Popup แสดงรายละเอียดจำนวนที่ "ติดจอง/ติดยืม" ของสินค้าชิ้นหนึ่ง ณ ตอนนี้ — เปิดจากคอลัมน์ในตารางสร้างใบยืมสินค้า
// สินค้าคุม S/N แสดงเป็นรายชิ้น (แม่นยำ 100%) ส่วนสินค้าไม่คุม S/N แสดงเป็นยอดรวมต่อเอกสารที่ยังไม่ถูกคืนครบ
export function ReservationDetailsDialog({
  isOpen,
  onClose,
  productId,
  productName,
}: ReservationDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"serial" | "aggregate">("aggregate");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, productId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/products/${productId}/reservation-details`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setType(data.type || "aggregate");
        setRows(data.data || []);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[95vw] md:!max-w-[650px] dark:bg-slate-900 border-none shadow-2xl rounded-3xl overflow-hidden p-0 [&>button]:hidden">
        <div className="p-6 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between">
          <DialogTitle className="flex flex-col gap-1">
            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" strokeWidth={2} />
              รายละเอียดที่ติดจอง/ติดยืม{productName ? ` — ${productName}` : ""}
            </div>
            <p className="text-[11px] text-muted-foreground italic font-normal">
              รายการเอกสารที่กำลังล็อกสินค้าชิ้นนี้อยู่ตอนนี้
            </p>
          </DialogTitle>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[55vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> กำลังโหลดข้อมูล...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground font-medium bg-muted/50 rounded-xl border border-dashed border-border">
              ไม่มีรายการที่ติดจอง/ติดยืมอยู่ตอนนี้
            </div>
          ) : (
            <div className="overflow-x-auto hide-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                  <tr>
                    {type === "serial" && <th className="px-3 py-2 font-bold">S/N</th>}
                    <th className="px-3 py-2 font-bold">เอกสาร</th>
                    <th className="px-3 py-2 font-bold">ผู้ยืม/ลูกค้า</th>
                    {type === "aggregate" && (
                      <th className="px-3 py-2 text-right font-bold">จำนวน</th>
                    )}
                    <th className="px-3 py-2 font-bold">วันที่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/50">
                      {type === "serial" && (
                        <td className="px-3 py-2.5 font-mono text-foreground">{row.serial_number}</td>
                      )}
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-foreground">{row.document_number}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {DOC_TYPE_LABELS[row.document_type] || row.document_type}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.party}</td>
                      {type === "aggregate" && (
                        <td className="px-3 py-2.5 text-right font-bold text-foreground">
                          {row.quantity}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-muted-foreground">{row.date || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
