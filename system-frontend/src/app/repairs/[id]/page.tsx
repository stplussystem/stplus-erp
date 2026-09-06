"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Wrench,
  ArrowLeft,
  Edit2,
  Building2,
  Package,
  ScanLine,
  Calendar,
  ShieldCheck,
  History,
  Receipt,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { usePermission } from "@/hooks/usePermission";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";

interface RepairTicketDetail {
  id: number;
  ticket_number: string;
  status: string;
  reported_issue: string | null;
  diagnosis_notes: string | null;
  repair_cost: number | null;
  is_under_warranty: boolean;
  is_external: boolean;
  manual_serial_number: string | null;
  received_at: string | null;
  returned_at: string | null;
  billing_sale_document_id: number | null;
  contact: { name?: string; business_name?: string } | null;
  project: { name?: string } | null;
  product: { name?: string; sku?: string } | null;
  product_serial: { serial_number?: string } | null;
  reference_sale_document: { document_number?: string } | null;
  billing_sale_document: { document_number?: string; document_type?: string } | null;
  activities_as_subject?: { event: string; created_at: string; causer?: { name?: string } }[];
  photos?: { id: number; photo_url: string }[];
}

const BILLING_DOC_PATH: Record<string, string> = {
  tax_invoice: "tax-invoices",
  cash: "cash-sales",
  receipt: "receipts",
};

const STATUS_LABEL: Record<string, string> = {
  received: "รับเครื่อง",
  diagnosing: "กำลังตรวจสอบ",
  awaiting_approval: "รออนุมัติค่าซ่อม",
  in_repair: "กำลังซ่อม",
  repaired: "ซ่อมเสร็จ",
  unrepairable: "ซ่อมไม่ได้",
  returned: "คืนเครื่องแล้ว",
  cancelled: "ยกเลิก",
};

