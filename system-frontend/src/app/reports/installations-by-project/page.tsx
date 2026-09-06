"use client";

import React, { useState, useEffect } from "react";
import { FolderKanban, ArrowLeft, Package } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";

interface ProjectGroup {
  project: { id: number; name: string } | null;
  total: number;
  by_status: Record<string, number>;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "นัดหมายแล้ว",
  installed: "ติดตั้งเสร็จ",
  cancelled: "ยกเลิก",
};

export default function InstallationsByProjectReportPage() {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/installations-by-project`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setGroups(result.data || []);
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
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานงานติดตั้งแยกตามโครงการ</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">จำนวนงานติดตั้งแยกตามโครงการและสถานะ</p>
          </div>
        </div>
        <Link
          href="/reports/installations-summary"
          className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> รายงานสรุปงานติดตั้ง
        </Link>
      </div>

      {loading ? (
        <AppLoading />
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="text-center py-14">
            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400">ยังไม่มีงานติดตั้งที่ผูกกับโครงการ</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-800">{group.project?.name || "- ไม่ผูกโครงการ -"}</span>
                <span className="text-xs text-slate-400">{group.total} งาน</span>
              </div>
              <div className="space-y-2">
                {Object.entries(group.by_status).map(([status, count]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="text-slate-600">{STATUS_LABEL[status] || status}</span>
                    <span className="font-bold text-slate-700">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
