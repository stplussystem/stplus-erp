"use client";

import React, { useState, useEffect } from "react";
import { Timer, ArrowLeft, Package, RefreshCw, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";

interface TurnaroundRow {
  ticket: {
    ticket_number: string;
    received_at: string;
    returned_at: string;
    repair_cost: number;
    contact: { business_name?: string; contact_person_name?: string } | null;
  };
  turnaround_days: number;
}

export default function RepairTurnaroundReportPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<TurnaroundRow[]>([]);
  const [avgDays, setAvgDays] = useState(0);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/repair-turnaround?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setRows(result.data?.rows || []);
        setAvgDays(result.data?.avg_turnaround_days || 0);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/repair-turnaround/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `repair_turnaround_${Date.now()}.xlsx`;
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
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานเวลาซ่อมเฉลี่ย</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">ระยะเวลาตั้งแต่รับเครื่องจนถึงคืนเครื่องของแต่ละใบซ่อม</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/repairs-summary"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> รายงานสรุปงานซ่อม
          </Link>
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-slate-200 hover:border-slate-300 text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 lg:sticky lg:top-4 print:hidden">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">วันที่เริ่มต้น (รับเครื่อง)</label>
            <AppDatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">วันที่สิ้นสุด</label>
            <AppDatePicker value={dateTo} onChange={setDateTo} />
          </div>
          <button
            onClick={clearFilters}
            className="w-full h-10 px-4 flex items-center justify-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
          </button>
        </div>

        <div className="space-y-4">
          {!loading && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-3 w-full sm:w-64">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">เวลาซ่อมเฉลี่ย</div>
                <div className="text-xl font-black text-slate-800">{avgDays} วัน</div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {loading ? (
              <AppLoading />
            ) : rows.length === 0 ? (
              <div className="text-center py-14">
                <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">ไม่มีใบซ่อมที่คืนเครื่องแล้วตามเงื่อนไขที่เลือก</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-bold text-left">เลขที่ใบซ่อม</th>
                      <th className="px-6 py-4 font-bold text-left">ลูกค้า</th>
                      <th className="px-6 py-4 font-bold text-left">รับเครื่อง</th>
                      <th className="px-6 py-4 font-bold text-left">คืนเครื่อง</th>
                      <th className="px-6 py-4 font-bold text-right">จำนวนวัน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{row.ticket.ticket_number}</td>
                        <td className="px-6 py-4 text-slate-700">
                          {row.ticket.contact?.business_name || row.ticket.contact?.contact_person_name || "-"}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(row.ticket.received_at).toLocaleDateString("th-TH")}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(row.ticket.returned_at).toLocaleDateString("th-TH")}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-indigo-600">{row.turnaround_days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
