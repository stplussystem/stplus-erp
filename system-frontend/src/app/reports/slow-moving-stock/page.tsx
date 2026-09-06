"use client";

import React, { useState, useEffect } from "react";
import { TimerOff, ArrowLeft, Package, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";

interface SlowMovingRow {
  product: { name?: string; sku?: string } | null;
  qty: number;
  last_out_at: string | null;
  days_since_out: number | null;
}

export default function SlowMovingStockReportPage() {
  const [days, setDays] = useState("90");
  const [rows, setRows] = useState<SlowMovingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/slow-moving-stock?days=${days}`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/slow-moving-stock/export?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `slow_moving_stock_${Date.now()}.xlsx`;
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
            <TimerOff className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">สินค้าเคลื่อนไหวช้า / ค้างสต๊อกนาน</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              สินค้าที่ยังมีสต๊อกอยู่ แต่ไม่มีการเบิกออกภายในช่วงเวลาที่กำหนด
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/inventory-valuation"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> รายงานสินค้าคงเหลือ
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
            <label className="block text-xs font-medium text-slate-500 mb-1">ไม่เบิกออกเกิน (วัน)</label>
            <AppSelect
              value={days}
              onValueChange={setDays}
              options={[
                { value: "30", label: "30 วัน" },
                { value: "60", label: "60 วัน" },
                { value: "90", label: "90 วัน" },
                { value: "180", label: "180 วัน" },
                { value: "365", label: "365 วัน" },
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
              <p className="text-slate-400">ไม่มีสินค้าค้างสต๊อกตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-bold text-left">สินค้า</th>
                    <th className="px-6 py-4 font-bold text-right">คงเหลือ</th>
                    <th className="px-6 py-4 font-bold text-left">เบิกออกล่าสุด</th>
                    <th className="px-6 py-4 font-bold text-right">จำนวนวันที่ค้าง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{row.product?.name || "-"}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{row.product?.sku || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700">{row.qty}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {row.last_out_at ? new Date(row.last_out_at).toLocaleDateString("th-TH") : "ไม่เคยเบิกออก"}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">
                        {row.days_since_out !== null ? row.days_since_out : "-"}
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