const STATUS_TRANSITIONS: Record<string, { status: string; label: string; color: string }[]> = {
  received: [
    { status: "diagnosing", label: "เริ่มตรวจสอบ", color: "bg-blue-500 hover:bg-blue-600" },
    { status: "cancelled", label: "ยกเลิกงาน", color: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" },
  ],
  diagnosing: [
    { status: "awaiting_approval", label: "ส่งรออนุมัติค่าซ่อม", color: "bg-blue-500 hover:bg-blue-600" },
    { status: "unrepairable", label: "ซ่อมไม่ได้", color: "bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200" },
    { status: "cancelled", label: "ยกเลิกงาน", color: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" },
  ],
  awaiting_approval: [
    { status: "in_repair", label: "อนุมัติแล้ว เริ่มซ่อม", color: "bg-blue-500 hover:bg-blue-600" },
    { status: "unrepairable", label: "ซ่อมไม่ได้", color: "bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200" },
    { status: "cancelled", label: "ยกเลิกงาน", color: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" },
  ],
  in_repair: [
    { status: "repaired", label: "ซ่อมเสร็จแล้ว", color: "bg-green-500 hover:bg-green-600" },
    { status: "unrepairable", label: "ซ่อมไม่ได้", color: "bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200" },
  ],
  repaired: [{ status: "returned", label: "คืนเครื่องให้ลูกค้าแล้ว", color: "bg-emerald-500 hover:bg-emerald-600" }],
  unrepairable: [{ status: "returned", label: "คืนเครื่องให้ลูกค้าแล้ว", color: "bg-emerald-500 hover:bg-emerald-600" }],
  returned: [],
  cancelled: [],
};

export default function RepairDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<RepairTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [billingDocType, setBillingDocType] = useState("receipt");
  const [generatingBilling, setGeneratingBilling] = useState(false);

  const canEdit = usePermission("edit_repairs");
  const canTransition = usePermission("transition_repairs");
  const canBill = usePermission("bill_repairs");

  useEffect(() => {
    fetchTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const fetchTicket = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repairs/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setTicket(data.data);
      }
    } catch (error) {
      console.error("Error fetching repair ticket:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransition = async (status: string) => {
    setTransitioning(true);
    const toastId = toast.loading("กำลังอัปเดตสถานะ...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repairs/${ticketId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success("อัปเดตสถานะสำเร็จ", { id: toastId });
        fetchTicket();
      } else {
        const err = await res.json();
        toast.error("อัปเดตไม่สำเร็จ", { id: toastId, description: err.message });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setTransitioning(false);
    }
  };

  const handleGenerateBilling = async () => {
    setGeneratingBilling(true);
    const toastId = toast.loading("กำลังออกเอกสารเรียกเก็บเงิน...");
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/repairs/${ticketId}/generate-billing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({ document_type: billingDocType }),
        },
      );
      if (res.ok) {
        toast.success("ออกเอกสารเรียกเก็บเงินสำเร็จ", { id: toastId });
        fetchTicket();
      } else {
        const err = await res.json();
        toast.error("ออกบิลไม่สำเร็จ", { id: toastId, description: err.message });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setGeneratingBilling(false);
    }
  };

  if (loading) {
    return <AppLoading text="กำลังโหลดข้อมูลงานซ่อม..." />;
  }

  if (!ticket) {
    return (
      <div className="w-full max-w-full px-4 py-12 text-center text-slate-400">
        ไม่พบข้อมูลงานซ่อม
      </div>
    );
  }

  const nextTransitions = STATUS_TRANSITIONS[ticket.status] || [];

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/repairs")}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-md font-bold tracking-tight">{ticket.ticket_number}</h1>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[11px] font-medium">
                {STATUS_LABEL[ticket.status] || ticket.status}
              </span>
              {ticket.is_external && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-medium">
                  อุปกรณ์ลูกค้า (ไม่ได้ซื้อผ่านระบบ)
                </span>
              )}
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5">รายละเอียดงานซ่อมและสถานะ</p>
          </div>
        </div>
        {canEdit && !["returned", "cancelled"].includes(ticket.status) && (
          <button
            onClick={() => router.push(`/repairs/${ticketId}/edit`)}
            className="h-10 px-5 rounded-full font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all hover:border-slate-400"
          >
            <Edit2 className="w-4 h-4" /> แก้ไขรายละเอียด
          </button>
        )}
      </div>

      {(() => {
        const hasTransitions = canTransition && nextTransitions.length > 0;
        const hasBilling = ["repaired", "returned"].includes(ticket.status);
        const hasSidebar = hasTransitions || hasBilling;
        return (
          <div className={hasSidebar ? "grid grid-cols-1 lg:grid-cols-3 gap-6 items-start" : ""}>
            <div className={hasSidebar ? "lg:col-span-2 space-y-4" : "space-y-4"}>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-slate-400">ลูกค้า</div>
                    <div className="text-sm font-medium text-slate-700">
                      {ticket.contact?.business_name || ticket.contact?.name || "-"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-slate-400">สินค้า</div>
                    <div className="text-sm font-medium text-slate-700">
                      {ticket.product?.name} {ticket.product?.sku ? `(${ticket.product.sku})` : ""}
                    </div>
                  </div>
                </div>
                {(ticket.product_serial?.serial_number || ticket.manual_serial_number) && (
                  <div className="flex items-start gap-2">
                    <ScanLine className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-slate-400">Serial Number</div>
                      <div className="text-sm font-medium text-slate-700 font-mono">
                        {ticket.product_serial?.serial_number || ticket.manual_serial_number}
                        {!ticket.product_serial?.serial_number && ticket.manual_serial_number && (
                          <span className="ml-1.5 text-[10px] text-amber-600 font-sans">(ระบุเอง)</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {ticket.reference_sale_document?.document_number && (
                  <div className="flex items-start gap-2">
                    <History className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-slate-400">เอกสารขายอ้างอิง</div>
                      <div className="text-sm font-medium text-slate-700">
                        {ticket.reference_sale_document.document_number}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-slate-400">วันที่รับเครื่อง</div>
                    <div className="text-sm font-medium text-slate-700">
                      {ticket.received_at ? dayjs(ticket.received_at).format("DD/MM/YYYY") : "-"}
                    </div>
                  </div>
                </div>
                {ticket.is_under_warranty && (
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500 mt-0.5" />
                    <div>
                      <div className="text-xs text-slate-400">การรับประกัน</div>
                      <div className="text-sm font-medium text-green-600">อยู่ในประกัน</div>
                    </div>
                  </div>
                )}
                {ticket.reported_issue && (
                  <div className="md:col-span-2 lg:col-span-3 text-sm text-slate-600 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400 block mb-1">อาการที่ลูกค้าแจ้ง</span>
                    {ticket.reported_issue}
                  </div>
                )}
                {ticket.diagnosis_notes && (
                  <div className="md:col-span-2 lg:col-span-3 text-sm text-slate-600 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400 block mb-1">บันทึกการตรวจ/ซ่อม</span>
                    <div className="whitespace-pre-line">{ticket.diagnosis_notes}</div>
                  </div>
                )}
                {ticket.repair_cost != null && (
                  <div className="md:col-span-2 lg:col-span-3 border-t border-slate-100 pt-3 flex justify-between items-center">
                    <span className="text-xs text-slate-400">ค่าซ่อมโดยประมาณ</span>
                    <span className="text-lg font-black text-blue-600">
                      ฿{Number(ticket.repair_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              {ticket.photos && ticket.photos.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">รูปภาพประกอบ</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {ticket.photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square rounded-xl overflow-hidden border border-slate-200 hover:opacity-80 transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.photo_url} alt="รูปประกอบงานซ่อม" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {hasSidebar && (
              <div className="space-y-4 lg:sticky lg:top-4">
                {hasTransitions && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">เปลี่ยนสถานะงานซ่อม</h3>
                    <div className="flex flex-wrap gap-3">
                      {nextTransitions.map((t) => (
                        <button
                          key={t.status}
                          onClick={() => handleTransition(t.status)}
                          disabled={transitioning}
                          className={`px-5 h-10 rounded-full text-white text-sm font-bold transition-all cursor-pointer disabled:opacity-50 ${t.color}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {hasBilling && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-green-500" /> เอกสารเรียกเก็บเงิน
                    </h3>
                    {ticket.billing_sale_document ? (
                      <Link
                        href={`/sales/${
                          BILLING_DOC_PATH[ticket.billing_sale_document.document_type || "receipt"]
                        }/${ticket.billing_sale_document_id}/edit`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700 border border-green-200 text-sm font-bold hover:bg-green-100 transition-all"
                      >
                        {ticket.billing_sale_document.document_number} <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    ) : canBill ? (
                      <div className="space-y-3">
                        <AppSelect
                          value={billingDocType}
                          onValueChange={setBillingDocType}
                          options={[
                            { value: "receipt", label: "ใบเสร็จรับเงิน" },
                            { value: "tax_invoice", label: "ใบกำกับภาษี" },
                            { value: "cash", label: "บิลเงินสด" },
                          ]}
                        />
                        <button
                          onClick={handleGenerateBilling}
                          disabled={generatingBilling || !ticket.repair_cost}
                          className="w-full bg-green-600 hover:bg-green-700 rounded-full h-10 px-6 gap-2 shadow-lg shadow-green-600/20 text-white flex items-center justify-center font-bold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {generatingBilling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Receipt className="w-4 h-4" />
                          )}
                          ออกบิล
                        </button>
                        {!ticket.repair_cost && (
                          <span className="text-xs text-amber-600 block">
                            กรุณาระบุค่าซ่อมก่อนออกบิล (แก้ไขรายละเอียด)
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">ยังไม่มีเอกสารเรียกเก็บเงิน</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
