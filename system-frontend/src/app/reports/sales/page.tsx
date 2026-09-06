"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { FileText, RefreshCw, FileSpreadsheet } from "lucide-react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { cn } from "@/lib/utils";

interface SaleDoc {
  id: number;
  document_number: string;
  document_type: string;
  issue_date: string;
  status: string;
  grand_total: number;
  contact: { business_name?: string; contact_person_name?: string } | null;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  quotation: "ใบเสนอราคา",
  billing_invoice: "ใบวางบิล",
  tax_invoice: "ใบกำกับภาษี",
  cash: "บิลเงินสด",
  receipt: "ใบเสร็จรับเงิน",
  credit_note: "ใบลดหนี้",
  debit_note: "ใบเพิ่มหนี้",
  delivery_note: "ใบส่งสินค้า",
  stock_issue: "ใบเบิกสินค้า",
  stock_return: "ใบคืนสินค้า (จากใบลดหนี้)",
  rental_stock_return: "ใบคืนสินค้าเช่า",
};

function SalesDetailReportPageContent() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [documentType, setDocumentType] = useState("all");
  const [status, setStatus] = useState("all");
  const [contactId, setContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [rows, setRows] = useState<SaleDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, documentType, status, contactId]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (documentType !== "all") params.set("document_type", documentType);
    if (status !== "all") params.set("status", status);
    if (contactId) params.set("contact_id", contactId);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/sales?${buildParams()}`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/sales/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales_report_${Date.now()}.xlsx`;
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
    setDocumentType("all");
    setStatus("all");
    setContactId("");
    setSelectedContact(null);
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานรายการขาย (ละเอียด)</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              รายการเอกสารขายทั้งหมดตามเงื่อนไขที่เลือก (สูงสุด 500 รายการ)
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
        >
          <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
        </button>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">ประเภทเอกสาร</label>
            <AppSelect
              value={documentType}
              onValueChange={setDocumentType}
              options={[
                { value: "all", label: "ทั้งหมด" },
                ...Object.entries(DOC_TYPE_LABEL).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">สถานะ</label>
            <AppSelect
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "ทั้งหมด" },
                { value: "Pending", label: "Pending" },
                { value: "Approved", label: "Approved" },
                { value: "Cancelled", label: "Cancelled" },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">ลูกค้า</label>
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
                  <th className="px-6 py-4 font-bold">เลขที่เอกสาร</th>
                  <th className="px-6 py-4 font-bold">ประเภท</th>
                  <th className="px-6 py-4 font-bold">วันที่</th>
                  <th className="px-6 py-4 font-bold">ลูกค้า</th>
                  <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                  <th className="px-6 py-4 font-bold text-right">ยอดรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-foreground">
                      ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{doc.document_number}</td>
                      <td className="px-6 py-4 text-muted-foreground">{DOC_TYPE_LABEL[doc.document_type] || doc.document_type}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {doc.issue_date ? dayjs(doc.issue_date).format("DD/MM/YYYY") : "-"}
                      </td>
                      <td className="px-6 py-4 text-foreground truncate max-w-[200px]">
                        {doc.contact?.business_name || doc.contact?.contact_person_name || "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            doc.status === "Pending"
                              ? "bg-amber-50 text-amber-600 border-amber-200"
                              : doc.status === "Approved"
                                ? "bg-green-50 text-green-600 border-green-200"
                                : doc.status === "Cancelled"
                                  ? "bg-red-50 text-red-600 border-red-200"
                                  : "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        ฿{Number(doc.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

export default function SalesDetailReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_sales_all">
      <SalesDetailReportPageContent />
    </RoleRouteGuard>
  );
}
