"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  ArrowLeft,
  Package,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { AppSelect } from "@/components/ui/app-select";

// 🆕 [2026-09-23] คัดลอกมาจาก app/projects/page.tsx (ธรรมเนียมเดิมของโปรเจกต์ที่คัดลอก map เล็กๆ แยกไว้ในแต่ละไฟล์
// ที่ใช้ ไม่ export ใช้ร่วม) ต้องตรงกันกับสถานะจริงของโครงการเสมอ
const STATUS_LABEL: Record<string, string> = {
  active: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  on_hold: "พักไว้",
  cancelled: "ยกเลิก",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-blue-100 text-blue-600",
  completed: "bg-green-100 text-green-600",
  on_hold: "bg-amber-100 text-amber-600",
  cancelled: "bg-red-100 text-red-600",
};

interface RevenueSource {
  document_id: number;
  document_number: string;
  document_type: string;
  document_type_label: string;
  issue_date: string | null;
  amount: number;
}

interface CostDocRef {
  id: number;
  document_number: string;
}

interface CostBreakdown {
  product_cost: number;
  product_cost_docs: CostDocRef[];
  install_cost: number;
  install_cost_docs: CostDocRef[];
  service_cost: number;
  service_cost_docs: CostDocRef[];
  contractor_cost: number;
  contractor_cost_docs: CostDocRef[];
  repair_cost: number;
  repair_cost_docs: CostDocRef[];
}

