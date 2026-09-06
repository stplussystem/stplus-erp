"use client";

import React, { useState, useEffect } from "react";
import { FileCheck2, ArrowLeft, RefreshCw, Printer, FileText, TrendingUp, Coins } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { AppDatePicker } from "@/components/ui/app-date-picker";

interface ConversionData {
  total_quotations: number;
  converted_count: number;
  conversion_rate: number;
  total_quotation_amount: number;
  converted_amount: number;
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function QuotationConversionReportPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<ConversionData | null>(null);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/quotation-conversion?${params}`, {
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

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">อัตราการปิดใบเสนอราคา</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              สัดส่วนใบเสนอราคาที่ถูกแปลงเป็นเอกสารขายที่อนุมัติแล้ว
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/sales-summary"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> รายงานยอดขาย
          </Link>
          <button
            onClick={() => window.print()}
            className="h-10 px-5 py-2 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-slate-200 hover:border-slate-300 text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Printer className="w-4 h-4" /> พิมพ์
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 lg:sticky lg:top-4 print:hidden">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">วันที่เริ่มต้น</label>
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

        {loading ? (
          <AppLoading />
        ) : data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">ใบเสนอราคาทั้งหมด</div>
                  <div className="text-xl font-black text-slate-800">{data.total_quotations}</div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-3">
                <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">ปิดการขายได้ / อัตราปิด</div>
                  <div className="text-xl font-black text-slate-800">
                    {data.converted_count} ใบ ({data.conversion_rate}%)
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">มูลค่าที่ปิดได้ / เสนอไปทั้งหมด</div>
                  <div className="text-base font-black text-slate-800">
                    {money(data.converted_amount)} / {money(data.total_quotation_amount)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-600">อัตราการปิดการขาย</span>
                <span className="font-bold text-slate-800">{data.conversion_rate}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, data.conversion_rate)}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
