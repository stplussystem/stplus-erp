"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  FolderKanban,
  ArrowLeft,
  Edit2,
  FileText,
  ShoppingCart,
  Receipt,
  Truck,
  PackageSearch,
  Building2,
  User as UserIcon,
  Calendar,
  Flag,
  Plus,
  ChevronRight,
  X,
  MapPin,
  Coins,
  Tags,
  Wallet,
  FileMinus,
  FilePlus,
  Wrench,
  FileSpreadsheet,
  FileLock2,
  PackagePlus,
  PackageCheck,
  FileEdit,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { getToken } from "@/lib/auth-storage";
import { usePermission } from "@/hooks/usePermission";
import { AppLoading } from "@/components/ui/app-loading";
import { StockCheckModal } from "@/components/projects/StockCheckModal";
import { StageStepper } from "@/components/projects/StageStepper";
import { AppSelect } from "@/components/ui/app-select";
import { toast } from "sonner";

interface DocSummaryItem {
  id: number;
  document_type?: string;
  document_number?: string;
  po_number?: string;
  order_number?: string; // ใบสั่งซื้อ/จ้างผู้รับเหมา
  installation_number?: string;
  ticket_number?: string;
  contract_number?: string; // ใบคุมสัญญาราชการ — ไม่มี document_number/status เพราะเป็นทะเบียนติดตาม ไม่ใช่เอกสารอนุมัติ
  agency_name?: string;
  contract_amount?: number;
  floor?: string | null;
  room?: string | null;
  status?: string;
  grand_total?: number;
  issue_date?: string | null;
  created_at: string;
}

interface DocSummary {
  count: number;
  open_count?: number; // 🛡️ เฉพาะ repairs — จำนวนงานซ่อมที่ยังไม่ปิดงาน (ไม่นับ returned/cancelled)
  latest: DocSummaryItem[];
}

interface ProjectSummary {
  project: {
    id: number;
    name: string;
    description: string | null;
    status: string;
    stage?: string | null;
    start_date: string | null;
    end_date: string | null;
    contact: { name?: string; business_name?: string } | null;
    pic: { name?: string } | null;
  };
  sale_documents: Record<string, DocSummary>;
  purchase_orders: DocSummary;
  contractor_work_orders: DocSummary;
  government_contracts: DocSummary;
  installations: DocSummary;
  repairs: DocSummary;
}

interface CostSummary {
  installation_fee_total: number;
  equipment_cost_total: number;
}

const STATUS_LABEL: Record<string, string> = {
  active: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  on_hold: "พักไว้",
  cancelled: "ยกเลิก",
};

// 🏷️ สถานะของ "รายการล่าสุด" ใน Drawer — รวมทุกประเภทที่ผ่านมาแสดงในนี้ได้ (เอกสารขาย, ใบสั่งซื้อ,
// งานติดตั้ง, งานซ่อม) ซึ่งแต่ละประเภทมี string สถานะคนละชุดกัน (PascalCase สำหรับเอกสารขาย/PO,
// snake_case สำหรับงานติดตั้ง/งานซ่อม) จึงต้องรวมไว้ในแมปเดียวแบบ case-sensitive ตรงตามค่าจริงจาก backend
const DRAWER_STATUS_LABEL: Record<string, string> = {
  // เอกสารขาย (quotation, material_issue, tax_invoice, cash, ฯลฯ) และใบสั่งซื้อ/จ้างผู้รับเหมา
  Pending: "รออนุมัติ",
  Approved: "อนุมัติแล้ว",
  Revised: "เวอร์ชันเก่า",
  Cancelled: "ยกเลิก",
  // ใบสั่งซื้อ (PO) เพิ่มเติม
  Partial: "รับบางส่วน",
  Completed: "รับของแล้ว",
  // งานติดตั้ง
  scheduled: "นัดหมายแล้ว",
  installed: "ติดตั้งแล้ว",
  cancelled: "ยกเลิก",
  // งานซ่อม
  received: "รับเครื่อง",
  diagnosing: "กำลังตรวจสอบ",
  awaiting_approval: "รออนุมัติค่าซ่อม",
  in_repair: "กำลังซ่อม",
  repaired: "ซ่อมเสร็จ",
  unrepairable: "ซ่อมไม่ได้",
  returned: "คืนเครื่องแล้ว",
};

