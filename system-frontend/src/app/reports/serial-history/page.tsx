"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState } from "react";
import {
  History,
  Search,
  Loader2,
  Package,
  ShoppingCart,
  Wrench,
  AlertCircle,
  Printer,
  MapPin,
  ArrowLeftRight,
  Spotlight,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";

interface SerialHistoryData {
  serial: {
    serial_number: string;
    status: string;
    sold_at: string | null;
    product: { name?: string; sku?: string; can_rent?: boolean };
    stock_movement: { created_at?: string; reference_number?: string } | null;
    sold_to_sale_document: {
      document_number?: string;
      contact?: { business_name?: string; contact_person_name?: string };
    } | null;
  };
  current_warehouse?: { id: number; name: string } | null;
  // 🆕 [2026-09-20] ประวัติการเคลื่อนไหว S/N (โอนย้ายคลัง) เรียงเก่า→ใหม่
  movements: {
    id: number;
    event_type: string;
    reference_number: string | null;
    note: string | null;
    created_at: string;
    from_warehouse: { name?: string } | null;
    to_warehouse: { name?: string } | null;
    from_product: { sku?: string; name?: string } | null;
    to_product: { sku?: string; name?: string } | null;
    user: { name?: string } | null;
  }[];
  // 🆕 [2026-09-21] ประวัติการออกงานเช่า (ใบเบิกสินค้าเช่า/ใบคืนสินค้าเช่า ที่มี S/N นี้)
  rentals: {
    id: number;
    document_type: string;
    document_number: string;
    status: string;
    issue_date: string | null;
    contact: { business_name?: string; contact_person_name?: string } | null;
    rental_job: {
      id: number;
      name?: string;
      location?: string | null;
      status?: string;
      start_date?: string | null;
      end_date?: string | null;
    } | null;
  }[];
  installations: {
    id: number;
    installation_number: string;
    status: string;
    site_name: string | null;
    site_address: string | null;
    floor: string | null;
    room: string | null;
    scheduled_at: string | null;
    installed_at: string | null;
    warranty_expires_at: string | null;
    project: { name?: string } | null;
    location_history: { id: number; floor: string | null; room: string | null; created_at: string }[];
  }[];
  repairs: {
    id: number;
    ticket_number: string;
    status: string;
    received_at: string | null;
    returned_at: string | null;
    repair_cost: number | null;
  }[];
}

const INSTALLATION_STATUS_LABEL: Record<string, string> = {
  scheduled: "นัดหมายแล้ว",
  installed: "ติดตั้งแล้ว",
  cancelled: "ยกเลิก",
};

const INSTALLATION_STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-amber-100 text-amber-600",
  installed: "bg-green-100 text-green-600",
  cancelled: "bg-red-100 text-red-600",
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

function SerialHistoryReportPageContent() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SerialHistoryData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setData(null);
    setNotFound(false);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/serial-history/${encodeURIComponent(query.trim())}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      } else if (res.status === 404) {
        setNotFound(true);
      } else {
        toast.error("ค้นหาไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานประวัติ S/N</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ดูประวัติเต็มของสินค้าแต่ละ S/N ตั้งแต่รับเข้า ขาย จนถึงประวัติการซ่อม
            </p>
          </div>
        </div>
        {data && (
          <button
            onClick={() => window.print()}
            className="hidden md:flex items-center gap-2 h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm transition-all hover:scale-102 transition-transform cursor-pointer"
          >
            <Printer className="w-4 h-4" /> พิมพ์
          </button>
        )}
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6 max-w-xl print:hidden">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="พิมพ์หรือสแกน Serial Number..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
          </div>
          <button
            onClick={search}
            disabled={loading}
            className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            ค้นหา
          </button>
        </div>
      </div>

      {notFound && (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-10 text-center text-muted-foreground max-w-xl">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          ไม่พบ S/N นี้ในระบบ
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
          <div className="space-y-4">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-foreground">
                  {data.serial.product?.name} ({data.serial.product?.sku})
                </h3>
              </div>
              <div className="text-xs text-muted-foreground font-mono mb-2">{data.serial.serial_number}</div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                สถานะปัจจุบัน: {data.serial.status}
              </span>
              {data.current_warehouse && (
                <div className="text-xs text-muted-foreground mt-2">คลังปัจจุบัน: {data.current_warehouse.name}</div>
              )}
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-orange-500" /> ประวัติการเคลื่อนไหว ({data.movements.length})
              </h3>
              {data.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการโอนย้ายคลัง</p>
              ) : (
                <div className="space-y-3">
                  {data.movements.map((m) => (
                    <div key={m.id} className="pl-3 border-l-2 border-orange-300">
                      <div className="text-sm font-medium text-foreground">
                        โอนย้ายคลัง: {m.from_warehouse?.name || "-"} → {m.to_warehouse?.name || "-"}
                      </div>
                      {m.from_product && m.to_product && m.from_product.sku !== m.to_product.sku && (
                        <div className="text-xs text-amber-600">
                          เปลี่ยน SKU: {m.from_product.sku} → {m.to_product.sku}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {dayjs(m.created_at).format("DD/MM/YYYY HH:mm")}
                        {m.reference_number && ` • ${m.reference_number}`}
                        {m.user?.name && ` • โดย ${m.user.name}`}
                      </div>
                      {m.note && <div className="text-xs text-muted-foreground">หมายเหตุ: {m.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(data.serial.product?.can_rent || data.rentals.length > 0) && (
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Spotlight className="w-4 h-4 text-purple-500" /> ประวัติการออกงานเช่า ({data.rentals.length})
                </h3>
                {data.rentals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการเช่า</p>
                ) : (
                  <div className="space-y-3">
                    {data.rentals.map((r) => (
                      <div key={r.id} className="pl-3 border-l-2 border-purple-300">
                        <div className="text-sm font-medium text-foreground">
                          {r.document_type === "stock_issue" ? "เบิกออกเช่า" : "คืนจากงานเช่า"}: {r.document_number}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.issue_date ? dayjs(r.issue_date).format("DD/MM/YYYY") : "-"}
                          {r.status === "Pending" && " • รออนุมัติ"}
                        </div>
                        {r.rental_job ? (
                          <div className="text-xs text-muted-foreground">
                            งานเช่า:{" "}
                            <Link href={`/rental-jobs/${r.rental_job.id}`} className="text-blue-600 hover:underline">
                              {r.rental_job.name}
                            </Link>
                            {r.rental_job.location && ` • สถานที่: ${r.rental_job.location}`}
                            {(r.rental_job.start_date || r.rental_job.end_date) &&
                              ` • ช่วงเช่า ${r.rental_job.start_date ? dayjs(r.rental_job.start_date).format("DD/MM/YYYY") : "-"} - ${r.rental_job.end_date ? dayjs(r.rental_job.end_date).format("DD/MM/YYYY") : "-"}`}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">ไม่ได้ผูกกับงานเช่า</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          ลูกค้า: {r.contact?.business_name || r.contact?.contact_person_name || "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-500" /> ประวัติการขาย
              </h3>
              {data.serial.sold_to_sale_document ? (
                <div className="text-sm text-muted-foreground">
                  ขายให้ <b>{data.serial.sold_to_sale_document.contact?.business_name || "-"}</b> ตามเอกสาร{" "}
                  <b>{data.serial.sold_to_sale_document.document_number}</b>{" "}
                  {data.serial.sold_at && `เมื่อ ${dayjs(data.serial.sold_at).format("DD/MM/YYYY")}`}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการขาย</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600" /> ประวัติการติดตั้ง ({data.installations.length})
            </h3>
            {data.installations.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการติดตั้ง</p>
            ) : (
              <div className="divide-y divide-border">
                {data.installations.map((inst) => (
                  <Link
                    key={inst.id}
                    href={`/installations/${inst.id}`}
                    className="block py-2.5 hover:bg-muted/50 -mx-2 px-2 rounded-lg transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-foreground">{inst.installation_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {inst.project?.name || "-"}
                          {(inst.floor || inst.room) && (
                            <>
                              {" • "}
                              {[inst.floor && `ชั้น ${inst.floor}`, inst.room].filter(Boolean).join(" / ")}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                            INSTALLATION_STATUS_BADGE[inst.status] || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {INSTALLATION_STATUS_LABEL[inst.status] || inst.status}
                        </span>
                        <div className="text-xs text-muted-foreground mt-1">
                          {inst.installed_at
                            ? dayjs(inst.installed_at).format("DD/MM/YYYY")
                            : inst.scheduled_at
                              ? `นัด ${dayjs(inst.scheduled_at).format("DD/MM/YYYY")}`
                              : "-"}
                        </div>
                      </div>
                    </div>
                    {/* 🆕 [2026-09-18] ตำแหน่งติดตั้งเดิมก่อนแก้ไข — แสดงแยกบรรทัด ไม่ลบทิ้งตอนแก้ไขชั้น/ห้องใหม่ */}
                    {inst.location_history.length > 0 && (
                      <div className="mt-1.5 pl-3 border-l-2 border-amber-300 space-y-0.5">
                        {inst.location_history.map((h) => (
                          <div key={h.id} className="text-xs text-amber-600">
                            เดิม: {[h.floor && `ชั้น ${h.floor}`, h.room].filter(Boolean).join(" / ") || "-"}
                            {" "}(แก้ไขเมื่อ {dayjs(h.created_at).format("DD/MM/YYYY HH:mm")})
                          </div>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-500" /> ประวัติการซ่อม ({data.repairs.length})
            </h3>
            {data.repairs.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการซ่อม</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-4 divide-y xl:divide-y-0 divide-border">
                {data.repairs.map((r) => (
                  <Link
                    key={r.id}
                    href={`/repairs/${r.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-muted/50 -mx-2 px-2 rounded-lg transition-all"
                  >
                    <div>
                      <div className="text-sm font-bold text-foreground">{r.ticket_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.received_at ? dayjs(r.received_at).format("DD/MM/YYYY") : "-"}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[11px] font-medium">
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                      {r.repair_cost != null && (
                        <div className="text-xs text-muted-foreground mt-1">
                          ฿{Number(r.repair_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SerialHistoryReportPage() {
  return (
    <RoleRouteGuard permission="view_reports">
      <SerialHistoryReportPageContent />
    </RoleRouteGuard>
  );
}
