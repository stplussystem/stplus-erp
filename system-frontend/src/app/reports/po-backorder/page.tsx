"use client";

import React, { useState, useEffect } from "react";
import { PackageX, ArrowLeft, Package, RefreshCw, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { cn } from "@/lib/utils";

interface BackorderItem {
  product: { name?: string; sku?: string } | null;
  ordered_qty: number;
  received_qty: number;
  backorder_qty: number;
}

interface BackorderRow {
  po_number: string;
  contact: { business_name?: string; contact_person_name?: string } | null;
  status: string;
  items: BackorderItem[];
  total_backorder_qty: number;
}

export default function PoBackorderReportPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [contactId, setContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [rows, setRows] = useState<BackorderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, contactId]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (contactId) params.set("contact_id", contactId);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/po-backorder?${buildParams()}`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/po-backorder/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `po_backorder_${Date.now()}.xlsx`;
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

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <PackageX className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงาน PO ค้างรับ / ยังไม่ครบ</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ใบสั่งซื้อที่ยังรับสินค้าไม่ครบตามจำนวนที่สั่ง แยกตามรายการสินค้า
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/purchases"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> รายงานจัดซื้อ
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
            <label className="block text-xs font-medium text-slate-500 mb-1">วันที่เริ่มต้น</label>
            <AppDatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">วันที่สิ้นสุด</label>
            <AppDatePicker value={dateTo} onChange={setDateTo} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ผู้ขาย</label>
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
            className="w-full h-10 px-4 flex items-center justify-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
          </button>
        </div>

        {loading ? (
          <AppLoading />
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ไม่มี PO ที่ค้างรับสินค้าตามเงื่อนไขที่เลือก</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((po) => (
              <div key={po.po_number} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                  <div>
                    <span className="font-bold text-slate-800">{po.po_number}</span>
                    <span className="text-slate-500 text-sm ml-3">
                      {po.contact?.business_name || po.contact?.contact_person_name || "-"}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold border",
                      po.status === "Approved"
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-slate-50 text-slate-600 border-slate-200",
                    )}
                  >
                    {po.status}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-bold text-left">สินค้า</th>
                      <th className="px-6 py-3 font-bold text-right">สั่งซื้อ</th>
                      <th className="px-6 py-3 font-bold text-right">รับแล้ว</th>
                      <th className="px-6 py-3 font-bold text-right">ค้างรับ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {po.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-3">
                          <div className="font-medium text-slate-800">{item.product?.name || "-"}</div>
                          <div className="text-xs text-slate-500">{item.product?.sku || "-"}</div>
                        </td>
                        <td className="px-6 py-3 text-right text-slate-600">{item.ordered_qty}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{item.received_qty}</td>
                        <td className="px-6 py-3 text-right font-bold text-orange-600">{item.backorder_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
