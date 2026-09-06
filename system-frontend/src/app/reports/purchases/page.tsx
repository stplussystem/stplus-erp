"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { ShoppingCart, RefreshCw, FileSpreadsheet, PieChart, Truck, PackageX, Scale, Clock } from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { cn } from "@/lib/utils";

interface PurchaseOrderRow {
  id: number;
  po_number: string;
  status: string;
  created_at: string;
  grand_total: number;
  contact: { business_name?: string; contact_person_name?: string } | null;
}

function PurchasesReportPageContent() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("all");
  const [contactId, setContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, status, contactId]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (status !== "all") params.set("status", status);
    if (contactId) params.set("contact_id", contactId);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/purchases?${buildParams()}`, {
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
    setStatus("all");
    setContactId("");
    setSelectedContact(null);
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานจัดซื้อ</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              รายการใบสั่งซื้อทั้งหมดตามเงื่อนไขที่เลือก (สูงสุด 500 รายการ)
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted hover:border-border text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
        >
          <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6 print:hidden">
        {[
          { href: "/reports/purchase-summary", icon: PieChart, label: "สรุปยอดจัดซื้อ" },
          { href: "/reports/top-suppliers", icon: Truck, label: "ซัพพลายเออร์อันดับต้น" },
          { href: "/reports/po-backorder", icon: PackageX, label: "PO ค้างรับ/ยังไม่ครบ" },
          { href: "/reports/supplier-price-comparison", icon: Scale, label: "เปรียบเทียบราคาซื้อ" },
          { href: "/reports/ap-aging", icon: Clock, label: "อายุเจ้าหนี้ (AP Aging)" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-4 h-9 rounded-full border border-border text-muted-foreground bg-background hover:bg-muted/50 text-xs font-medium transition-all"
          >
            <item.icon className="w-3.5 h-3.5" /> {item.label}
          </Link>
        ))}
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6 space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่เริ่มต้น</label>
            <AppDatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่สิ้นสุด</label>
            <AppDatePicker value={dateTo} onChange={setDateTo} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">สถานะ</label>
            <AppSelect
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "ทั้งหมด" },
                { value: "Pending", label: "Pending" },
                { value: "Approved", label: "Approved" },
                { value: "Partial", label: "Partial" },
                { value: "Completed", label: "Completed" },
                { value: "Cancelled", label: "Cancelled" },
              ]}
            />
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
        </div>
        <button
          onClick={clearFilters}
          className="h-10 px-4 flex items-center justify-center gap-2 text-foreground bg-background border border-border hover:bg-muted rounded-xl text-sm font-medium transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <AppLoading />
        ) : (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">เลขที่ PO</th>
                  <th className="px-6 py-4 font-bold">วันที่</th>
                  <th className="px-6 py-4 font-bold">ผู้ขาย</th>
                  <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                  <th className="px-6 py-4 font-bold text-right">ยอดรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-muted-foreground">
                      ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((po) => (
                    <tr key={po.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{po.po_number}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {po.created_at ? dayjs(po.created_at).format("DD/MM/YYYY") : "-"}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground truncate max-w-[200px]">
                        {po.contact?.business_name || po.contact?.contact_person_name || "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            po.status === "Pending"
                              ? "bg-amber-50 text-amber-600 border-amber-200"
                              : po.status === "Approved"
                                ? "bg-blue-50 text-blue-600 border-blue-200"
                                : po.status === "Completed"
                                  ? "bg-green-50 text-green-600 border-green-200"
                                  : po.status === "Cancelled"
                                    ? "bg-red-50 text-red-600 border-red-200"
                                    : "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        ฿{Number(po.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PurchasesReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_purchases">
      <PurchasesReportPageContent />
    </RoleRouteGuard>
  );
}
