"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/th";
import relativeTime from "dayjs/plugin/relativeTime";
import buddhistEra from "dayjs/plugin/buddhistEra";
import {
  Home,
  FileWarning,
  AlertTriangle,
  ClipboardCheck,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { AppLoading } from "@/components/ui/app-loading";

dayjs.extend(relativeTime);
dayjs.extend(buddhistEra);
dayjs.locale("th");

// ==================== Types (ตรงกับ DashboardController::homeSummary() ฝั่ง backend) ====================
interface LowStockPreviewRow {
  product_id: number;
  name: string;
  sku: string;
  available_qty: number;
  threshold: number;
}
interface ProductsSummary {
  low_stock: { total_count: number; preview: LowStockPreviewRow[] };
}
interface PendingApprovalRow {
  source: string;
  document_type: string;
  number: string;
  amount: number;
  created_at: string;
  id: number;
}
interface PendingApprovalsSummary {
  total_count: number;
  recent: PendingApprovalRow[];
}
interface ContractExpiringRow {
  id: number;
  government_contract_id: number;
  due_date: string;
  note: string | null;
  contract: { id: number; agency_name: string; contract_number: string } | null;
}
interface ContractsExpiringSummary {
  total_count: number;
  recent: ContractExpiringRow[];
}
interface HomeData {
  products: ProductsSummary;
  pending_approvals: PendingApprovalsSummary;
  contracts_expiring: ContractsExpiringSummary;
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

// เอกสารรออนุมัติ กระจายอยู่ใน 3 แหล่ง — quotation/purchase_order ลิงก์ไปหน้า view (`[id]/page.tsx`,
// มีปุ่มอนุมัติจริงด้วย) packing_list ลิงก์ไปหน้า `[id]/edit/page.tsx` (ใช้เป็นหน้า view+approve จริง)
// ส่วนที่เหลือลิงก์ไปหน้า `[id]/edit/page.tsx` เพื่อดูรายละเอียดเอกสารเต็มๆ ก่อนตัดสินใจ (ปุ่มอนุมัติจริง
// อยู่ที่หน้ารายการ เป็น dialog ต่อแถว — เคยลองทำ deep-link ?approve={id} เปิด popup อนุมัติอัตโนมัติจาก
// ตรงนี้เลยแล้ว แต่ผู้ใช้ไม่ต้องการเพราะดูเหมือนกดยืนยันทันทีโดยไม่ได้ตรวจเอกสารก่อน ขอกลับมาดูรายละเอียดก่อน)
// แผนที่นี้ตรงกับ DOC_TYPE_INFO ใน dashboard/page.tsx
const DOC_TYPE_INFO: Record<string, { label: string; path: (id: number) => string }> = {
  quotation: { label: "ใบเสนอราคา", path: (id) => `/sales/quotations/${id}` },
  billing_invoice: { label: "ใบวางบิล/ใบแจ้งหนี้", path: (id) => `/sales/billing-invoices/${id}/edit` },
  tax_invoice: { label: "ใบกำกับภาษี", path: (id) => `/sales/tax-invoices/${id}/edit` },
  cash: { label: "เงินสด", path: (id) => `/sales/cash-sales/${id}/edit` },
  receipt: { label: "ใบเสร็จรับเงิน", path: (id) => `/sales/receipts/${id}/edit` },
  credit_note: { label: "ใบลดหนี้", path: (id) => `/sales/credit-notes/${id}/edit` },
  debit_note: { label: "ใบเพิ่มหนี้", path: (id) => `/sales/debit-notes/${id}/edit` },
  delivery_note: { label: "ใบส่งสินค้าชั่วคราว", path: (id) => `/sales/delivery-notes/${id}/edit` },
  invoice: { label: "ใบแจ้งหนี้", path: (id) => `/sales/invoices/${id}/edit` },
  custom_quotation: { label: "ใบเสนอราคา (กำหนดเอง)", path: (id) => `/sales/custom-quotations/${id}/edit` },
  custom_cash: { label: "บิลเงินสด (กำหนดเอง)", path: (id) => `/sales/custom-cash-sales/${id}/edit` },
  stock_issue: { label: "ใบเบิกสินค้า", path: (id) => `/sales/stock-issues/${id}/edit` },
  stock_return: { label: "ใบคืนสินค้า", path: (id) => `/sales/stock-returns/${id}/edit` },
  rental_stock_return: { label: "ใบคืนสินค้าเช่า", path: (id) => `/sales/rental-stock-returns/${id}/edit` },
  material_issue: { label: "ใบเบิกวัสดุ", path: (id) => `/sales/material-issues/${id}/edit` },
  packing_list: { label: "ใบจัดสินค้า", path: (id) => `/sales/packing-lists/${id}/edit` },
  loan_issue: { label: "ใบยืมสินค้า", path: (id) => `/loans/issues/${id}/edit` },
  loan_return: { label: "ใบคืนสินค้ายืม", path: (id) => `/loans/returns/${id}/edit` },
  purchase_order: { label: "ใบสั่งซื้อ", path: (id) => `/purchase-orders/${id}` },
  contractor_work_order: { label: "ใบสั่งซื้อ/สั่งจ้าง (ผู้รับเหมา)", path: (id) => `/contractor-work-orders/${id}/edit` },
};

function SectionCard({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  actionHref,
  actionLabel,
  className = "",
  children,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-card rounded-2xl shadow-sm border border-border p-5 ${className}`}>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-xl shrink-0 ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{title}</h2>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        {actionHref && (
          <Link
            href={actionHref}
            className="shrink-0 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap"
          >
            {actionLabel || "ดูเพิ่ม"} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(dayjs());

  useEffect(() => {
    fetchData();
  }, []);

  // 🕐 นาฬิกาเดินสด อัปเดตทุกวินาที
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 📱 ดักปุ่ม/ท่าทางย้อนกลับเฉพาะตอนรันเป็น PWA ที่ติดตั้งแล้ว (standalone) เท่านั้น — ถ้าเปิดผ่านแท็บเบราว์เซอร์ปกติ
  // ปล่อยให้ปุ่มย้อนกลับทำงานตามปกติ (ดักปุ่ม back ของเบราว์เซอร์ทั่วไปถือเป็น dark pattern ที่ไม่ควรทำ)
  // ดักเฉพาะที่หน้านี้ (หน้ารากที่ login แล้วอยู่เสมอ ย้ายมาจาก dashboard/page.tsx เพราะ "/" เป็นหน้าแรกจริงแล้ว)
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone) return;

    let armedToExit = false;
    let armTimer: ReturnType<typeof setTimeout>;

    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      if (!armedToExit) {
        window.history.pushState(null, "", window.location.href);
        toast.info("กดย้อนกลับอีกครั้งเพื่อออกจากแอป", { duration: 2000 });
        armedToExit = true;
        armTimer = setTimeout(() => {
          armedToExit = false;
        }, 2000);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      clearTimeout(armTimer);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await apiFetch("/home/summary");
      setData(result?.data || null);
    } catch (error) {
      toast.error("โหลดข้อมูลหน้าแรกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="w-full px-4 py-4">
        <AppLoading minHeight="min-h-screen" />
      </div>
    );
  }

  const { products, pending_approvals, contracts_expiring } = data;

  return (
    <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">หน้าแรก</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">รายการที่ต้องติดตามวันนี้</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
        >
          ดูภาพรวมทั้งหมด (Dashboard)
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* ==================== วันที่/เวลาปัจจุบัน แบบปฏิทิน ==================== */}
        <SectionCard
          icon={CalendarDays}
          iconColor="bg-blue-50 text-blue-600"
          title="วันที่วันนี้"
          subtitle={now.format("HH:mm:ss")}
        >
          <div>
            <p className="text-2xl font-black text-foreground">{now.format("dddd")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {now.format("D MMMM")} พ.ศ. {now.format("BBBB")}
            </p>
            <p className="text-3xl font-black text-blue-600 mt-4 tabular-nums">{now.format("HH:mm:ss")}</p>
          </div>
        </SectionCard>

        {/* ==================== แจ้งเตือน 3 กลุ่ม ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard
            icon={FileWarning}
            iconColor="bg-orange-50 text-orange-600"
            title="สัญญาราชการใกล้หมดอายุ"
            subtitle={`ภายใน 30 วัน (${contracts_expiring.total_count} รายการ)`}
            actionHref="/government-contracts"
          >
            {contracts_expiring.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">ไม่มีสัญญาใกล้หมดอายุ</p>
            ) : (
              <div className="space-y-1">
                {contracts_expiring.recent.map((row) => (
                  <Link
                    key={row.id}
                    href={row.contract ? `/government-contracts/${row.contract.id}/edit` : "/government-contracts"}
                    className="flex items-start gap-3 text-xs px-2 py-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground font-medium truncate">
                        {row.contract?.agency_name || "ไม่ระบุหน่วยงาน"} — {row.contract?.contract_number}
                        {row.note ? ` (${row.note})` : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        ครบกำหนด {dayjs(row.due_date).format("D MMM BBBB")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={AlertTriangle}
            iconColor="bg-amber-50 text-amber-600"
            title="สินค้าต่ำกว่าจุดแจ้งเตือน"
            subtitle={`${products.low_stock.total_count} รายการ`}
            actionHref="/reports/low-stock"
          >
            {products.low_stock.preview.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">ไม่มีสินค้าใกล้หมด</p>
            ) : (
              <div className="space-y-2">
                {products.low_stock.preview.map((row) => (
                  <Link
                    key={row.product_id}
                    href="/reports/low-stock"
                    className="flex justify-between items-center text-xs hover:bg-muted/50 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors"
                  >
                    <span className="text-muted-foreground truncate">{row.name}</span>
                    <span className="font-bold text-amber-600 shrink-0 ml-2">
                      {row.available_qty}/{row.threshold}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={ClipboardCheck}
            iconColor="bg-rose-50 text-rose-600"
            title="เอกสารรอการอนุมัติ"
            subtitle={`${pending_approvals.total_count} รายการ (เฉพาะที่คุณอนุมัติได้)`}
          >
            {pending_approvals.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">ไม่มีเอกสารรออนุมัติ</p>
            ) : (
              <div className="space-y-1">
                {pending_approvals.recent.map((row) => {
                  const info = DOC_TYPE_INFO[row.document_type];
                  const content = (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground font-medium truncate">
                          {info?.label || row.document_type} — {row.number}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{dayjs(row.created_at).fromNow()}</p>
                      </div>
                      <span className="text-xs font-bold text-amber-600 shrink-0">{money(row.amount)}</span>
                    </>
                  );
                  return info ? (
                    <Link
                      key={`${row.source}-${row.id}`}
                      href={info.path(row.id)}
                      className="flex items-center gap-3 text-xs px-2 py-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={`${row.source}-${row.id}`} className="flex items-center gap-3 text-xs px-2 py-2 -mx-2">
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
