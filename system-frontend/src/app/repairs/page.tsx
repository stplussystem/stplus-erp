"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Plus, Search, Filter, RefreshCw, FileText } from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { usePermission } from "@/hooks/usePermission";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";

interface RepairTicketRow {
  id: number;
  ticket_number: string;
  status: string;
  repair_cost: number | null;
  received_at: string | null;
  contact: { name?: string; business_name?: string } | null;
  product: { name?: string; sku?: string } | null;
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

const STATUS_BADGE: Record<string, string> = {
  received: "bg-muted text-muted-foreground",
  diagnosing: "bg-blue-100 text-blue-600",
  awaiting_approval: "bg-amber-100 text-amber-600",
  in_repair: "bg-indigo-100 text-indigo-600",
  repaired: "bg-green-100 text-green-600",
  unrepairable: "bg-red-100 text-red-600",
  returned: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function RepairsListPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<RepairTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const canCreate = usePermission("create_repairs");

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repairs?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching repairs:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
  };

  const filteredTickets = tickets.filter((t) => {
    const search = searchTerm.toLowerCase();
    return (
      t.ticket_number.toLowerCase().includes(search) ||
      (t.contact?.business_name || t.contact?.name || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">งานซ่อม (Repairs)</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              รับแจ้งซ่อมและติดตามสถานะสินค้าที่ลูกค้าส่งกลับมา
            </p>
          </div>
        </div>
        {canCreate && (
          <Link href="/repairs/create">
            <button className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 rounded-full h-10 px-6 gap-2 shadow-lg shadow-blue-600/20 text-sm text-white flex justify-center items-center font-bold transition-all disabled:opacity-50 cursor-pointer">
              <Plus className="w-4 h-4" /> <span>รับแจ้งซ่อม</span>
            </button>
          </Link>
        )}
      </div>

      <div className="bg-card rounded-t-xl border border-border border-b-0 w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-muted/50 items-center w-full rounded-t-xl">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหา (เลขที่ตั๋ว, ชื่อลูกค้า)..."
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
              options={[
                { value: "all", label: "สถานะทั้งหมด" },
                ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
              ]}
              triggerClassName="pl-10"
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

      <div className="border border-border rounded-b-xl bg-card hide-scrollbar overflow-x-auto pb-12 min-h-[300px]">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-4 font-medium">เลขที่ตั๋ว</th>
              <th className="px-6 py-4 font-medium">ลูกค้า</th>
              <th className="px-6 py-4 font-medium">สินค้า</th>
              <th className="px-6 py-4 font-medium">วันที่รับ</th>
              <th className="px-6 py-4 font-medium text-right">ค่าซ่อม</th>
              <th className="px-6 py-4 font-medium text-center">สถานะ</th>
              <th className="px-6 py-4 font-medium text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12">
                  <AppLoading minHeight="min-h-0" />
                </td>
              </tr>
            ) : filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">ยังไม่มีรายการแจ้งซ่อม</p>
                </td>
              </tr>
            ) : (
              filteredTickets.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/repairs/${t.id}`)}
                >
                  <td className="px-6 py-4 font-bold text-foreground">{t.ticket_number}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {t.contact?.business_name || t.contact?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {t.product?.name} {t.product?.sku ? `(${t.product.sku})` : ""}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-sm">
                    {t.received_at ? dayjs(t.received_at).format("DD/MM/YYYY") : "-"}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">
                    {t.repair_cost != null
                      ? `฿${Number(t.repair_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        STATUS_BADGE[t.status] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/repairs/${t.id}`);
                      }}
                      className="px-3 py-1.5 text-xs font-bold rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all cursor-pointer"
                    >
                      ดูข้อมูล
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
