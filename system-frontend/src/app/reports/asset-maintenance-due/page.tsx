"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { BellRing, ArrowLeft, Package, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { cn } from "@/lib/utils";

interface MaintenanceDueRow {
  asset: {
    id: number;
    name: string;
    category: string | null;
    next_maintenance_date: string;
    responsible_user: { name?: string } | null;
  };
  is_overdue: boolean;
}

function AssetMaintenanceDueReportPageContent() {
  const [days, setDays] = useState("30");
  const [rows, setRows] = useState<MaintenanceDueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/asset-maintenance-due?days=${days}`, {
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

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">สินทรัพย์ใกล้ครบกำหนดบำรุงรักษา</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              สินทรัพย์ที่ยังใช้งานอยู่และใกล้ถึง/เลยกำหนดวันบำรุงรักษาที่ตั้งไว้
            </p>
          </div>
        </div>
        <Link
          href="/assets"
          className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> ทะเบียนสินทรัพย์
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-4 lg:sticky lg:top-4 print:hidden">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">ใกล้ครบกำหนดภายใน (วัน)</label>
            <AppSelect
              value={days}
              onValueChange={setDays}
              options={[
                { value: "7", label: "7 วัน" },
                { value: "30", label: "30 วัน" },
                { value: "60", label: "60 วัน" },
                { value: "90", label: "90 วัน" },
              ]}
            />
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          {loading ? (
            <AppLoading />
          ) : rows.length === 0 ? (
            <div className="text-center py-14">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-muted-foreground">ไม่มีสินทรัพย์ที่ใกล้ครบกำหนดบำรุงรักษาตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-bold text-left">สินทรัพย์</th>
                    <th className="px-6 py-4 font-bold text-left">หมวดหมู่</th>
                    <th className="px-6 py-4 font-bold text-left">ผู้รับผิดชอบ</th>
                    <th className="px-6 py-4 font-bold text-left">กำหนดบำรุง</th>
                    <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.asset.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{row.asset.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{row.asset.category || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {row.asset.responsible_user?.name ? (
                          <span className="flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-muted-foreground" /> {row.asset.responsible_user.name}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(row.asset.next_maintenance_date).toLocaleDateString("th-TH")}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            row.is_overdue
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-amber-50 text-amber-600 border-amber-200",
                          )}
                        >
                          {row.is_overdue ? "เลยกำหนดแล้ว" : "ใกล้ครบกำหนด"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssetMaintenanceDueReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_asset_maintenance_due">
      <AssetMaintenanceDueReportPageContent />
    </RoleRouteGuard>
  );
}