const DRAWER_STATUS_BADGE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-600",
  Approved: "bg-green-100 text-green-600",
  Revised: "bg-purple-100 text-purple-600",
  Cancelled: "bg-red-100 text-red-600",
  Partial: "bg-orange-100 text-orange-600",
  Completed: "bg-green-100 text-green-600",
  scheduled: "bg-amber-100 text-amber-600",
  installed: "bg-green-100 text-green-600",
  cancelled: "bg-red-100 text-red-600",
  received: "bg-muted text-muted-foreground",
  diagnosing: "bg-blue-100 text-blue-600",
  awaiting_approval: "bg-amber-100 text-amber-600",
  in_repair: "bg-indigo-100 text-indigo-600",
  repaired: "bg-green-100 text-green-600",
  unrepairable: "bg-red-100 text-red-600",
  returned: "bg-emerald-100 text-emerald-700",
};

// 🔗 ปลายทางเมื่อคลิกเอกสารใน drawer — ยังไม่อนุมัติ (Pending) เข้าหน้าแก้ไข /{id}/edit ส่วนสถานะอื่น (อนุมัติแล้ว/ยกเลิก/
// เวอร์ชันเก่า ฯลฯ) ซึ่งแก้ไขไม่ได้แล้ว เข้าหน้าดูแบบอ่านอย่างเดียว /{id} (เหมือน purchase-orders/1)
const docPath = (base: string) => (id: number, status?: string) =>
  status === "Pending" ? `${base}/${id}/edit` : `${base}/${id}`;

// การ์ดปุ่มการทำงานแต่ละใบในหน้า hub — เรียงตามลำดับ workflow ทั่วไปของงานโครงการ แต่กดข้ามลำดับได้เสมอ
const DOC_CARDS: {
  key: string;
  title: string;
  icon: React.ElementType;
  createPath: (projectId: string) => string;
  viewPath: (id: number, status?: string) => string;
}[] = [
  {
    key: "quotation",
    title: "ใบเสนอราคา",
    icon: FileText,
    createPath: (id) => `/sales/quotations/create?project_id=${id}`,
    viewPath: docPath("/sales/quotations"),
  },
  {
    key: "billing_invoice",
    title: "ใบวางบิล",
    icon: Receipt,
    createPath: (id) => `/sales/billing-invoices/create?project_id=${id}`,
    viewPath: docPath("/sales/billing-invoices"),
  },
  {
    key: "delivery_note",
    title: "ใบส่งสินค้า",
    icon: Truck,
    createPath: (id) => `/sales/delivery-notes/create?project_id=${id}`,
    viewPath: docPath("/sales/delivery-notes"),
  },
  {
    key: "invoice",
    title: "ใบแจ้งหนี้",
    icon: FileSpreadsheet,
    createPath: (id) => `/sales/invoices/create?project_id=${id}`,
    viewPath: docPath("/sales/invoices"),
  },
];

