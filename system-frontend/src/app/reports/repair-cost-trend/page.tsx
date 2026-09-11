"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { LineChart, ArrowLeft, Package, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";

interface TrendRow {
  month: string;
  ticket_count: number;
  total_cost: number;
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function RepairCostTrendReportPageContent() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/repair-cost-trend?${params}`, {
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

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  const maxCost = Math.max(1, ...rows.map((r) => Number(r.total_cost)));

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <LineChart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">แนวโน้มค่าซ่อมรายเดือน</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">จำนวนใบซ่อมและค่าซ่อมรวมแยกตามเดือน (นับจากวันรับเครื่อง)</p>
          </div>
        </div>
        <Link
          href="/reports/repairs-summary"
          className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> รายงานสรุปงานซ่อม
        </Link>
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

        <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
          {loading ? (
            <AppLoading />
          ) : rows.length === 0 ? (
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-muted-foreground">ยังไม่มีข้อมูลค่าซ่อม</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => (
                <div key={row.month}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground">{row.month}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground">{money(row.total_cost)}</span>
                      <span className="text-xs text-muted-foreground ml-2">{row.ticket_count} ใบซ่อม</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full"
                      style={{ width: `${(Number(row.total_cost) / maxCost) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RepairCostTrendReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_repair_cost_trend">
      <RepairCostTrendReportPageContent />
    </RoleRouteGuard>
  );
}
