"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, ArrowLeft, Package, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { cn } from "@/lib/utils";

interface WarrantyRow {
  record: {
    installation_number: string;
    site_name: string | null;
    warranty_expires_at: string;
    contact: { business_name?: string; contact_person_name?: string } | null;
    product: { name?: string; sku?: string } | null;
  };
  is_expired: boolean;
}

export default function WarrantyExpiryReportPage() {
  const [days, setDays] = useState("60");
  const [rows, setRows] = useState<WarrantyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/warranty-expiry?days=${days}`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/warranty-expiry/export?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `warranty_expiry_${Date.now()}.xlsx`;
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
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานประกันใกล้หมดอายุ</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">งานติดตั้งที่ระยะประกันใกล้ครบกำหนดหรือหมดอายุแล้ว</p>
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
            <label className="block text-xs font-medium text-slate-500 mb-1">ใกล้หมดประกันภายใน (วัน)</label>
            <AppSelect
              value={days}
              onValueChange={setDays}
              options={[
                { value: "30", label: "30 วัน" },
                { value: "60", label: "60 วัน" },
                { value: "90", label: "90 วัน" },
                { value: "180", label: "180 วัน" },
              ]}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <AppLoading />
          ) : rows.length === 0 ? (
            <div className="text-center py-14">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ไม่มีงานติดตั้งที่ประกันใกล้หมดอายุตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-bold text-left">เลขที่งานติดตั้ง</th>
                    <th className="px-6 py-4 font-bold text-left">ลูกค้า</th>
                    <th className="px-6 py-4 font-bold text-left">สินค้า</th>
                    <th className="px-6 py-4 font-bold text-left">วันหมดประกัน</th>
                    <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{row.record.installation_number}</td>
                      <td className="px-6 py-4 text-slate-700">
                        {row.record.contact?.business_name || row.record.contact?.contact_person_name || "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{row.record.product?.name || "-"}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(row.record.warranty_expires_at).toLocaleDateString("th-TH")}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            row.is_expired
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-amber-50 text-amber-600 border-amber-200",
                          )}
                        >
                          {row.is_expired ? "หมดประกันแล้ว" : "ใกล้หมดประกัน"}
                        </span>
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
  );
}