export default function ProjectHubPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerType, setDrawerType] = useState<{
    title: string;
    items: DocSummaryItem[];
    viewPath: (id: number, status?: string) => string;
  } | null>(null);
  const [stockCheckOpen, setStockCheckOpen] = useState(false);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const canEdit = usePermission("edit_projects");

  useEffect(() => {
    fetchSummary();
    fetchCostSummary();
  }, [projectId]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/summary`,
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
      console.error("Error fetching project summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCostSummary = async () => {
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/cost-summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setCostSummary(data.data);
      }
    } catch (error) {
      console.error("Error fetching project cost summary:", error);
    }
  };

  // 🆕 [2026-09-21] เปลี่ยนสถานะโครงการจากหน้านี้ได้เลย ไม่ต้องเข้าหน้าแก้ไข
  const handleStatusChange = async (newStatus: string) => {
    if (!summary || newStatus === summary.project.status) return;
    setChangingStatus(true);
    const toastId = toast.loading("กำลังเปลี่ยนสถานะ...");
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (res.ok) {
        setSummary((prev) =>
          prev
            ? { ...prev, project: { ...prev.project, status: newStatus } }
            : prev,
        );
        toast.success(
          `เปลี่ยนสถานะเป็น "${STATUS_LABEL[newStatus] || newStatus}" แล้ว`,
          { id: toastId },
        );
      } else {
        toast.error(
          (await res.json().catch(() => ({}))).message ||
            "เปลี่ยนสถานะไม่สำเร็จ",
          { id: toastId },
        );
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setChangingStatus(false);
    }
  };

  if (loading) {
    return (
      <AppLoading text="กำลังโหลดข้อมูลโครงการ..." minHeight="min-h-screen" />
    );
  }

  if (!summary) {
    return (
      <div className="w-full max-w-full px-4 py-12 text-center text-muted-foreground">
        ไม่พบข้อมูลโครงการ
      </div>
    );
  }

  const { project } = summary;

  // 🛡️ โครงการถูกปิด (completed) แล้ว แต่ยังมีงานซ่อมที่ยังไม่ปิดงานผูกอยู่ — เตือนไว้เพราะไม่มีจุดไหนในระบบ
  // กันการสร้าง/ปล่อยงานซ่อมค้างตอนโครงการถูกปิดเลย (ดู open_count จาก ProjectController::summary())
  const hasOpenRepairsOnCompletedProject =
    project.status === "completed" && (summary.repairs.open_count ?? 0) > 0;

  // 🪜 แถบสถานะเอกสาร — 1 จุดต่อการ์ดเอกสารด้านล่าง (ไม่รวมการ์ด "เช็คสินค้าตามใบเสนอราคา" เพราะไม่ใช่เอกสารจริง)
  // เงื่อนไข done ใช้ตัวเดียวกับที่ตัดสิน border สีของแต่ละการ์ดทุกจุด (รวม OR ของการ์ดที่มี 2 ประเภทเอกสาร)
  const docSteps = [
    {
      key: "quotation",
      label: "ใบเสนอราคา",
      done: summary.sale_documents["quotation"]?.count > 0,
    },
    {
      key: "material_issue",
      label: "ใบเบิกสินค้า",
      done: summary.sale_documents["material_issue"]?.count > 0,
    },
    {
      key: "packing_list",
      label: "ใบจัดสินค้า",
      done: summary.sale_documents["packing_list"]?.count > 0,
    },
    {
      key: "purchase_order",
      label: "ใบสั่งซื้อ (PO)",
      done: summary.purchase_orders.count > 0,
    },
    {
      key: "contractor_work_order",
      label: "ใบสั่งซื้อ/จ้างผู้รับเหมา",
      done: summary.contractor_work_orders.count > 0,
    },
    {
      key: "billing_invoice",
      label: "ใบวางบิล",
      done: summary.sale_documents["billing_invoice"]?.count > 0,
    },
    {
      key: "tax_invoice_receipt",
      label: "ใบกำกับภาษี/ใบเสร็จรับเงิน",
      done:
        summary.sale_documents["tax_invoice"]?.count > 0 ||
        summary.sale_documents["receipt"]?.count > 0,
    },
    {
      key: "delivery_note",
      label: "ใบส่งสินค้า",
      done: summary.sale_documents["delivery_note"]?.count > 0,
    },
    {
      key: "invoice",
      label: "ใบแจ้งหนี้",
      done: summary.sale_documents["invoice"]?.count > 0,
    },
    {
      key: "government_contract",
      label: "ใบคุมสัญญาราชการ",
      done: summary.government_contracts.count > 0,
    },
    {
      key: "installation",
      label: "งานติดตั้ง",
      done: summary.installations.count > 0,
    },
    {
      key: "cash",
      label: "เงินสด",
      done: summary.sale_documents["cash"]?.count > 0,
    },
    {
      key: "credit_debit_note",
      label: "ใบลดหนี้/ใบเพิ่มหนี้",
      done:
        summary.sale_documents["credit_note"]?.count > 0 ||
        summary.sale_documents["debit_note"]?.count > 0,
    },
    { key: "repair", label: "งานซ่อม", done: summary.repairs.count > 0 },
  ];

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
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-md font-bold tracking-tight">
                {project.name}
              </h1>
              {hasOpenRepairsOnCompletedProject && (
                <span className="px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[11px] font-bold flex items-center gap-1">
                  <Wrench className="w-3 h-3" />
                  โครงการเสร็จสิ้นแล้ว แต่มีงานซ่อมค้างอยู่{" "}
                  {summary.repairs.open_count} รายการ
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              โครงการและเอกสารที่เกี่ยวข้องทั้งหมด
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            // onClick={() => router.back()}
            onClick={() => router.push(`/projects`)}
            className="flex justify-center h-10 p-4 w-full md:w-auto gap-2  text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            ย้อนกลับ
          </button>
          {canEdit && (
            <button
              onClick={() => router.push(`/projects/${projectId}/edit`)}
              className="flex justify-center h-10 p-4 w-full md:w-auto  gap-2  text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <Edit2 className="w-4 h-4" /> แก้ไขโครงการ
            </button>
          )}
        </div>
      </div>

      {/* การ์ดข้อมูลโครงการ */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">ลูกค้า</div>
            <div className="text-sm font-medium text-foreground">
              {project.contact?.business_name || project.contact?.name || "-"}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <UserIcon className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">ผู้รับผิดชอบ</div>
            <div className="text-sm font-medium text-foreground">
              {project.pic?.name || "-"}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">ระยะเวลาโครงการ</div>
            <div className="text-sm font-medium text-foreground">
              {project.start_date
                ? dayjs(project.start_date).format("DD/MM/YYYY")
                : "-"}
              {project.end_date
                ? ` - ${dayjs(project.end_date).format("DD/MM/YYYY")}`
                : ""}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Flag className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">สถานะ</div>
            {canEdit ? (
              <div
                className={`w-full max-w-44 mt-0.5 ${changingStatus ? "opacity-60 pointer-events-none" : ""}`}
              >
                <AppSelect
                  value={project.status}
                  onValueChange={handleStatusChange}
                  options={Object.entries(STATUS_LABEL).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
              </div>
            ) : (
              <div className="text-sm font-medium text-foreground">
                {STATUS_LABEL[project.status] || project.status}
              </div>
            )}
          </div>
        </div>
        {project.description && (
          <div className="ml-6 md:col-span-2 lg:col-span-4 text-xs text-muted-foreground border-t border-border pt-3">
            {project.description}
          </div>
        )}
        <div className="md:col-span-2 lg:col-span-4 border-t border-border pt-3 overflow-x-auto">
          <StageStepper steps={docSteps} />
        </div>
      </div>

      {/* สรุปค่าติดตั้ง / ต้นทุนอุปกรณ์ติดตั้ง */}
      {/* {costSummary &&
        (costSummary.installation_fee_total > 0 ||
          costSummary.equipment_cost_total > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
              <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                <Tags className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">ค่าติดตั้งรวม</div>
                <div className="text-xl font-black text-foreground">
                  ฿
                  {Number(costSummary.installation_fee_total).toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )}
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  ต้นทุนอุปกรณ์ติดตั้งรวม
                </div>
                <div className="text-xl font-black text-foreground">
                  ฿
                  {Number(costSummary.equipment_cost_total).toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )}
                </div>
              </div>
            </div>
          </div>
        )} */}

      {/* กริดปุ่มการทำงาน */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ใบเสนอราคา */}
        {(() => {
          const card = DOC_CARDS[0];
          const doc = summary.sale_documents[card.key];
          return (
            <div
              key={card.key}
              className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${doc.count > 0 ? "border-blue-500 bg-blue-50" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-2">
                <card.icon className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-foreground text-sm">
                  {card.title}
                </h3>
              </div>
              <Link href={card.createPath(projectId)}>
                <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> สร้างใหม่
                </button>
              </Link>
              {renderCountBadge(doc, card.title, card.viewPath)}
            </div>
          );
        })()}

        {/* เช็คสต๊อก */}
        <div className="bg-red rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-foreground text-sm">
              เช็คสินค้าตามใบเสนอราคา
            </h3>
          </div>
          <button
            onClick={() => setStockCheckOpen(true)}
            className="w-full h-9 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <PackageSearch className="w-3.5 h-3.5" /> เช็คสต๊อก
          </button>
          <p className="text-xs text-muted-foreground flex-1 text-center pt-2">
            ตรวจสอบว่าสินค้าตามใบเสนอราคามีในสต๊อกเพียงพอหรือไม่
          </p>
        </div>

        {/* ใบเบิกสินค้า — เบิกจากใบเสนอราคาที่อนุมัติแล้ว (จองสต๊อกไว้ก่อน ตัดจริงตอนอนุมัติใบกำกับภาษี/ใบส่งสินค้า) */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.sale_documents["material_issue"]?.count > 0 ? "border-emerald-500 bg-emerald-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-foreground text-sm">ใบเบิกสินค้า</h3>
          </div>
          <Link href={`/sales/material-issues/create?project_id=${projectId}`}>
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> สร้างใหม่
            </button>
          </Link>
          {renderCountBadge(
            summary.sale_documents["material_issue"],
            "ใบเบิกสินค้า",
            docPath("/sales/material-issues"),
          )}
        </div>

        {/* ใบจัดสินค้า — เลือก S/N จากใบเบิกสินค้าที่อนุมัติแล้ว (ตัดออกจริงตอนอนุมัติใบกำกับภาษี/ใบส่งสินค้า) */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.sale_documents["packing_list"]?.count > 0 ? "border-teal-500 bg-teal-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-teal-500" />
            <h3 className="font-bold text-foreground text-sm">ใบจัดสินค้า</h3>
          </div>
          <Link href={`/sales/packing-lists/create?project_id=${projectId}`}>
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> สร้างใหม่
            </button>
          </Link>
          {renderCountBadge(
            summary.sale_documents["packing_list"],
            "ใบจัดสินค้า",
            docPath("/sales/packing-lists"),
          )}
        </div>

        {/* ใบสั่งซื้อ (PO) */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.purchase_orders.count > 0 ? "border-orange-500 bg-orange-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-foreground text-sm">
              ใบสั่งซื้อ (PO)
            </h3>
          </div>
          <Link href={`/purchase-orders/create?project_id=${projectId}`}>
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> สร้างใหม่
            </button>
          </Link>
          {renderCountBadge(
            summary.purchase_orders,
            "ใบสั่งซื้อ (PO)",
            docPath("/purchase-orders"),
          )}
        </div>

        {/* ใบสั่งซื้อ/จ้างผู้รับเหมา — แยกจาก PO ซื้อสินค้าเข้าสต๊อกโดยสิ้นเชิง */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.contractor_work_orders.count > 0 ? "border-cyan-500 bg-cyan-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-cyan-500" />
            <h3 className="font-bold text-foreground text-sm">
              ใบสั่งซื้อ/จ้างผู้รับเหมา
            </h3>
          </div>
          <Link href={`/contractor-work-orders/create?project_id=${projectId}`}>
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> สร้างใหม่
            </button>
          </Link>
          {renderCountBadge(
            summary.contractor_work_orders,
            "ใบสั่งซื้อ/จ้างผู้รับเหมา",
            docPath("/contractor-work-orders"),
          )}
        </div>

        {/* ใบวางบิล */}
        {(() => {
          const card = DOC_CARDS[1];
          const doc = summary.sale_documents[card.key];
          return (
            <div
              key={card.key}
              className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${doc.count > 0 ? "border-purple-500 bg-purple-50" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-2">
                <card.icon className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold text-foreground text-sm">
                  {card.title}
                </h3>
              </div>
              <Link href={card.createPath(projectId)}>
                <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> สร้างใหม่
                </button>
              </Link>
              {renderCountBadge(doc, card.title, card.viewPath)}
            </div>
          );
        })()}

        {/* ใบกำกับภาษี / ใบเสร็จรับเงิน */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.sale_documents["tax_invoice"]?.count > 0 || summary.sale_documents["receipt"]?.count > 0 ? "border-green-500 bg-green-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-green-500" />
            <h3 className="font-bold text-foreground text-sm">
              ใบกำกับภาษี / ใบเสร็จรับเงิน
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/sales/tax-invoices/create?project_id=${projectId}`}>
              <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer">
                <Plus className="w-3 h-3" /> ใบกำกับภาษี
              </button>
            </Link>
            <Link href={`/sales/receipts/create?project_id=${projectId}`}>
              <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer">
                <Plus className="w-3 h-3" /> ใบเสร็จรับเงิน
              </button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {renderCountBadge(
              summary.sale_documents["tax_invoice"],
              "ใบกำกับภาษี",
              docPath("/sales/tax-invoices"),
            )}
            {renderCountBadge(
              summary.sale_documents["receipt"],
              "ใบเสร็จรับเงิน",
              docPath("/sales/receipts"),
            )}
          </div>
        </div>

        {/* ใบส่งสินค้า */}
        {(() => {
          const card = DOC_CARDS[2];
          const doc = summary.sale_documents[card.key];
          return (
            <div
              key={card.key}
              className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${doc.count > 0 ? "border-teal-500 bg-teal-50" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-2">
                <card.icon className="w-5 h-5 text-teal-500" />
                <h3 className="font-bold text-foreground text-sm">
                  {card.title}
                </h3>
              </div>
              <Link href={card.createPath(projectId)}>
                <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> สร้างใหม่
                </button>
              </Link>
              {renderCountBadge(doc, card.title, card.viewPath)}
            </div>
          );
        })()}

        {/* ใบแจ้งหนี้ — เอกสารแยกใหม่ ไม่ผูกกับสายเอกสารขายเดิม */}
        {(() => {
          const card = DOC_CARDS[3];
          const doc = summary.sale_documents[card.key];
          return (
            <div
              key={card.key}
              className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${doc.count > 0 ? "border-amber-500 bg-amber-50" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-2">
                <card.icon className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-foreground text-sm">
                  {card.title}
                </h3>
              </div>
              <Link href={card.createPath(projectId)}>
                <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> สร้างใหม่
                </button>
              </Link>
              {renderCountBadge(doc, card.title, card.viewPath)}
            </div>
          );
        })()}

        {/* ใบคุมสัญญาราชการ — ผูกกับโครงการเท่านั้น ไม่มีในหน้างานเช่า */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.government_contracts.count > 0 ? "border-slate-600 bg-muted" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <FileLock2 className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-foreground text-sm">
              ใบคุมสัญญาราชการ
            </h3>
          </div>
          <Link href={`/government-contracts/create?project_id=${projectId}`}>
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> เพิ่มสัญญา
            </button>
          </Link>
          {renderCountBadge(
            summary.government_contracts,
            "ใบคุมสัญญาราชการ",
            (id) => `/government-contracts/${id}/edit`,
          )}
        </div>

        {/* งานติดตั้ง */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.installations.count > 0 ? "border-rose-500 bg-rose-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-foreground text-sm">งานติดตั้ง</h3>
          </div>
          <Link href={`/installations/create?project_id=${projectId}`}>
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> สร้างใหม่
            </button>
          </Link>
          {renderCountBadge(
            summary.installations,
            "งานติดตั้ง",
            (id) => `/installations/${id}`,
          )}
        </div>

        {/* ใบเสนอราคาแบบกำหนดเอง */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.sale_documents["custom_quotation"]?.count > 0 ? "border-fuchsia-500 bg-fuchsia-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-fuchsia-500" />
            <h3 className="font-bold text-foreground text-sm">
              ใบเสนอราคาแบบกำหนดเอง
            </h3>
          </div>
          <Link
            href={`/sales/custom-quotations/create?project_id=${projectId}`}
          >
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> สร้างใหม่
            </button>
          </Link>
          {renderCountBadge(
            summary.sale_documents["custom_quotation"],
            "ใบเสนอราคาแบบกำหนดเอง",
            docPath("/sales/custom-quotations"),
          )}
        </div>

        {/* เงินสด */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.sale_documents["cash"]?.count > 0 ? "border-amber-500 bg-amber-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-foreground text-sm">เงินสด</h3>
          </div>
          <Link href={`/sales/cash-sales/create?project_id=${projectId}`}>
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> สร้างใหม่
            </button>
          </Link>
          {renderCountBadge(
            summary.sale_documents["cash"],
            "เงินสด",
            docPath("/sales/cash-sales"),
          )}
        </div>

        {/* ใบลดหนี้ / ใบเพิ่มหนี้ */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.sale_documents["credit_note"]?.count > 0 || summary.sale_documents["debit_note"]?.count > 0 ? "border-sky-500 bg-sky-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <FileMinus className="w-5 h-5 text-sky-500" />
            <h3 className="font-bold text-foreground text-sm">
              ใบลดหนี้ / ใบเพิ่มหนี้
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/sales/credit-notes/create?project_id=${projectId}`}>
              <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer">
                <FileMinus className="w-3 h-3" /> ใบลดหนี้
              </button>
            </Link>
            <Link href={`/sales/debit-notes/create?project_id=${projectId}`}>
              <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer">
                <FilePlus className="w-3 h-3" /> ใบเพิ่มหนี้
              </button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {renderCountBadge(
              summary.sale_documents["credit_note"],
              "ใบลดหนี้",
              docPath("/sales/credit-notes"),
            )}
            {renderCountBadge(
              summary.sale_documents["debit_note"],
              "ใบเพิ่มหนี้",
              docPath("/sales/debit-notes"),
            )}
          </div>
        </div>

        {/* งานซ่อม */}
        <div
          className={`rounded-2xl shadow-sm border p-5 flex flex-col gap-3 ${summary.repairs.count > 0 ? "border-violet-500 bg-violet-50" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-violet-500" />
            <h3 className="font-bold text-foreground text-sm">งานซ่อม</h3>
          </div>
          {hasOpenRepairsOnCompletedProject && (
            <div className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold">
              โครงการปิดงานแล้ว แต่ยังมีงานซ่อมค้าง {summary.repairs.open_count}{" "}
              รายการ
            </div>
          )}
          <Link href={`/repairs/create?project_id=${projectId}`}>
            <button className="w-full h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> สร้างใหม่
            </button>
          </Link>
          {renderCountBadge(
            summary.repairs,
            "งานซ่อม",
            (id) => `/repairs/${id}`,
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
                  onClick={() =>
                    router.push(drawerType.viewPath(item.id, item.status))
                  }
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center justify-between transition-all cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-sm text-foreground">
                      {item.document_number ||
                        item.po_number ||
                        item.order_number ||
                        item.installation_number ||
                        item.ticket_number ||
                        item.contract_number}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {dayjs(item.issue_date || item.created_at).format(
                          "DD/MM/YYYY",
                        )}
                      </span>
                      {item.status ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${DRAWER_STATUS_BADGE[item.status] || "bg-muted text-muted-foreground"}`}
                        >
                          {DRAWER_STATUS_LABEL[item.status] || item.status}
                        </span>
                      ) : item.agency_name ? (
                        <span className="text-xs text-muted-foreground">
                          • {item.agency_name}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.grand_total != null ||
                    item.contract_amount != null ? (
                      <span className="text-sm font-bold text-foreground">
                        ฿
                        {Number(
                          item.grand_total ?? item.contract_amount,
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {[item.floor, item.room].filter(Boolean).join(" / ") ||
                          "-"}
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

      {stockCheckOpen && (
        <StockCheckModal
          projectId={projectId}
          quotations={(summary.sale_documents["quotation"]?.latest || [])
            .filter(
              (item): item is DocSummaryItem & { document_number: string } =>
                !!item.document_number,
            )
            .map((item) => ({
              id: item.id,
              document_number: item.document_number,
            }))}
          onClose={() => setStockCheckOpen(false)}
        />
      )}
    </div>
  );
}
