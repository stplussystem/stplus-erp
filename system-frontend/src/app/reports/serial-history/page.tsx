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
    product: { name?: string; sku?: string };
    stock_movement: { created_at?: string; reference_number?: string } | null;
    sold_to_sale_document: {
      document_number?: string;
      contact?: { business_name?: string; contact_person_name?: string };
    } | null;
  };
  repairs: {
    id: number;
    ticket_number: string;
    status: string;
    received_at: string | null;
    returned_at: string | null;
    repair_cost: number | null;
  }[];
}

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
            </div>

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
