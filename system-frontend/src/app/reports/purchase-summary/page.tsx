"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { PieChart, RefreshCw, FileText, Coins, FileSpreadsheet, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";

interface SummaryData {
  total_documents: number;
  total_amount: number;
  by_status: Record<string, { count: number; total: number }>;
}

function PurchaseSummaryReportPageContent() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [contactId, setContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, contactId]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (contactId) params.set("contact_id", contactId);
    return params;
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/purchase-summary?${buildParams()}`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/purchases/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchases_report_${Date.now()}.xlsx`;
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
    setContactId("");
    setSelectedContact(null);
  };

  const maxCount = data ? Math.max(1, ...Object.values(data.by_status).map((v) => v.count)) : 1;

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานสรุปยอดจัดซื้อ</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              สรุปจำนวนและมูลค่าใบสั่งซื้อตามช่วงวันที่และผู้ขาย
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/purchases"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
          >
            <FileText className="w-4 h-4" /> รายการจัดซื้อละเอียด
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
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่เริ่มต้น</label>
            <AppDatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่สิ้นสุด</label>
            <AppDatePicker value={dateTo} onChange={setDateTo} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">ผู้ขาย</label>
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
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">จำนวนเอกสารทั้งหมด</div>
                  <div className="text-xl font-black text-foreground">{data.total_documents}</div>
                </div>
              </div>
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
                <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ยอดจัดซื้อรวม (Approved/Completed)</div>
                  <div className="text-xl font-black text-foreground">
                    ฿{Number(data.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">แยกตามสถานะ</h3>
              {Object.keys(data.by_status).length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-3">
                  {Object.entries(data.by_status).map(([status, stat]) => (
                    <div key={status}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{status}</span>
                        <span className="font-bold text-foreground">
                          {stat.count} เอกสาร · ฿{Number(stat.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(stat.count / maxCount) * 100}%` }}
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

export default function PurchaseSummaryReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_purchase_summary">
      <PurchaseSummaryReportPageContent />
    </RoleRouteGuard>
  );
}
