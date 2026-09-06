"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Spotlight,
  ArrowLeft,
  Edit2,
  FileText,
  Receipt,
  PackagePlus,
  PackageMinus,
  Building2,
  User as UserIcon,
  Calendar,
  Plus,
  ChevronRight,
  X,
  MapPin,
  Wallet,
  FileMinus,
  FilePlus,
  Palette,
  FileSpreadsheet,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { getToken } from "@/lib/auth-storage";
import { usePermission } from "@/hooks/usePermission";
import { AppLoading } from "@/components/ui/app-loading";
import { StageStepper } from "@/components/projects/StageStepper";

interface DocSummaryItem {
  id: number;
  document_type?: string;
  document_number?: string;
  order_number?: string; // ใบสั่งซื้อ/จ้างผู้รับเหมา
  status: string;
  grand_total?: number;
  issue_date?: string | null;
  created_at: string;
}

interface DocSummary {
  count: number;
  latest: DocSummaryItem[];
}

interface RentalJobSummary {
  rental_job: {
    id: number;
    name: string;
    location: string | null;
    status: string;
    stage?: string | null;
    start_date: string | null;
    end_date: string | null;
    contact: { name?: string; business_name?: string } | null;
    pic: { name?: string } | null;
    job_types: string[] | null;
  };
  sale_documents: Record<string, DocSummary>;
  contractor_work_orders: DocSummary;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  confirmed: "ยืนยันแล้ว",
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

const DOC_CARDS: {
  key: string;
  title: string;
  icon: React.ElementType;
  iconColor: string;
  borderColor: string;
  bgColor: string;
  createPath: (id: string) => string;
  viewPath: (id: number) => string;
}[] = [
  {
    key: "quotation",
    title: "ใบเสนอราคา",
    icon: FileText,
    iconColor: "text-blue-500",
    borderColor: "border-blue-500",
    bgColor: "bg-blue-50",
    createPath: (id) => `/sales/quotations/create?rental_job_id=${id}`,
    viewPath: (id) => `/sales/quotations/${id}/edit`,
  },
  {
    key: "billing_invoice",
    title: "ใบวางบิล",
    icon: Receipt,
    iconColor: "text-purple-500",
    borderColor: "border-purple-500",
    bgColor: "bg-purple-50",
    createPath: (id) => `/sales/billing-invoices/create?rental_job_id=${id}`,
    viewPath: (id) => `/sales/billing-invoices/${id}/edit`,
  },
  {
    key: "cash",
    title: "บิลเงินสด",
    icon: Wallet,
    iconColor: "text-emerald-500",
    borderColor: "border-emerald-500",
    bgColor: "bg-emerald-50",
    createPath: (id) => `/sales/cash-sales/create?rental_job_id=${id}`,
    viewPath: (id) => `/sales/cash-sales/${id}/edit`,
  },
  {
    key: "stock_issue",
    title: "ใบเบิกสินค้าเช่า",
    icon: PackagePlus,
    iconColor: "text-amber-500",
    borderColor: "border-amber-500",
    bgColor: "bg-amber-50",
    createPath: (id) => `/sales/stock-issues/create?rental_job_id=${id}`,
    viewPath: (id) => `/sales/stock-issues/${id}/edit`,
  },
  {
    key: "rental_stock_return",
    title: "ใบคืนสินค้าเช่า",
    icon: PackageMinus,
    iconColor: "text-rose-500",
    borderColor: "border-rose-500",
    bgColor: "bg-rose-50",
    createPath: (id) => `/sales/rental-stock-returns/create?rental_job_id=${id}`,
    viewPath: (id) => `/sales/rental-stock-returns/${id}/edit`,
  },
  {
    key: "credit_note",
    title: "ใบลดหนี้",
    icon: FileMinus,
    iconColor: "text-orange-500",
    borderColor: "border-orange-500",
    bgColor: "bg-orange-50",
    createPath: (id) => `/sales/credit-notes/create?rental_job_id=${id}`,
    viewPath: (id) => `/sales/credit-notes/${id}/edit`,
  },
  {
    key: "debit_note",
    title: "ใบเพิ่มหนี้",
    icon: FilePlus,
    iconColor: "text-indigo-500",
    borderColor: "border-indigo-500",
    bgColor: "bg-indigo-50",
    createPath: (id) => `/sales/debit-notes/create?rental_job_id=${id}`,
    viewPath: (id) => `/sales/debit-notes/${id}/edit`,
  },
  {
    key: "custom_quotation",
    title: "ใบเสนอราคา (กำหนดเอง)",
    icon: Palette,
    iconColor: "text-fuchsia-500",
    borderColor: "border-fuchsia-500",
    bgColor: "bg-fuchsia-50",
    createPath: (id) => `/sales/custom-quotations/create?rental_job_id=${id}`,
    viewPath: (id) => `/sales/custom-quotations/${id}/edit`,
  },
  {
    key: "invoice",
    title: "ใบแจ้งหนี้",
    icon: FileSpreadsheet,
    iconColor: "text-amber-500",
    borderColor: "border-amber-500",
    bgColor: "bg-amber-50",
    createPath: (id) => `/sales/invoices/create?rental_job_id=${id}`,
    viewPath: (id) => `/sales/invoices/${id}/edit`,
  },
];

export default function RentalJobHubPage() {
  const router = useRouter();
  const params = useParams();
  const rentalJobId = params.id as string;

  const [summary, setSummary] = useState<RentalJobSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerType, setDrawerType] = useState<{
    title: string;
    items: DocSummaryItem[];
    viewPath: (id: number) => string;
  } | null>(null);