interface ProfitabilityRow {
  project: {
    id: number;
    name: string;
    status: string;
    contact: { business_name?: string } | null;
  } | null;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number | null;
  revenue_sources: RevenueSource[];
  cost_breakdown: CostBreakdown;
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

// 🆕 [2026-09-18] เส้นทางไปเอกสารต้นทางของแต่ละก้อนต้นทุน/รายได้ — คัดลอก pattern เดียวกับ DOC_TYPE_INFO ใน
// liveNotifications.ts/app/page.tsx/app/dashboard/page.tsx (ของเดิมไม่ export ให้ใช้ร่วม เป็นธรรมเนียมเดิมของ
// โปรเจกต์ที่คัดลอกแทนการแชร์ไฟล์ระหว่างกัน) เอาแค่ประเภทที่หน้านี้ใช้จริง
const COST_DOC_ROUTES: Record<string, (id: number) => string> = {
  product_cost: (id) => `/sales/material-issues/${id}`,
  install_cost: (id) => `/sales/installation-issues/${id}`,
  service_cost: (id) => `/sales/installation-issues/${id}`,
  contractor_cost: (id) => `/contractor-work-orders/${id}/edit`,
  repair_cost: (id) => `/repairs/${id}`,
};

const REVENUE_DOC_ROUTES: Record<string, (id: number) => string> = {
  tax_invoice: (id) => `/sales/tax-invoices/${id}`,
  cash: (id) => `/sales/cash-sales/${id}`,
  receipt: (id) => `/sales/receipts/${id}`,
};

// 🆕 แถวก้อนต้นทุน 1 รายการ — ชื่อก้อน (เทาถ้าไม่มีเอกสารเลย) + เลขที่เอกสารต่อท้ายแบบคลิกได้ + ยอดเงินขวาสุด
function CostBreakdownRow({
  label,
  amount,
  docs,
  routeKey,
}: {
  label: string;
  amount: number;
  docs: CostDocRef[];
  routeKey: keyof typeof COST_DOC_ROUTES;
}) {
  const hasDocs = docs.length > 0;
  const buildHref = COST_DOC_ROUTES[routeKey];
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-xs gap-3">
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className={hasDocs ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        {docs.map((d) => (
          <Link key={d.id} href={buildHref(d.id)} className="text-blue-600 hover:underline font-medium">
            {d.document_number}
          </Link>
        ))}
      </div>
      <span className={`font-bold shrink-0 ${hasDocs ? "text-foreground" : "text-muted-foreground"}`}>
        {money(amount)}
      </span>
    </div>
  );
}

function ProjectProfitabilityReportPageContent() {
  const [rows, setRows] = useState<ProfitabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/project-profitability`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/project-profitability/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project_profitability_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
  };

  const filteredRows = rows.filter((row) => {
    const search = searchTerm.toLowerCase();
    const matchSearch =
      !search ||
      (row.project?.name || "").toLowerCase().includes(search) ||
      (row.project?.contact?.business_name || "").toLowerCase().includes(search);
    const matchStatus = filterStatus === "all" || row.project?.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filteredRows.reduce((s, r) => s + Number(r.revenue), 0);
  const totalCost = filteredRows.reduce((s, r) => s + Number(r.cost), 0);
  const totalProfit = filteredRows.reduce((s, r) => s + Number(r.profit), 0);

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานกำไร-ขาดทุนต่อโครงการ</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              รวมยอดขายจริงทุกประเภทเอกสารเทียบกับต้นทุนจัดซื้อทั้งหมดของแต่ละโครงการ
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/projects"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> โครงการ
          </Link>
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
        </div>
      </div>

      {loading ? (
        <AppLoading />
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
          <div className="text-center py-14">
            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-muted-foreground">ยังไม่มีโครงการที่มียอดขายหรือต้นทุนบันทึกไว้</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">รายได้รวม</div>
              <div className="text-lg font-black text-foreground">{money(totalRevenue)}</div>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">ต้นทุนรวม</div>
              <div className="text-lg font-black text-foreground">{money(totalCost)}</div>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <div className="text-xs text-muted-foreground mb-1">กำไร/ขาดทุนรวม</div>
              <div className={`text-lg font-black ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {money(totalProfit)}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-t-xl border border-border border-b-0 w-full print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-muted/50 items-center w-full rounded-t-xl">
              <div className="relative md:col-span-2">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="ค้นหา (ชื่อโครงการ, ลูกค้า)..."
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                <AppSelect
                  value={filterStatus}
                  onValueChange={setFilterStatus}
                  triggerClassName="pl-10"
                  options={[
                    { value: "all", label: "สถานะทั้งหมด" },
                    { value: "active", label: "กำลังดำเนินการ" },
                    { value: "completed", label: "เสร็จสิ้น" },
                    { value: "on_hold", label: "พักไว้" },
                    { value: "cancelled", label: "ยกเลิก" },
                  ]}
                />
              </div>
              <button
                onClick={clearFilters}
                className="w-full h-10 px-4 flex items-center justify-center gap-2 text-foreground bg-background border border-border hover:bg-muted rounded-xl text-sm font-medium transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
              </button>
            </div>
          </div>

          <div className="bg-card rounded-b-xl shadow-sm border border-border overflow-hidden -mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-bold text-left">โครงการ</th>
                    <th className="px-6 py-4 font-bold text-left">ลูกค้า</th>
                    <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                    <th className="px-6 py-4 font-bold text-right">รายได้</th>
                    <th className="px-6 py-4 font-bold text-right">ต้นทุน</th>
                    <th className="px-6 py-4 font-bold text-right">กำไร/ขาดทุน</th>
                    <th className="px-6 py-4 font-bold text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                        ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา
                      </td>
                    </tr>
                  ) : (
                  filteredRows.map((row, idx) => {
                    const rowId = row.project?.id ?? idx;
                    const isExpanded = expandedId === rowId;
                    return (
                      <React.Fragment key={idx}>
                        <tr
                          className="hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : rowId)}
                        >
                          <td className="px-6 py-4 font-bold text-foreground">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              {row.project?.name || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {row.project?.contact?.business_name || "-"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {row.project?.status ? (
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  STATUS_BADGE[row.project.status] || "bg-muted text-muted-foreground"
                                }`}
                              >
                                {STATUS_LABEL[row.project.status] || row.project.status}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-foreground">{money(row.revenue)}</td>
                          <td className="px-6 py-4 text-right text-muted-foreground">{money(row.cost)}</td>
                          <td
                            className={`px-6 py-4 text-right font-bold ${
                              row.profit >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {money(row.profit)}
                          </td>
                          <td className="px-6 py-4 text-right text-muted-foreground">
                            {row.margin_pct !== null ? `${row.margin_pct}%` : "-"}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/30">
                            <td colSpan={7} className="px-6 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                                    รายได้มาจาก
                                  </div>
                                  {row.revenue_sources.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">ไม่มีข้อมูล</p>
                                  ) : (
                                    <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
                                      {row.revenue_sources.map((src) => (
                                        <div
                                          key={src.document_id}
                                          className="flex items-center justify-between px-4 py-2.5 text-xs"
                                        >
                                          <div>
                                            <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold mr-2">
                                              {src.document_type_label}
                                            </span>
                                            {REVENUE_DOC_ROUTES[src.document_type] ? (
                                              <Link
                                                href={REVENUE_DOC_ROUTES[src.document_type](src.document_id)}
                                                className="text-blue-600 hover:underline font-medium"
                                              >
                                                {src.document_number}
                                              </Link>
                                            ) : (
                                              <span className="text-foreground font-medium">
                                                {src.document_number}
                                              </span>
                                            )}
                                            {src.issue_date && (
                                              <span className="text-muted-foreground ml-2">
                                                {dayjs(src.issue_date).format("DD/MM/YYYY")}
                                              </span>
                                            )}
                                          </div>
                                          <div className="font-bold text-foreground">{money(src.amount)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                                    ต้นทุนประกอบด้วย
                                  </div>
                                  <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
                                    <CostBreakdownRow
                                      label="ค่าสินค้า"
                                      amount={row.cost_breakdown.product_cost}
                                      docs={row.cost_breakdown.product_cost_docs}
                                      routeKey="product_cost"
                                    />
                                    <CostBreakdownRow
                                      label="ค่าสินค้าติดตั้ง"
                                      amount={row.cost_breakdown.install_cost}
                                      docs={row.cost_breakdown.install_cost_docs}
                                      routeKey="install_cost"
                                    />
                                    <CostBreakdownRow
                                      label="ค่าบริการ (ค่าแรงติดตั้ง)"
                                      amount={row.cost_breakdown.service_cost}
                                      docs={row.cost_breakdown.service_cost_docs}
                                      routeKey="service_cost"
                                    />
                                    <CostBreakdownRow
                                      label="ค่าสั่งจ้าง"
                                      amount={row.cost_breakdown.contractor_cost}
                                      docs={row.cost_breakdown.contractor_cost_docs}
                                      routeKey="contractor_cost"
                                    />
                                    <CostBreakdownRow
                                      label="ค่าซ่อม"
                                      amount={row.cost_breakdown.repair_cost}
                                      docs={row.cost_breakdown.repair_cost_docs}
                                      routeKey="repair_cost"
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectProfitabilityReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_project_profitability">
      <ProjectProfitabilityReportPageContent />
    </RoleRouteGuard>
  );
}
