"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, Filter, RefreshCw, FileText } from "lucide-react";
import dayjs from "dayjs";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { AppSelect } from "@/components/ui/app-select";

interface InstallationRow {
  id: number;
  installation_number: string;
  status: string;
  scheduled_at: string | null;
  installed_at: string | null;
  warranty_expires_at: string | null;
  project: { name?: string } | null;
  contact: { name?: string; business_name?: string } | null;
  product: { name?: string; sku?: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "นัดหมายแล้ว",
  installed: "ติดตั้งแล้ว",
  cancelled: "ยกเลิก",
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-amber-100 text-amber-600",
  installed: "bg-green-100 text-green-600",
  cancelled: "bg-red-100 text-red-600",
};

export default function InstallationsListPage() {
  const router = useRouter();
  const [records, setRecords] = useState<InstallationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/installations?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching installations:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
  };

  const warrantyLabel = (record: InstallationRow) => {
    if (!record.warranty_expires_at) return { text: "-", cls: "text-slate-400" };
    const isActive = dayjs(record.warranty_expires_at).isAfter(dayjs());
    return isActive
      ? { text: `ถึง ${dayjs(record.warranty_expires_at).format("DD/MM/YYYY")}`, cls: "text-green-600" }
      : { text: `หมดแล้ว ${dayjs(record.warranty_expires_at).format("DD/MM/YYYY")}`, cls: "text-red-500" };
  };

  const filteredRecords = records.filter((r) => {
    const search = searchTerm.toLowerCase();
    return (
      r.installation_number.toLowerCase().includes(search) ||
      (r.contact?.business_name || r.contact?.name || "").toLowerCase().includes(search) ||
      (r.project?.name || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">งานติดตั้ง (Installations)</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              บันทึกการติดตั้งสินค้า สถานที่ ห้อง และการรับประกัน
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-t-xl border border-border border-b-0 w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-50/50 items-center w-full rounded-t-xl">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหา (เลขที่, ลูกค้า, โครงการ)..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
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
            className="w-full h-10 px-4 flex items-center justify-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
          </button>
        </div>
      </div>

      <div className="border border-border rounded-b-xl bg-card hide-scrollbar pb-12 min-h-[300px]">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-medium">เลขที่</th>
              <th className="px-6 py-4 font-medium">โครงการ / ลูกค้า</th>
              <th className="px-6 py-4 font-medium">สินค้า</th>
              <th className="px-6 py-4 font-medium">วันที่ติดตั้ง</th>
              <th className="px-6 py-4 font-medium">ประกัน</th>
              <th className="px-6 py-4 font-medium text-center">สถานะ</th>
              <th className="px-6 py-4 font-medium text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <AppLoading />
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">ยังไม่มีบันทึกการติดตั้ง</p>
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => {
                const warranty = warrantyLabel(r);
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => router.push(`/installations/${r.id}`)}
                  >
                    <td className="px-6 py-4 font-bold text-slate-800">{r.installation_number}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <div>{r.project?.name || "-"}</div>
                      <div className="text-xs text-slate-400">
                        {r.contact?.business_name || r.contact?.name || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{r.product?.name}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">
                      {r.installed_at
                        ? dayjs(r.installed_at).format("DD/MM/YYYY")
                        : r.scheduled_at
                          ? `นัด ${dayjs(r.scheduled_at).format("DD/MM/YYYY")}`
                          : "-"}
                    </td>
                    <td className={`px-6 py-4 text-sm ${warranty.cls}`}>{warranty.text}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          STATUS_BADGE[r.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/installations/${r.id}`);
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all cursor-pointer"
                      >
                        ดูข้อมูล
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
