"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/th";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  LayoutDashboard,
  Coins,
  Users,
  Truck,
  FolderKanban,
  Package,
  AlertTriangle,
  Bell,
  ClipboardCheck,
  Boxes,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { AppLoading } from "@/components/ui/app-loading";

dayjs.extend(relativeTime);
dayjs.locale("th");

// ==================== Types (ตรงกับ DashboardController::index() ฝั่ง backend) ====================
interface ContactRef {
  id: number;
  business_name: string | null;
  contact_person_name: string | null;
}
interface RankedContactRow {
  contact_id: number;
  document_count: number;
  total_amount: number;
  contact: ContactRef | null;
}
interface SalesSummary {
  total_sales: number;
  total_cost_of_goods: number;
  total_installation_cost: number;
  profit: number;
  top_customers: RankedContactRow[];
}
interface RentalSummary {
  total_revenue: number;
  total_cost: number;
  profit: number;
}
interface ProjectsSummary {
  counts: { ongoing: number; success: number; cancelled: number; on_hold: number; total: number };
  total_revenue: number;
  total_expense: number;
  total_profit: number;
}
interface LowStockPreviewRow {
  product_id: number;
  name: string;
  sku: string;
  available_qty: number;
  threshold: number;
}
interface BestSellerRow {
  product: { id: number; name: string; sku: string } | null;
  qty: number;
  sale_amount: number;
}
interface ProductsSummary {
  total_inventory_value: number;
  low_stock: { total_count: number; preview: LowStockPreviewRow[] };
  best_sellers: BestSellerRow[];
  top_vendors: RankedContactRow[];
}
interface NotificationItem {
  id: string;
  data: { message?: string; type?: string };
  created_at: string;
}
interface NotificationsSummary {
  unread_count: number;
  recent: NotificationItem[];
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
interface DashboardData {
  sales: SalesSummary;
  rental: RentalSummary;
  projects: ProjectsSummary;
  products: ProductsSummary;
  notifications: NotificationsSummary;
  pending_approvals: PendingApprovalsSummary;
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const contactName = (c: ContactRef | null) => c?.business_name || c?.contact_person_name || "ไม่ระบุชื่อ";

// เอกสารรออนุมัติ กระจายอยู่ใน 3 แหล่ง (SaleDocument ครอบคลุมหลายประเภทย่อย, PurchaseOrder, ContractorWorkOrder)
// แผนที่นี้แปลง document_type → ชื่อไทยที่อ่านง่าย + path หน้าแก้ไข/อนุมัติจริงของแต่ละประเภท
const DOC_TYPE_INFO: Record<string, { label: string; path: (id: number) => string }> = {
  quotation: { label: "ใบเสนอราคา", path: (id) => `/sales/quotations/${id}/edit` },
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
  loan_issue: { label: "ใบยืมสินค้า", path: (id) => `/loans/issues/${id}/edit` },
  loan_return: { label: "ใบคืนสินค้ายืม", path: (id) => `/loans/returns/${id}/edit` },
  purchase_order: { label: "ใบสั่งซื้อ", path: (id) => `/purchase-orders/${id}/edit` },
  contractor_work_order: { label: "ใบสั่งซื้อ/สั่งจ้าง (ผู้รับเหมา)", path: (id) => `/contractor-work-orders/${id}/edit` },
};

// ==================== เศษ UI ย่อยใช้ร่วมกันทุก section ====================
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

function StatTile({ label, value, valueClass = "text-foreground" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-muted/50 rounded-xl p-3">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <div className={`text-sm font-black truncate ${valueClass}`}>{value}</div>
    </div>
  );
}

function RankedList({ rows, emptyText }: { rows: RankedContactRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">{emptyText}</p>;
  }
  const max = Math.max(1, ...rows.map((r) => Number(r.total_amount)));
  return (
    <div className="space-y-2.5">
      {rows.map((row, idx) => (
        <div key={row.contact_id} className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2 mb-1">
              <span className="text-xs font-medium text-foreground truncate">{contactName(row.contact)}</span>
              <span className="text-xs font-bold text-foreground shrink-0">{money(row.total_amount)}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.max(4, (Number(row.total_amount) / max) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  // 📱 ดักปุ่ม/ท่าทางย้อนกลับเฉพาะตอนรันเป็น PWA ที่ติดตั้งแล้ว (standalone) เท่านั้น — ถ้าเปิดผ่านแท็บเบราว์เซอร์ปกติ
  // ปล่อยให้ปุ่มย้อนกลับทำงานตามปกติ (ดักปุ่ม back ของเบราว์เซอร์ทั่วไปถือเป็น dark pattern ที่ไม่ควรทำ)
  // ดักเฉพาะที่หน้านี้ (หน้ารากที่ login แล้ว redirect มาเสมอ) — หน้าอื่นในแอปยังใช้ history navigation ปกติทุกประการ
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone) return;

    let armedToExit = false;
    let armTimer: ReturnType<typeof setTimeout>;

    // ปักหมุด history ไว้ 1 ชั้น กันย้อนกลับครั้งแรกหลุดออกจากแอปทันที
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      if (!armedToExit) {
        window.history.pushState(null, "", window.location.href); // ปักหมุดใหม่ กันหลุดออก
        toast.info("กดย้อนกลับอีกครั้งเพื่อออกจากแอป", { duration: 2000 });
        armedToExit = true;
        armTimer = setTimeout(() => {
          armedToExit = false;
        }, 2000);
      }
      // กดซ้ำภายใน 2 วิ (armedToExit === true) → ไม่ปักหมุดซ้ำ ปล่อยให้ย้อนกลับออกจากแอปจริงตามที่ผู้ใช้ตั้งใจ
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
      const result = await apiFetch("/dashboard/stats");
      setData(result?.data || null);
    } catch (error) {
      toast.error("โหลดข้อมูลภาพรวมไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="w-full px-4 py-4">
        <AppLoading />
      </div>
    );
  }

  const { sales, rental, projects, products, notifications, pending_approvals } = data;

  return (
    <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">ภาพรวมระบบ (Dashboard)</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">สรุปยอดขาย งานเช่า โครงการ สินค้า และรายการที่ต้องติดตาม</p>
          </div>
        </div>
        <Link
          href="/reports/executive-summary"
          className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
        >
          รายงานสำหรับผู้บริหาร
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* ==================== 1+2. ยอดขาย + ยอดงานเช่า ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard
            icon={Coins}
            iconColor="bg-green-50 text-green-600"
            title="ยอดขาย (เดือนนี้)"
            subtitle="ยอดขาย ต้นทุนสินค้า และต้นทุนอุปกรณ์ติดตั้ง"
            actionHref="/reports/sales-summary"
            className="lg:col-span-2"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <StatTile label="ยอดขาย" value={money(sales.total_sales)} valueClass="text-foreground" />
              <StatTile label="ต้นทุนสินค้า" value={money(sales.total_cost_of_goods)} />
              <StatTile label="ต้นทุนอุปกรณ์ติดตั้ง" value={money(sales.total_installation_cost)} />
              <StatTile
                label="กำไร (สรุป)"
                value={money(sales.profit)}
                valueClass={sales.profit >= 0 ? "text-green-600" : "text-red-600"}
              />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">ลูกค้าซื้อเยอะสุด 5 อันดับ</span>
            </div>
            <RankedList rows={sales.top_customers} emptyText="ยังไม่มีข้อมูลการขาย" />
          </SectionCard>

          <SectionCard
            icon={Truck}
            iconColor="bg-cyan-50 text-cyan-600"
            title="ยอดงานเช่า (เดือนนี้)"
            actionHref="/reports/rental-jobs"
          >
            <div className="space-y-3">
              <StatTile label="ยอดงานเช่า" value={money(rental.total_revenue)} />
              <StatTile label="ต้นทุน" value={money(rental.total_cost)} />
              <StatTile
                label="กำไร (สรุป)"
                value={money(rental.profit)}
                valueClass={rental.profit >= 0 ? "text-green-600" : "text-red-600"}
              />
            </div>
          </SectionCard>
        </div>

        {/* ==================== 3. โครงการ ==================== */}
        <SectionCard
          icon={FolderKanban}
          iconColor="bg-indigo-50 text-indigo-600"
          title="โครงการ"
          subtitle={`ทั้งหมด ${projects.counts.total} โครงการ`}
          actionHref="/projects"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="กำลังเดินงาน" value={`${projects.counts.ongoing} โครงการ`} valueClass="text-blue-600" />
              <StatTile label="สำเร็จ" value={`${projects.counts.success} โครงการ`} valueClass="text-green-600" />
              <StatTile label="ยกเลิก" value={`${projects.counts.cancelled} โครงการ`} valueClass="text-red-500" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="ยอดขายโครงการ" value={money(projects.total_revenue)} />
              <StatTile label="ค่าใช้จ่าย" value={money(projects.total_expense)} />
              <StatTile
                label="กำไร"
                value={money(projects.total_profit)}
                valueClass={projects.total_profit >= 0 ? "text-green-600" : "text-red-600"}
              />
            </div>
          </div>
        </SectionCard>

        {/* ==================== 4. สินค้า ==================== */}
        <SectionCard
          icon={Package}
          iconColor="bg-amber-50 text-amber-600"
          title="สินค้า"
          subtitle="มูลค่าคงคลัง สินค้าใกล้หมด สินค้าขายดี และผู้จำหน่าย"
          actionHref="/reports/inventory-valuation"
        >
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Boxes className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">มูลค่าสินค้ารวม (ต้นทุน)</span>
              </div>
              <div className="text-xl font-black text-foreground">{money(products.total_inventory_value)}</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-muted-foreground">
                    ต่ำกว่าจุดแจ้งเตือน ({products.low_stock.total_count})
                  </span>
                </div>
              </div>
              {products.low_stock.preview.length === 0 ? (
                <p className="text-xs text-muted-foreground">ไม่มีสินค้าใกล้หมด</p>
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
                  {products.low_stock.total_count > products.low_stock.preview.length && (
                    <Link href="/reports/low-stock" className="text-[11px] text-blue-600 hover:underline">
                      ดูทั้งหมด {products.low_stock.total_count} รายการ
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">สินค้าขายดี</span>
              </div>
              {products.best_sellers.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูลการขาย</p>
              ) : (
                <div className="space-y-2">
                  {products.best_sellers.map((row, idx) => (
                    <div key={row.product?.id ?? idx} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground truncate">{row.product?.name || "-"}</span>
                      <span className="font-bold text-foreground shrink-0 ml-2">{row.qty} ชิ้น</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">Vendor ยอดซื้อเยอะสุด</span>
              </div>
              {products.top_vendors.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูลการซื้อ</p>
              ) : (
                <div className="space-y-2">
                  {products.top_vendors.map((row) => (
                    <div key={row.contact_id} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground truncate">{contactName(row.contact)}</span>
                      <span className="font-bold text-foreground shrink-0 ml-2">{money(row.total_amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ==================== 5+6. แจ้งเตือน + เอกสารรอการอนุมัติ ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            icon={Bell}
            iconColor="bg-purple-50 text-purple-600"
            title="แจ้งเตือน"
            subtitle={notifications.unread_count > 0 ? `${notifications.unread_count} รายการยังไม่ได้อ่าน` : "อ่านหมดแล้ว"}
            actionHref="/notifications"
          >
            {notifications.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">ไม่มีแจ้งเตือนใหม่</p>
            ) : (
              <div className="space-y-1">
                {notifications.recent.map((n) => (
                  <Link
                    key={n.id}
                    href="/notifications"
                    className="flex items-start gap-3 text-xs px-2 py-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate">{n.data?.message || "การแจ้งเตือนใหม่"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{dayjs(n.created_at).fromNow()}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={ClipboardCheck}
            iconColor="bg-rose-50 text-rose-600"
            title="เอกสารรอการอนุมัติ"
            subtitle={`ทั้งหมด ${pending_approvals.total_count} รายการ`}
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
