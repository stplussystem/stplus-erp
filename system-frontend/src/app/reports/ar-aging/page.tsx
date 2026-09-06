"use client";

import React, { useState, useEffect } from "react";
import { Clock, ArrowLeft, Package, FileSpreadsheet, Printer } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";

interface AgingBuckets {
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
}

interface AgingRow {
  contact: { business_name?: string; contact_person_name?: string } | null;
  buckets: AgingBuckets;
  total: number;
}

interface AgingData {
  rows: AgingRow[];
  totals: AgingBuckets;
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function ArAgingReportPage() {
  const [contactId, setContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (contactId) params.set("contact_id", contactId);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/ar-aging?${buildParams()}`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/ar-aging/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ar_aging_${Date.now()}.xlsx`;
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
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานอายุลูกหนี้ (AR Aging)</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ยอดค้างชำระของลูกค้าแยกตามช่วงอายุหนี้ นับจากวันครบกำหนดชำระ
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
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-slate-200 hover:border-slate-300 text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
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
            <label className="block text-xs font-medium text-slate-500 mb-1">ลูกค้า</label>
            <ContactSearchDropdown
              value={contactId}
              selectedName={selectedContact?.business_name || selectedContact?.name}
              selectedCode={selectedContact?.contact_code}
              onChange={(id, contactData) => {
                setContactId(id);
                setSelectedContact(contactData);
              }}
            />
          </div>
        </div>

        {loading ? (
          <AppLoading />
        ) : !data || data.rows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ไม่มีลูกหนี้ค้างชำระตามเงื่อนไขที่เลือก</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "0-30 วัน", value: data.totals.b0_30, color: "text-slate-700" },
                { label: "31-60 วัน", value: data.totals.b31_60, color: "text-amber-600" },
                { label: "61-90 วัน", value: data.totals.b61_90, color: "text-orange-600" },
                { label: "มากกว่า 90 วัน", value: data.totals.b90_plus, color: "text-red-600" },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                  <div className="text-xs text-slate-400 mb-1">{c.label}</div>
                  <div className={`text-lg font-black ${c.color}`}>{money(c.value)}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-bold text-left">ลูกค้า</th>
                      <th className="px-6 py-4 font-bold text-right">0-30 วัน</th>
                      <th className="px-6 py-4 font-bold text-right">31-60 วัน</th>
                      <th className="px-6 py-4 font-bold text-right">61-90 วัน</th>
                      <th className="px-6 py-4 font-bold text-right">มากกว่า 90 วัน</th>
                      <th className="px-6 py-4 font-bold text-right">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-700">
                          {row.contact?.business_name || row.contact?.contact_person_name || "-"}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600">{money(row.buckets.b0_30)}</td>
                        <td className="px-6 py-4 text-right text-amber-600">{money(row.buckets.b31_60)}</td>
                        <td className="px-6 py-4 text-right text-orange-600">{money(row.buckets.b61_90)}</td>
                        <td className="px-6 py-4 text-right text-red-600">{money(row.buckets.b90_plus)}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">{money(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
