"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Printer,
  Download,
  FileText,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function GoodsReceiptDetailPage() {
  const router = useRouter();
  const params = useParams();
  const grId = params.id as string;

  const [gr, setGr] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (grId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grId]);

  const fetchData = async () => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const [grRes, itemsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/goods-receipts/${grId}`, { headers, cache: "no-store" }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/goods-receipts/${grId}/items`, { headers, cache: "no-store" }),
      ]);
      if (!grRes.ok) {
        toast.error("ไม่พบข้อมูลใบรับสินค้า");
        router.push("/goods-receipts");
        return;
      }
      const grData = await grRes.json();
      const itemsData = await itemsRes.json();
      setGr(grData.data || grData);
      setItems(Array.isArray(itemsData) ? itemsData : []);
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async (action: "print" | "download") => {
    const toastId = toast.loading("กำลังเตรียมเอกสาร...");
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const compRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/company`, { headers });
      const compData = await compRes.json();
      const companySettings = Array.isArray(compData) ? compData[0] : compData.data || compData;

      const { pdf } = await import("@react-pdf/renderer");
      const { default: GRPdfTemplate } = await import("@/components/documents/GRPdfTemplate");

      const pdfDataObj = {
        companySettings,
        grData: gr,
        items,
        creator: gr.creator || null,
        ...getPaperSizeConfig(companySettings, "goods_receipt"),
      };

      const blob = await pdf(<GRPdfTemplate data={pdfDataObj} />).toBlob();
      const url = URL.createObjectURL(blob);
      toast.dismiss(toastId);

      if (action === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${gr.gr_number}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setPreviewUrl(url);
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("สร้างเอกสาร PDF ไม่สำเร็จ");
    }
  };

  if (loading) return <AppLoading text="กำลังโหลดข้อมูลใบรับสินค้า..." minHeight="min-h-screen" />;
  if (!gr) return null;

  const isCancelled = gr.status === "Cancelled";

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-md font-bold tracking-tight text-foreground">{gr.gr_number}</h1>
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border ${
                isCancelled
                  ? "bg-red-100 text-red-700 border-red-200"
                  : "bg-green-100 text-green-700 border-green-200"
              }`}
            >
              {isCancelled ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {isCancelled ? "ยกเลิกเอกสาร" : "สำเร็จ"}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            สร้างเมื่อ {dayjs(gr.created_at).format("DD/MM/YYYY HH:mm")} โดย {gr.creator?.name || "-"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/goods-receipts">
            <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
              <ArrowLeft className="w-5 h-5" /> ย้อนกลับ
            </button>
          </Link>
          <button
            onClick={() => handleGeneratePdf("print")}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Printer className="w-4 h-4" /> พิมพ์เอกสาร
          </button>
          <button
            onClick={() => handleGeneratePdf("download")}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Download className="w-4 h-4" /> ดาวน์โหลด PDF
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="p-6 border-b md:border-b-0 md:border-r border-border">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              รับสินค้าจาก (Supplier)
            </h3>
            <div className="text-lg font-bold text-foreground">
              {gr.business_name || gr.contact_name || "ไม่ระบุข้อมูลผู้จำหน่าย"}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              เอกสารอ้างอิงภายนอก: {gr.reference_number || "-"}
            </div>
          </div>
          <div className="p-6 bg-muted/50">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              รายละเอียดเอกสาร
            </h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <div className="text-xs text-muted-foreground">วันที่รับเข้า</div>
                <div className="font-medium text-foreground">
                  {gr.received_date ? dayjs(gr.received_date).format("DD/MM/YYYY") : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">อ้างอิง PO</div>
                <div className="font-medium text-blue-600 font-bold">{gr.po_number || "รับตรงไม่มี PO"}</div>
              </div>
            </div>
            {gr.note && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">หมายเหตุ</div>
                <div className="text-sm text-foreground mt-1">{gr.note}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        <div className="p-4 border-b border-border bg-muted/50 flex justify-between items-center">
          <h3 className="font-bold text-foreground">รายการสินค้าที่รับเข้าคลัง</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-transparent text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-6 py-4">รายการสินค้า</th>
                <th className="px-6 py-4 text-center">จำนวนรับ</th>
                <th className="px-6 py-4">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item: any, idx: number) => (
                <tr key={item.id ?? idx} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">
                      {item.product_name || item.product?.name || `Product ID: ${item.product_id}`}
                    </div>
                    {item.product?.sku && (
                      <div className="text-xs text-muted-foreground mt-1">{item.product.sku}</div>
                    )}
                    {/* 🆕 [2026-09-23] S/N ที่รับเข้าพร้อมรายการนี้ (ถ้าเป็นสินค้าคุม S/N) — คลิกไปดูประวัติเต็มของ
                    เลขนั้นได้ที่หน้ารายงานประวัติ S/N */}
                    {Array.isArray(item.serials) && item.serials.length > 0 && (
                      <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1.5">
                        {item.serials.map((sn: string) => (
                          <Link
                            key={sn}
                            href={`/reports/serial-history?sn=${encodeURIComponent(sn)}`}
                            className="font-mono text-xs text-blue-600 hover:underline"
                          >
                            {sn}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-foreground">{item.quantity}</td>
                  <td className="px-6 py-4 text-muted-foreground">{item.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ตัวอย่างเอกสาร
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-muted p-2">
              <iframe src={previewUrl} className="w-full h-full rounded-xl border border-border" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
