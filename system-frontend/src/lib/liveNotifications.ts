// 🚀 แปลงข้อมูล 3 กลุ่ม "สิ่งที่ต้องรู้" จาก GET /home/summary (DashboardController::homeSummary — เอกสารรอ
// อนุมัติ/สินค้าต่ำกว่าจุดแจ้งเตือน/สัญญาราชการใกล้หมดอายุ) ให้อยู่ในรูปแบบเดียวกับการแจ้งเตือน เพื่อไปแสดงรวมที่
// กระดิ่ง (AppLayout) และหน้า /notifications ตามที่ผู้ใช้ต้องการ — นี่ไม่ใช่ notification จริงที่บันทึกลงตาราง
// `notifications` จึงไม่มี read/unread state ของตัวเอง (ถือว่า active ตราบใดที่เงื่อนไขยังไม่ถูกแก้ไข เช่น เอกสาร
// ยังไม่อนุมัติ/สต๊อกยังไม่เติม/สัญญายังไม่ต่อ) คำนวณสดใหม่ทุกครั้งที่เรียก ไม่มีทางค้างเป็นข้อมูลเก่า

import { FileWarning, AlertTriangle, ClipboardCheck, type LucideIcon } from "lucide-react";

// ตรงกับ DOC_TYPE_INFO ใน app/page.tsx และ app/dashboard/page.tsx — คัดลอกมาเพื่อไม่ต้องแตะไฟล์เดิมทั้งสอง
// (ทั้งสองไฟล์นั้นก็มี DOC_TYPE_INFO ซ้ำกันเองอยู่แล้วเป็น pattern เดิมของโปรเจกต์)
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

export interface HomeSummaryData {
  products: {
    low_stock: {
      total_count: number;
      preview: Array<{ product_id: number; name: string; sku: string; available_qty: number; threshold: number }>;
    };
  };
  pending_approvals: {
    total_count: number;
    recent: Array<{ source: string; document_type: string; number: string; amount: number; created_at: string; id: number }>;
  };
  contracts_expiring: {
    total_count: number;
    recent: Array<{
      id: number;
      due_date: string;
      note: string | null;
      contract: { id: number; agency_name: string; contract_number: string } | null;
    }>;
  };
}

export type LiveNotificationKind = "contract" | "stock" | "approval";

export interface LiveNotification {
  id: string;
  kind: LiveNotificationKind;
  message: string;
  subtext: string;
  href: string;
}

export const LIVE_KIND_META: Record<LiveNotificationKind, { icon: LucideIcon; className: string; label: string }> = {
  contract: { icon: FileWarning, className: "text-orange-600 bg-orange-50", label: "สัญญาใกล้หมดอายุ" },
  stock: { icon: AlertTriangle, className: "text-amber-600 bg-amber-50", label: "สินค้าต่ำกว่าจุดแจ้งเตือน" },
  approval: { icon: ClipboardCheck, className: "text-rose-600 bg-rose-50", label: "เอกสารรอการอนุมัติ" },
};

export function buildLiveNotifications(data: HomeSummaryData): LiveNotification[] {
  const items: LiveNotification[] = [];

  for (const row of data.contracts_expiring?.recent || []) {
    items.push({
      id: `contract-${row.id}`,
      kind: "contract",
      message: `${row.contract?.agency_name || "ไม่ระบุหน่วยงาน"} — ${row.contract?.contract_number || ""}${row.note ? ` (${row.note})` : ""}`,
      subtext: `ครบกำหนด ${new Date(row.due_date).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}`,
      href: row.contract ? `/government-contracts/${row.contract.id}/edit` : "/government-contracts",
    });
  }

  for (const row of data.products?.low_stock?.preview || []) {
    items.push({
      id: `stock-${row.product_id}`,
      kind: "stock",
      message: `${row.name} ต่ำกว่าจุดแจ้งเตือน`,
      subtext: `คงเหลือ ${row.available_qty}/${row.threshold}`,
      href: "/reports/low-stock",
    });
  }

  for (const row of data.pending_approvals?.recent || []) {
    const info = DOC_TYPE_INFO[row.document_type];
    items.push({
      id: `approval-${row.source}-${row.id}`,
      kind: "approval",
      message: `${info?.label || row.document_type} — ${row.number}`,
      subtext: `฿${Number(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} รออนุมัติ`,
      href: info ? info.path(row.id) : "/",
    });
  }

  return items;
}
