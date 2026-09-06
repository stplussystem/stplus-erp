"use client";

import React, { useState, useEffect } from "react";
import { PackageX, ArrowLeft, Package, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";

interface OverdueRow {
  serial: { serial_number: string; product: { name?: string; sku?: string } | null };
  rental_job: { name?: string; end_date?: string } | null;
  contact: { business_name?: string; contact_person_name?: string } | null;
  days_overdue: number;
}

export default function OverdueRentalsReportPage() {
  const [rows, setRows] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/overdue-rentals`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/overdue-rentals/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `overdue_rentals_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <PackageX className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานอุปกรณ์เช่าค้างคืน</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              อุปกรณ์ที่ยังไม่คืนและเลยกำหนดวันสิ้นสุดของงานเช่าที่ผูกอยู่
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/rental-jobs"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> งานเช่า
          </Link>
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-slate-200 hover:border-slate-300 text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <AppLoading />
        ) : rows.length === 0 ? (
          <div className="text-center py-14">
            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400">ไม่มีอุปกรณ์เช่าค้างคืนในขณะนี้</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold text-left">S/N</th>
                  <th className="px-6 py-4 font-bold text-left">สินค้า</th>
                  <th className="px-6 py-4 font-bold text-left">ลูกค้า</th>
                  <th className="px-6 py-4 font-bold text-left">งานเช่า</th>
                  <th className="px-6 py-4 font-bold text-left">ครบกำหนดคืน</th>
                  <th className="px-6 py-4 font-bold text-right">เกินกำหนด (วัน)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{row.serial.serial_number}</td>
                    <td className="px-6 py-4 text-slate-600">{row.serial.product?.name || "-"}</td>
                    <td className="px-6 py-4 text-slate-700">
                      {row.contact?.business_name || row.contact?.contact_person_name || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{row.rental_job?.name || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {row.rental_job?.end_date ? new Date(row.rental_job.end_date).toLocaleDateString("th-TH") : "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-red-600">{row.days_overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