  const canEdit = usePermission("edit_rental_jobs");

  useEffect(() => {
    fetchSummary();
  }, [rentalJobId]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/rental-jobs/${rentalJobId}/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setSummary(data.data);
      }
    } catch (error) {
      console.error("Error fetching rental job summary:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <AppLoading text="กำลังโหลดข้อมูลงานเช่า..." />;
  }

  if (!summary) {
    return (
      <div className="w-full max-w-full px-4 py-12 text-center text-muted-foreground">
        ไม่พบข้อมูลงานเช่า
      </div>
    );
  }

  const { rental_job } = summary;

  // 🪜 แถบสถานะเอกสาร — 1 จุดต่อการ์ดเอกสารด้านล่าง (ตรงกับ DOC_CARDS ทุกใบ ไม่มีการ์ดพิเศษต้องกรองออก)
  const docSteps = DOC_CARDS.map((card) => ({
    key: card.key,
    label: card.title,
    done: summary.sale_documents[card.key]?.count > 0,
  }));

  const renderCountBadge = (
    doc: DocSummary,
    title: string,
    viewPath: (id: number) => string,
  ) => {
    if (doc.count === 0) {
      return (
        <button
          disabled
          className="px-3 py-1.5 text-xs font-medium rounded-full bg-muted/50 text-muted-foreground border border-border cursor-not-allowed w-full"
        >
          ยังไม่มีเอกสาร
        </button>
      );
    }
    return (
      <button
        onClick={() => setDrawerType({ title, items: doc.latest, viewPath })}
        className="px-3 py-1.5 text-xs font-medium rounded-full bg-background text-foreground border border-border hover:bg-muted/50 transition-all cursor-pointer w-full flex items-center justify-center gap-1.5"
      >
        ดูรายการ
        <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
          {doc.count}
        </span>
      </button>
    );
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Spotlight className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-md font-bold tracking-tight">
                {rental_job.name}
              </h1>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[11px] font-medium">
                {STATUS_LABEL[rental_job.status] || rental_job.status}
              </span>
            </div>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              งานเช่าและเอกสารที่เกี่ยวข้องทั้งหมด
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/rental-jobs")}
            className="flex justify-center h-10 px-5 py-4 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" /> ย้อนกลับ
          </button>
          {canEdit && (
            <button
              onClick={() => router.push(`/rental-jobs/${rentalJobId}/edit`)}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <Edit2 className="w-4 h-4" /> แก้ไขงานเช่า
            </button>
          )}
        </div>
      </div>

      {/* การ์ดข้อมูลงานเช่า */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">ลูกค้า</div>
            <div className="text-sm font-medium text-foreground">
              {rental_job.contact?.business_name ||
                rental_job.contact?.name ||
                "-"}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <UserIcon className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">ผู้รับผิดชอบ</div>
            <div className="text-sm font-medium text-foreground">
              {rental_job.pic?.name || "-"}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">สถานที่</div>
            <div className="text-sm font-medium text-foreground">
              {rental_job.location || "-"}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">ระยะเวลา</div>
            <div className="text-sm font-medium text-foreground">
              {rental_job.start_date
                ? dayjs(rental_job.start_date).format("DD/MM/YYYY")
                : "-"}
              {rental_job.end_date
                ? ` - ${dayjs(rental_job.end_date).format("DD/MM/YYYY")}`
                : ""}
            </div>
          </div>
        </div>
        {rental_job.job_types && rental_job.job_types.length > 0 && (
          <div className="md:col-span-4 border-t border-border pt-3 flex flex-wrap gap-1.5">
            {rental_job.job_types.map((type) => (
              <span
                key={type}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full"
              >
                {type}
              </span>
            ))}
          </div>
        )}
        <div className="md:col-span-4 border-t border-border pt-3 overflow-x-auto">
          <StageStepper steps={docSteps} />
        </div>
      </div>

      {/* กริดปุ่มการทำงาน */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {DOC_CARDS.map((card) => {
          const doc = summary.sale_documents[card.key];
          return (
            <div
              key={card.key}
              className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${doc.count > 0 ? `${card.borderColor} ${card.bgColor}` : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-2">
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                <h3 className="font-bold text-foreground text-sm">
                  {card.title}
                </h3>
              </div>
              <Link href={card.createPath(rentalJobId)}>
                <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> สร้างใหม่
                </button>
              </Link>
              {renderCountBadge(doc, card.title, card.viewPath)}
            </div>
          );
        })}

        {/* ใบกำกับภาษี / ใบเสร็จรับเงิน */}
        <div
          className={`bg-card rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.sale_documents["tax_invoice"]?.count > 0 || summary.sale_documents["receipt"]?.count > 0 ? "border-green-500" : "border-border"}`}
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-green-500" />
            <h3 className="font-bold text-foreground text-sm">
              ใบกำกับภาษี / ใบเสร็จรับเงิน
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/sales/tax-invoices/create?rental_job_id=${rentalJobId}`}
            >
              <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer">
                <Plus className="w-3 h-3" /> ใบกำกับภาษี
              </button>
            </Link>
            <Link href={`/sales/receipts/create?rental_job_id=${rentalJobId}`}>
              <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer">
                <Plus className="w-3 h-3" /> ใบเสร็จรับเงิน
              </button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {renderCountBadge(
              summary.sale_documents["tax_invoice"],
              "ใบกำกับภาษี",
              (id) => `/sales/tax-invoices/${id}/edit`,
            )}
            {renderCountBadge(
              summary.sale_documents["receipt"],
              "ใบเสร็จรับเงิน",
              (id) => `/sales/receipts/${id}/edit`,
            )}
          </div>
        </div>

        {/* ใบสั่งซื้อ/จ้างผู้รับเหมา — ไม่ใช่ SaleDocument จึง query แยกจาก sale_documents */}
        <div
          className={`bg-card rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.contractor_work_orders.count > 0 ? "border-cyan-500" : "border-border"}`}
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-cyan-500" />
            <h3 className="font-bold text-foreground text-sm">
              ใบสั่งซื้อ/จ้างผู้รับเหมา
            </h3>
          </div>
          <Link
            href={`/contractor-work-orders/create?rental_job_id=${rentalJobId}`}
          >
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> สร้างใหม่
            </button>
          </Link>
          {renderCountBadge(
            summary.contractor_work_orders,
            "ใบสั่งซื้อ/จ้างผู้รับเหมา",
            (id) => `/contractor-work-orders/${id}/edit`,
          )}
        </div>
      </div>

      {/* Drawer แสดงรายการเอกสารล่าสุด */}
      {drawerType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground">
                {drawerType.title} — รายการล่าสุด
              </h3>
              <button
                onClick={() => setDrawerType(null)}
                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-background rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {drawerType.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(drawerType.viewPath(item.id))}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center justify-between transition-all cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-sm text-foreground">
                      {item.document_number || item.order_number}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {dayjs(item.issue_date || item.created_at).format(
                        "DD/MM/YYYY",
                      )}{" "}
                      • {item.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.grand_total != null && (
                      <span className="text-sm font-bold text-foreground">
                        ฿
                        {Number(item.grand_total).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
