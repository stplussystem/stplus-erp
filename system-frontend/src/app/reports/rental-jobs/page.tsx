"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { Coins, ArrowLeft, Package, RefreshCw, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { cn } from "@/lib/utils";

interface RentalJobRow {
  job: {
    id: number;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    contact: { business_name?: string; contact_person_name?: string } | null;
  };
  revenue: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  confirmed: "ยืนยันแล้ว",
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function RentalJobsReportPageContent() {
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<RentalJobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/rental-jobs?${buildParams()}`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/rental-jobs/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rental_jobs_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const clearFilters = () => setStatus("all");

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานงานเช่า</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">รายได้จริงต่อรายการงานเช่าแต่ละงาน</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/rental-jobs"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> งานเช่า
          </Link>
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-4 lg:sticky lg:top-4 print:hidden">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">สถานะ</label>
            <AppSelect
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "ทั้งหมด" },
                { value: "draft", label: "ร่าง" },
                { value: "confirmed", label: "ยืนยันแล้ว" },
                { value: "in_progress", label: "กำลังดำเนินการ" },
                { value: "completed", label: "เสร็จสิ้น" },
                { value: "cancelled", label: "ยกเลิก" },
              ]}
            />
          </div>
          <button
            onClick={clearFilters}
            className="w-full h-10 px-4 flex items-center justify-center gap-2 text-foreground bg-background border border-border hover:bg-muted rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
          </button>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          {loading ? (
            <AppLoading />
          ) : rows.length === 0 ? (
            <div className="text-center py-14">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-muted-foreground">ยังไม่มีงานเช่าตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-bold text-left">ชื่องานเช่า</th>
                    <th className="px-6 py-4 font-bold text-left">ลูกค้า</th>
                    <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                    <th className="px-6 py-4 font-bold text-left">ช่วงเวลา</th>
                    <th className="px-6 py-4 font-bold text-right">รายได้</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.job.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{row.job.name}</td>
                      <td className="px-6 py-4 text-foreground">
                        {row.job.contact?.business_name || row.job.contact?.contact_person_name || "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            row.job.status === "completed"
                              ? "bg-green-50 text-green-600 border-green-200"
                              : row.job.status === "cancelled"
                                ? "bg-red-50 text-red-600 border-red-200"
                                : "bg-blue-50 text-blue-600 border-blue-200",
                          )}
                        >
                          {STATUS_LABEL[row.job.status] || row.job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {row.job.start_date ? dayjs(row.job.start_date).format("DD/MM/YYYY") : "-"}
                        {" - "}
                        {row.job.end_date ? dayjs(row.job.end_date).format("DD/MM/YYYY") : "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">{money(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RentalJobsReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_rental_jobs">
      <RentalJobsReportPageContent />
    </RoleRouteGuard>
  );
}
