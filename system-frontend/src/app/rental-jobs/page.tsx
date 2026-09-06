"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Spotlight,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  FileText,
  MapPin,
  Coins,
  PackageX,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";

interface RentalJobItem {
  id: number;
  name: string;
  location: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  contact: { name?: string; business_name?: string } | null;
  pic: { name?: string } | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  confirmed: "ยืนยันแล้ว",
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  confirmed: "bg-blue-100 text-blue-600",
  in_progress: "bg-amber-100 text-amber-600",
  completed: "bg-green-100 text-green-600",
  cancelled: "bg-red-100 text-red-600",
};

export default function RentalJobsListPage() {
  const router = useRouter();
  const [rentalJobs, setRentalJobs] = useState<RentalJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [deleteTarget, setDeleteTarget] = useState<RentalJobItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const canCreate = usePermission("create_rental_jobs");
  const canDelete = usePermission("delete_rental_jobs");

  useEffect(() => {
    fetchRentalJobs();
  }, []);

  const fetchRentalJobs = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/rental-jobs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setRentalJobs(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching rental jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const toastId = toast.loading("กำลังลบงานเช่า...");
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/rental-jobs/${deleteTarget.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        toast.success(`ลบงานเช่า "${deleteTarget.name}" สำเร็จ`, {
          id: toastId,
        });
        setRentalJobs((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      } else {
        const err = await res.json();
        toast.error("ไม่สามารถลบงานเช่าได้", {
          id: toastId,
          description: err.message,
        });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const filteredRentalJobs = rentalJobs.filter((p) => {
    const search = searchTerm.toLowerCase();
    const matchSearch =
      p.name.toLowerCase().includes(search) ||
      (p.contact?.business_name || p.contact?.name || "")
        .toLowerCase()
        .includes(search) ||
      (p.location || "").toLowerCase().includes(search);
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Spotlight className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              งานเช่า (Rental Jobs)
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              จัดการงานเช่าอุปกรณ์และเอกสารที่เกี่ยวข้องทั้งหมดในที่เดียว
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Link
            href="/reports/rental-jobs"
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Coins className="w-4 h-4" /> รายงานรายได้งานเช่า
          </Link>
          <Link
            href="/reports/overdue-rentals"
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <PackageX className="w-4 h-4" /> อุปกรณ์เช่าค้างคืน
          </Link>
          {canCreate && (
            <Link href="/rental-jobs/create">
              <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
                <Plus className="w-4 h-4" /> <span>เพิ่มงานเช่า</span>
              </button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-card rounded-t-xl border border-border border-b-0 w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-50/50 items-center w-full rounded-t-xl">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหา (ชื่องาน, ลูกค้า, สถานที่)..."
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
              triggerClassName="pl-10"
              options={[
                { value: "all", label: "สถานะทั้งหมด" },
                { value: "draft", label: "ร่าง" },
                { value: "confirmed", label: "ยืนยันแล้ว" },
                { value: "in_progress", label: "กำลังดำเนินการ" },
                { value: "completed", label: "เสร็จสิ้น" },
                { value: "cancelled", label: "ยกเลิก" },
              ]}
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
              <th className="px-6 py-4 font-medium">ชื่องาน</th>
              <th className="px-6 py-4 font-medium">ลูกค้า</th>
              <th className="px-6 py-4 font-medium">สถานที่</th>
              <th className="px-6 py-4 font-medium">ระยะเวลา</th>
              <th className="px-6 py-4 font-medium text-center">สถานะ</th>
              <th className="px-6 py-4 font-medium text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12">
                  <AppLoading minHeight="min-h-0" />
                </td>
              </tr>
            ) : filteredRentalJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">
                    ยังไม่มีงานเช่าในระบบ
                  </p>
                </td>
              </tr>
            ) : (
              filteredRentalJobs.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/rental-jobs/${p.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{p.name}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {p.contact?.business_name || p.contact?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {p.location ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />{" "}
                        {p.location}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {p.start_date
                      ? dayjs(p.start_date).format("DD/MM/YYYY")
                      : "-"}
                    {p.end_date
                      ? ` - ${dayjs(p.end_date).format("DD/MM/YYYY")}`
                      : ""}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        STATUS_BADGE[p.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/rental-jobs/${p.id}`);
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all cursor-pointer"
                      >
                        ดูข้อมูล
                      </button>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(p);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                          title="ลบงานเช่า"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center transform animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-[6px] border-red-100/50">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              ยืนยันการลบงานเช่า?
            </h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              คุณต้องการลบงานเช่า <br />
              <span className="font-bold text-slate-800 text-base">
                {deleteTarget?.name}
              </span>{" "}
              ใช่หรือไม่?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex-1 py-3 rounded-full border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-full bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all cursor-pointer"
              >
                ลบงานเช่า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
