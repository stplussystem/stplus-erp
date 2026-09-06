"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { TrendingUp, ArrowLeft, Package, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";

interface ProfitabilityRow {
  project: { id: number; name: string; status: string } | null;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number | null;
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function ProjectProfitabilityReportPageContent() {
  const [rows, setRows] = useState<ProfitabilityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/project-profitability`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setRows(result.data || []);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/project-profitability/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project_profitability_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.cost), 0);
  const totalProfit = rows.reduce((s, r) => s + Number(r.profit), 0);

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานกำไร-ขาดทุนต่อโครงการ</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              รวมยอดขายจริงทุกประเภทเอกสารเทียบกับต้นทุนจัดซื้อทั้งหมดของแต่ละโครงการ
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/projects"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> โครงการ
          </Link>
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
        </div>
      </div>

      {loading ? (
        <AppLoading />
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
          <div className="text-center py-14">
            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-muted-foreground">ยังไม่มีโครงการที่มียอดขายหรือต้นทุนบันทึกไว้</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">รายได้รวม</div>
              <div className="text-lg font-black text-foreground">{money(totalRevenue)}</div>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">ต้นทุนรวม</div>
              <div className="text-lg font-black text-foreground">{money(totalCost)}</div>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">กำไร/ขาดทุนรวม</div>
              <div className={`text-lg font-black ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {money(totalProfit)}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-bold text-left">โครงการ</th>
                    <th className="px-6 py-4 font-bold text-right">รายได้</th>
                    <th className="px-6 py-4 font-bold text-right">ต้นทุน</th>
                    <th className="px-6 py-4 font-bold text-right">กำไร/ขาดทุน</th>
                    <th className="px-6 py-4 font-bold text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{row.project?.name || "-"}</td>
                      <td className="px-6 py-4 text-right text-foreground">{money(row.revenue)}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{money(row.cost)}</td>
                      <td
                        className={`px-6 py-4 text-right font-bold ${
                          row.profit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {money(row.profit)}
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
  );
}

export default function ProjectProfitabilityReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_project_profitability">
      <ProjectProfitabilityReportPageContent />
    </RoleRouteGuard>
  );
}
