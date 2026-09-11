"use client";

import React, { useEffect, useState } from "react";
import { History, XCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { getPaperSizeConfig, getQuotationHeaderBackgroundUrl } from "@/lib/letterLayoutDefaults";
import { getPrintLayoutConfig } from "@/lib/printLayoutDefaults";

// 🚀 ปุ่ม "ดูรายการขายล่าสุด" ต่อแถวสินค้า (หน้าสร้าง/แก้ไขใบเสนอราคา) — ราคาที่เคยขายสินค้านี้ให้ลูกค้ารายนี้
// 5 ครั้งล่าสุด (เฉพาะใบกำกับภาษีที่อนุมัติแล้ว) กดดูแต่ละรายการเพื่อพรีวิว PDF ใบกำกับภาษีจริง
// โครงสร้างอ้างจาก modal ประวัติการซื้อใน purchase-orders/[id]/page.tsx — extract เป็น component กลาง
// เพราะหน้าสร้าง/แก้ไขใบเสนอราคาต้องใช้ฟีเจอร์เดียวกันทั้งคู่
type SalesHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  productId: string | number | null;
  productName?: string;
  contactId: string | number | null;
  companySettings: any;
};

export function SalesHistoryModal({
  open,
  onClose,
  productId,
  productName,
  contactId,
  companySettings,
}: SalesHistoryModalProps) {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewGenerating, setPreviewGenerating] = useState(false);

  useEffect(() => {
    if (open && productId && contactId) {
      fetchHistory();
    }
    if (!open) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setHistoryData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, contactId]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(
        `${apiUrl}/products/${productId}/sales-history?contact_id=${contactId}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        },
      );
      if (res.ok) {
        const json = await res.json();
        setHistoryData(json.data || []);
      }
    } catch (err) {
      toast.error("ดึงข้อมูลประวัติการขายไม่สำเร็จ");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewDocument = async (documentId: number) => {
    setPreviewGenerating(true);
    const toastId = toast.loading("กำลังเตรียมเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error("ไม่พบข้อมูลเอกสาร");
      const fullDoc = (await res.json()).data;

      const finance = {
        subtotal: Number(fullDoc.subtotal),
        discount: Number(fullDoc.discount_amount),
        after_discount: Number(fullDoc.subtotal) - Number(fullDoc.discount_amount),
        vat_amount: Number(fullDoc.vat_amount),
        wht_amount: Number(fullDoc.wht_amount),
        grand_total: Number(fullDoc.grand_total),
      };

      const { pdf } = await import("@react-pdf/renderer");
      const { default: SalesPdfTemplate } =
        await import("@/components/documents/SalesPdfTemplate");
      const { paperSize, letterLayout } = getPaperSizeConfig(companySettings, "tax_invoice");
      const { layout: printLayout } = getPrintLayoutConfig(companySettings, "tax_invoice", paperSize);
      const quotationHeaderBackgroundUrl = getQuotationHeaderBackgroundUrl(companySettings);

      const blob = await pdf(
        <SalesPdfTemplate
          data={{
            companySettings,
            formData: fullDoc,
            selectedContact: fullDoc.contact,
            items: fullDoc.items,
            finance,
            documentNumber: fullDoc.document_number,
            paperSize,
            letterLayout,
            printLayout,
            quotationHeaderBackgroundUrl,
          }}
        />,
      ).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (error: any) {
      toast.error(error.message || "สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    } finally {
      setPreviewGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-card rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
          <div className="p-5 border-b border-border flex justify-between items-center bg-muted/50">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              รายการขายล่าสุด :{" "}
              <span className="text-indigo-600">{productName}</span>
            </h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-red-500 cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6">
            {historyLoading ? (
              <AppLoading
                text="กำลังค้นหาข้อมูลจากฐานข้อมูล..."
                minHeight="min-h-[160px]"
              />
            ) : historyData.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground font-medium bg-muted/50 rounded-xl border border-dashed border-border">
                ไม่พบประวัติการขายสินค้านี้ให้ลูกค้ารายนี้
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                    <tr>
                      <th className="px-4 py-3">วันที่</th>
                      <th className="px-4 py-3">เลขที่ใบกำกับภาษี</th>
                      <th className="px-4 py-3 text-center">จำนวน</th>
                      <th className="px-4 py-3 text-right">ราคาต่อหน่วย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historyData.map((h, i) => (
                      <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{h.date}</td>
                        <td className="px-4 py-3 font-bold text-indigo-600">
                          <button
                            type="button"
                            onClick={() => handleViewDocument(h.document_id)}
                            disabled={previewGenerating}
                            className="hover:underline hover:text-indigo-800 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {h.document_number}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-foreground">
                          {h.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {Number(h.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ใบกำกับภาษี
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1 text-muted-foreground hover:text-red-500 bg-background rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-muted p-2">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-xl border border-border"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
