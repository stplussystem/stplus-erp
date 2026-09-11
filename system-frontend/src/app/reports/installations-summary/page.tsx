"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { LineChart, RefreshCw, Hammer, Clock, FileSpreadsheet, Printer, FolderKanban } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";

interface SummaryData {
  total_records: number;
  by_status: Record<string, number>;
  avg_days_to_install: number;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "นัดหมายแล้ว",
  installed: "ติดตั้งเสร็จ",
  cancelled: "ยกเลิก",
};

function InstallationsSummaryReportPageContent() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    return params;
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/installations-summary?${buildParams()}`, {
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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/installations-summary/export?${buildParams()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `installations_summary_${Date.now()}.xlsx`;
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

  const maxCount = data ? Math.max(1, ...Object.values(data.by_status)) : 1;

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <LineChart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานสรุปงานติดตั้ง</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              สรุปจำนวนงานติดตั้งตามสถานะ และเวลาเฉลี่ยตั้งแต่นัดหมายถึงติดตั้งเสร็จ
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/installations-by-project"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
          >
            <FolderKanban className="w-4 h-4" /> แยกตามโครงการ
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
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่เริ่มต้น (นัดหมาย)</label>
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
        ) : data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Hammer className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">จำนวนงานติดตั้งทั้งหมด</div>
                  <div className="text-xl font-black text-foreground">{data.total_records}</div>
                </div>
              </div>
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
                <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">เวลาเฉลี่ยติดตั้งเสร็จ</div>
                  <div className="text-xl font-black text-foreground">{data.avg_days_to_install} วัน</div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">แยกตามสถานะ</h3>
              {Object.keys(data.by_status).length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-3">
                  {Object.entries(data.by_status).map(([statusKey, count]) => (
                    <div key={statusKey}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{STATUS_LABEL[statusKey] || statusKey}</span>
                        <span className="font-bold text-foreground">{count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function InstallationsSummaryReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_installations">
      <InstallationsSummaryReportPageContent />
    </RoleRouteGuard>
  );
}
