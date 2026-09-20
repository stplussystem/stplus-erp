"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import {
  Boxes,
  Coins,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  BellRing,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AssetRow {
  id: number;
  name: string;
  category: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  price: string | number | null;
  status: string;
  next_maintenance_date: string | null;
  note: string | null;
  responsible_user_id: number | null;
  responsible_user: { id?: number; name?: string } | null;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "ใช้งานปกติ", className: "bg-green-50 text-green-600 border-green-200" },
  maintenance: { label: "กำลังซ่อมบำรุง", className: "bg-amber-50 text-amber-600 border-amber-200" },
  retired: { label: "เลิกใช้งาน", className: "bg-muted/50 text-muted-foreground border-border" },
};

const money = (v: number) => `฿${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function AssetListReportPageContent() {
  // 🔍 searchInput = ข้อความที่พิมพ์ในช่อง (ยังไม่ค้นหา), search = คำค้นที่กด Enter แล้วจริง (ใช้ยิง API)
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [responsibleId, setResponsibleId] = useState("all");
  const [responsibleOptions, setResponsibleOptions] = useState<{ id: number; name: string }[]>([]);
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [totals, setTotals] = useState({ total_count: 0, total_value: 0 });
  const [loading, setLoading] = useState(true);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (responsibleId !== "all") params.set("responsible_user_id", responsibleId);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/asset-list?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        const data: AssetRow[] = result.data?.rows || [];
        setRows(data);
        setTotals({
          total_count: result.data?.total_count || 0,
          total_value: result.data?.total_value || 0,
        });
        // ตัวเลือก "ผู้รับผิดชอบ" — สะสมจากผู้รับผิดชอบที่เคยเจอในผลลัพธ์ (ไม่ต้องมีสิทธิ์ดูรายชื่อผู้ใช้)
        setResponsibleOptions((prev) => {
          const map = new Map(prev.map((u) => [u.id, u]));
          data.forEach((a) => {
            if (a.responsible_user_id && a.responsible_user?.name) {
              map.set(a.responsible_user_id, { id: a.responsible_user_id, name: a.responsible_user.name });
            }
          });
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "th"));
        });
      }
    } catch (error) {
      toast.error("โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, responsibleId]);

  const handleExport = async () => {
    const toastId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/asset-list/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asset_list_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setResponsibleId("all");
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายการสินทรัพย์</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              รายการสินทรัพย์ถาวรทั้งหมด พร้อมมูลค่าแต่ละชิ้นและมูลค่ารวม
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/asset-maintenance-due"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
          >
            <BellRing className="w-4 h-4" /> ใกล้ครบกำหนดบำรุง
          </Link>
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
          <button
            onClick={() => window.print()}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Printer className="w-4 h-4" /> พิมพ์
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-72">
              <label className="block text-xs font-medium text-muted-foreground mb-1">ค้นหาสินทรัพย์</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ชื่อสินทรัพย์, S/N..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
                  className="pl-9 h-10 bg-background border-border rounded-xl text-sm"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">สถานะ</label>
              <AppSelect
                value={status}
                onValueChange={setStatus}
                options={[
                  { value: "all", label: "สถานะทั้งหมด" },
                  ...Object.entries(STATUS_LABEL).map(([value, s]) => ({ value, label: s.label })),
                ]}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">ผู้รับผิดชอบ</label>
              <AppSelect
                value={responsibleId}
                onValueChange={setResponsibleId}
                options={[
                  { value: "all", label: "ผู้รับผิดชอบทั้งหมด" },
                  ...responsibleOptions.map((u) => ({ value: String(u.id), label: u.name })),
                ]}
              />
            </div>
            <button
              onClick={clearFilters}
              className="h-10 px-4 flex items-center justify-center gap-2 text-foreground bg-background border border-border hover:bg-muted rounded-xl text-sm font-medium transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
            </button>
          </div>

          {!loading && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-lg">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground leading-none">จำนวนสินทรัพย์</div>
                  <div className="text-base font-black text-foreground leading-tight">
                    {totals.total_count.toLocaleString()} รายการ
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-lg">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground leading-none">มูลค่าสินทรัพย์รวม</div>
                  <div className="text-base font-black text-foreground leading-tight">
                    {money(totals.total_value)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <AppLoading />
        ) : (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">ชื่อสินทรัพย์</th>
                  <th className="px-6 py-4 font-bold">หมวดหมู่</th>
                  <th className="px-6 py-4 font-bold">S/N / ทะเบียน</th>
                  <th className="px-6 py-4 font-bold">วันที่ซื้อ</th>
                  <th className="px-6 py-4 font-bold text-right">มูลค่า/ราคา</th>
                  <th className="px-6 py-4 font-bold">ผู้รับผิดชอบ</th>
                  <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                  <th className="px-6 py-4 font-bold">กำหนดบำรุงถัดไป</th>
                  <th className="px-6 py-4 font-bold">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-muted-foreground">
                      ไม่พบสินทรัพย์ตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{row.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{row.category || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{row.serial_number || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {row.purchase_date ? dayjs(row.purchase_date).format("DD/MM/YYYY") : "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        {row.price != null ? money(Number(row.price)) : "-"}
                      </td>
                      <td className="px-6 py-4">
                        {row.responsible_user?.name ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <UserIcon className="w-3.5 h-3.5" /> {row.responsible_user.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">- ไม่ระบุ -</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            STATUS_LABEL[row.status]?.className || "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {STATUS_LABEL[row.status]?.label || row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {row.next_maintenance_date ? dayjs(row.next_maintenance_date).format("DD/MM/YYYY") : "-"}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{row.note || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="border-t border-border bg-muted/30">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 font-bold text-right text-foreground">
                      มูลค่ารวมทั้งหมด
                    </td>
                    <td className="px-6 py-4 font-black text-right text-foreground">{money(totals.total_value)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssetListReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_asset_list">
      <AssetListReportPageContent />
    </RoleRouteGuard>
  );
}
