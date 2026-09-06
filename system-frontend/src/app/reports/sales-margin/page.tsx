"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { PercentCircle, ArrowLeft, Package, RefreshCw, FileSpreadsheet, Printer, Coins, TrendingUp } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { AppDatePicker } from "@/components/ui/app-date-picker";

interface MarginRow {
  product: { name?: string; sku?: string } | null;
  qty: number;
  sale_amount: number;
  cost_amount: number | null;
  margin_amount: number | null;
  margin_pct: number | null;
}

interface MarginData {
  rows: MarginRow[];
  total_sale_amount: number;
  total_cost_amount: number;
  total_margin_amount: number;
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function SalesMarginReportPageContent() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<MarginData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/sales-margin?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      }
    } catch (error) {
      toast.error("โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const toastId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/sales-margin/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales_margin_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <PercentCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานกำไรขั้นต้นต่อรายการขาย</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              เทียบยอดขายกับต้นทุนถัวเฉลี่ยถ่วงน้ำหนักต่อสินค้า (คำนวณจากใบรับสินค้า)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/sales-summary"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> รายงานยอดขาย
          </Link>
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
          <button
            onClick={() => window.print()}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Printer className="w-4 h-4" /> พิมพ์
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-4 lg:sticky lg:top-4 print:hidden">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่เริ่มต้น</label>
            <AppDatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่สิ้นสุด</label>
            <AppDatePicker value={dateTo} onChange={setDateTo} />
          </div>
          <button
            onClick={clearFilters}
            className="w-full h-10 px-4 flex items-center justify-center gap-2 text-foreground bg-background border border-border hover:bg-muted rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
          </button>
        </div>

        {loading ? (
          <AppLoading />
        ) : !data || data.rows.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-muted-foreground">ยังไม่มีข้อมูลยอดขายตามเงื่อนไขที่เลือก</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ยอดขายรวม</div>
                  <div className="text-lg font-black text-foreground">{money(data.total_sale_amount)}</div>
                </div>
              </div>
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ต้นทุนรวม</div>
                  <div className="text-lg font-black text-foreground">{money(data.total_cost_amount)}</div>
                </div>
              </div>
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
                <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">กำไรขั้นต้นรวม</div>
                  <div className="text-lg font-black text-foreground">{money(data.total_margin_amount)}</div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-bold text-left">สินค้า</th>
                      <th className="px-6 py-4 font-bold text-right">จำนวน</th>
                      <th className="px-6 py-4 font-bold text-right">ยอดขาย</th>
                      <th className="px-6 py-4 font-bold text-right">ต้นทุน</th>
                      <th className="px-6 py-4 font-bold text-right">กำไรขั้นต้น</th>
                      <th className="px-6 py-4 font-bold text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-foreground">{row.product?.name || "-"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{row.product?.sku || "-"}</div>
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground">{row.qty}</td>
                        <td className="px-6 py-4 text-right text-foreground">{money(row.sale_amount)}</td>
                        <td className="px-6 py-4 text-right text-muted-foreground">
                          {row.cost_amount !== null ? money(row.cost_amount) : "-"}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-bold ${
                            row.margin_amount === null
                              ? "text-muted-foreground"
                              : row.margin_amount >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {row.margin_amount !== null ? money(row.margin_amount) : "-"}
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground">
                          {row.margin_pct !== null ? `${row.margin_pct}%` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SalesMarginReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_sales_margin">
      <SalesMarginReportPageContent />
    </RoleRouteGuard>
  );
}
