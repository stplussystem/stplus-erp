"use client";

import React, { useState, useEffect } from "react";
import { Wallet, RefreshCw, FileSpreadsheet, TrendingUp, Coins, Clock } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";

interface MarginTrendRow {
  month: string;
  sale_amount: number;
  cost_amount: number;
  margin_amount: number;
}

interface CashPositionRow {
  month: string;
  cash_in: number;
  cash_out: number;
  net: number;
}

interface ArApBuckets {
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
}

interface ArApData {
  ar: { totals: ArApBuckets; total: number };
  ap: { totals: ArApBuckets; total: number };
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function ExecutiveSummaryReportPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [marginTrend, setMarginTrend] = useState<MarginTrendRow[]>([]);
  const [cashPosition, setCashPosition] = useState<CashPositionRow[]>([]);
  const [arApData, setArApData] = useState<ArApData | null>(null);
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
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const [marginRes, cashRes, arApRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/company-margin-trend?${buildParams()}`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/cash-position`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/ar-ap-comparison`, { headers }),
      ]);
      if (marginRes.ok) setMarginTrend((await marginRes.json()).data || []);
      if (cashRes.ok) setCashPosition((await cashRes.json()).data || []);
      if (arApRes.ok) setArApData((await arApRes.json()).data || null);
    } catch (error) {
      toast.error("โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleExportMargin = async () => {
    const toastId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/company-margin-trend/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `company_margin_trend_${Date.now()}.xlsx`;
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

  const maxMargin = Math.max(1, ...marginTrend.map((r) => Math.abs(Number(r.sale_amount))));
  const maxCash = Math.max(1, ...cashPosition.map((r) => Math.max(Number(r.cash_in), Number(r.cash_out))));

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานสำหรับผู้บริหาร</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              กำไรขั้นต้นรวมบริษัท กระแสเงินสดโดยประมาณ และเปรียบเทียบลูกหนี้-เจ้าหนี้
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportMargin}
            className="h-10 px-5 py-2 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-slate-200 hover:border-slate-300 text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออกกำไรขั้นต้น
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 lg:sticky lg:top-4 print:hidden">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">วันที่เริ่มต้น</label>
            <AppDatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">วันที่สิ้นสุด</label>
            <AppDatePicker value={dateTo} onChange={setDateTo} />
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            ตัวกรองวันที่มีผลกับกำไรขั้นต้นรายเดือนเท่านั้น กระแสเงินสดและ AR/AP แสดงข้อมูลทั้งหมด
          </p>
          <button
            onClick={clearFilters}
            className="w-full h-10 px-4 flex items-center justify-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
          </button>
        </div>

        {loading ? (
          <AppLoading />
        ) : (
          <div className="space-y-6">
            {/* กำไรขั้นต้นรวมบริษัท + แนวโน้มรายเดือน */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" /> กำไรขั้นต้นรวมบริษัท (รายเดือน)
              </h3>
              {marginTrend.length === 0 ? (
                <p className="text-sm text-slate-400">ยังไม่มีข้อมูลยอดขาย</p>
              ) : (
                <div className="space-y-4">
                  {marginTrend.map((row) => (
                    <div key={row.month}>
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-medium text-slate-700">{row.month}</span>
                        <span className="text-slate-500">
                          ขาย {money(row.sale_amount)} · ต้นทุน {money(row.cost_amount)} ·{" "}
                          <span className={row.margin_amount >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                            กำไร {money(row.margin_amount)}
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${(Math.abs(Number(row.sale_amount)) / maxMargin) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* กระแสเงินสดโดยประมาณ */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Coins className="w-4 h-4 text-blue-600" /> กระแสเงินสดโดยประมาณ (รายเดือน)
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">
                ยอดรับ = บิลเงินสด/ใบเสร็จที่อนุมัติแล้ว, ยอดจ่าย = ใบสั่งซื้อที่ยืนยัน/รับของครบแล้ว (ไม่ใช่บัญชีเงินสดจริง)
              </p>
              {cashPosition.length === 0 ? (
                <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
              ) : (
                <div className="space-y-4">
                  {cashPosition.map((row) => (
                    <div key={row.month}>
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-medium text-slate-700">{row.month}</span>
                        <span className="text-slate-500">
                          รับ {money(row.cash_in)} · จ่าย {money(row.cash_out)} ·{" "}
                          <span className={row.net >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                            สุทธิ {money(row.net)}
                          </span>
                        </span>
                      </div>
                      <div className="flex gap-1 h-2.5">
                        <div className="flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(Number(row.cash_in) / maxCash) * 100}%` }}
                          />
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full ml-auto"
                            style={{ width: `${(Number(row.cash_out) / maxCash) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* เปรียบเทียบ AR vs AP */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" /> เปรียบเทียบลูกหนี้ (AR) กับเจ้าหนี้ (AP)
              </h3>
              {arApData ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                    <div className="text-xs text-blue-600 font-bold mb-1">ลูกหนี้ค้างชำระรวม (AR)</div>
                    <div className="text-xl font-black text-slate-800 mb-3">{money(arApData.ar.total)}</div>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>0-30 วัน</span>
                        <span>{money(arApData.ar.totals.b0_30)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>31-90 วัน</span>
                        <span>{money(arApData.ar.totals.b31_60 + arApData.ar.totals.b61_90)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>มากกว่า 90 วัน</span>
                        <span>{money(arApData.ar.totals.b90_plus)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-orange-50/50 border border-orange-100">
                    <div className="text-xs text-orange-600 font-bold mb-1">เจ้าหนี้ค้างจ่ายรวม (AP)</div>
                    <div className="text-xl font-black text-slate-800 mb-3">{money(arApData.ap.total)}</div>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>0-30 วัน</span>
                        <span>{money(arApData.ap.totals.b0_30)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>31-90 วัน</span>
                        <span>{money(arApData.ap.totals.b31_60 + arApData.ap.totals.b61_90)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>มากกว่า 90 วัน</span>
                        <span>{money(arApData.ap.totals.b90_plus)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
