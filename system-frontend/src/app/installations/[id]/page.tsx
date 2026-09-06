"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  MapPin,
  ArrowLeft,
  Edit2,
  Building2,
  Package,
  ScanLine,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Home,
  FolderKanban,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { usePermission } from "@/hooks/usePermission";
import { AppLoading } from "@/components/ui/app-loading";

interface InstallationDetail {
  id: number;
  installation_number: string;
  status: string;
  site_name: string | null;
  site_address: string | null;
  room_location: string | null;
  install_notes: string | null;
  warranty_months: number | null;
  warranty_expires_at: string | null;
  scheduled_at: string | null;
  installed_at: string | null;
  project: { id: number; name?: string } | null;
  contact: { name?: string; business_name?: string } | null;
  product: { name?: string; sku?: string } | null;
  product_serial: { serial_number?: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "นัดหมายแล้ว",
  installed: "ติดตั้งแล้ว",
  cancelled: "ยกเลิก",
};

const STATUS_TRANSITIONS: Record<string, { status: string; label: string; color: string }[]> = {
  scheduled: [
    { status: "installed", label: "ติดตั้งเสร็จแล้ว", color: "bg-green-500 hover:bg-green-600" },
    { status: "cancelled", label: "ยกเลิกงาน", color: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" },
  ],
  installed: [],
  cancelled: [],
};

export default function InstallationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const recordId = params.id as string;

  const [record, setRecord] = useState<InstallationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const canEdit = usePermission("edit_installations");
  const canTransition = usePermission("transition_installations");

  useEffect(() => {
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const fetchRecord = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/installations/${recordId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setRecord(data.data);
      }
    } catch (error) {
      console.error("Error fetching installation record:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransition = async (status: string) => {
    setTransitioning(true);
    const toastId = toast.loading("กำลังอัปเดตสถานะ...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/installations/${recordId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success("อัปเดตสถานะสำเร็จ", { id: toastId });
        fetchRecord();
      } else {
        const err = await res.json();
        toast.error("อัปเดตไม่สำเร็จ", { id: toastId, description: err.message });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) {
    return <AppLoading />;
  }

  if (!record) {
    return (
      <div className="w-full max-w-full px-4 py-12 text-center text-slate-400">
        ไม่พบข้อมูลงานติดตั้ง
      </div>
    );
  }

  const nextTransitions = STATUS_TRANSITIONS[record.status] || [];

  const warranty = (() => {
    if (!record.warranty_expires_at) {
      return { label: "ไม่มีประกัน", cls: "text-slate-400", Icon: ShieldOff };
    }
    const isActive = dayjs(record.warranty_expires_at).isAfter(dayjs());
    return isActive
      ? {
          label: `อยู่ในประกันถึง ${dayjs(record.warranty_expires_at).format("DD/MM/YYYY")}`,
          cls: "text-green-600",
          Icon: ShieldCheck,
        }
      : {
          label: `หมดประกันแล้วเมื่อ ${dayjs(record.warranty_expires_at).format("DD/MM/YYYY")}`,
          cls: "text-red-500",
          Icon: ShieldAlert,
        };
  })();

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/installations")}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-md font-bold tracking-tight">{record.installation_number}</h1>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[11px] font-medium">
                {STATUS_LABEL[record.status] || record.status}
              </span>
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5">รายละเอียดงานติดตั้งและการรับประกัน</p>
          </div>
        </div>
        {canEdit && record.status === "scheduled" && (
          <button
            onClick={() => router.push(`/installations/${recordId}/edit`)}
            className="h-10 px-5 rounded-full font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all hover:border-slate-400"
          >
            <Edit2 className="w-4 h-4" /> แก้ไขรายละเอียด
          </button>
        )}
      </div>

      {(() => {
        const hasSidebar = canTransition && nextTransitions.length > 0;
        return (
          <div className={hasSidebar ? "grid grid-cols-1 lg:grid-cols-3 gap-6 items-start" : ""}>
            <div className={hasSidebar ? "lg:col-span-2 space-y-4" : "space-y-4"}>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {record.project?.name && (
                  <div className="flex items-start gap-2">
                    <FolderKanban className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-slate-400">โครงการ</div>
                      <Link
                        href={`/projects/${record.project.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {record.project.name}
                      </Link>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-slate-400">ลูกค้า</div>
                    <div className="text-sm font-medium text-slate-700">
                      {record.contact?.business_name || record.contact?.name || "-"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-slate-400">สินค้า</div>
                    <div className="text-sm font-medium text-slate-700">
                      {record.product?.name} {record.product?.sku ? `(${record.product.sku})` : ""}
                    </div>
                  </div>
                </div>
                {record.product_serial?.serial_number && (
                  <div className="flex items-start gap-2">
                    <ScanLine className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-slate-400">Serial Number</div>
                      <div className="text-sm font-medium text-slate-700 font-mono">
                        {record.product_serial.serial_number}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-slate-400">วันที่ติดตั้ง</div>
                    <div className="text-sm font-medium text-slate-700">
                      {record.installed_at
                        ? dayjs(record.installed_at).format("DD/MM/YYYY")
                        : record.scheduled_at
                          ? `นัด ${dayjs(record.scheduled_at).format("DD/MM/YYYY")}`
                          : "-"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <warranty.Icon className={`w-4 h-4 mt-0.5 ${warranty.cls}`} />
                  <div>
                    <div className="text-xs text-slate-400">การรับประกัน</div>
                    <div className={`text-sm font-medium ${warranty.cls}`}>{warranty.label}</div>
                  </div>
                </div>
                {(record.site_name || record.site_address || record.room_location) && (
                  <div className="md:col-span-2 lg:col-span-3 flex items-start gap-2 border-t border-slate-100 pt-3">
                    <Home className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-slate-400">สถานที่ติดตั้ง</div>
                      <div className="text-sm font-medium text-slate-700">
                        {record.site_name && <div>{record.site_name}</div>}
                        {record.room_location && <div>{record.room_location}</div>}
                        {record.site_address && <div className="text-slate-500">{record.site_address}</div>}
                      </div>
                    </div>
                  </div>
                )}
                {record.install_notes && (
                  <div className="md:col-span-2 lg:col-span-3 text-sm text-slate-600 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400 block mb-1">หมายเหตุ</span>
                    {record.install_notes}
                  </div>
                )}
              </div>
            </div>

            {hasSidebar && (
              <div className="space-y-4 lg:sticky lg:top-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">เปลี่ยนสถานะงานติดตั้ง</h3>
                  <div className="flex flex-wrap gap-3">
                    {nextTransitions.map((t) => (
                      <button
                        key={t.status}
                        onClick={() => handleTransition(t.status)}
                        disabled={transitioning}
                        className={`px-5 h-10 rounded-full text-white text-sm font-bold transition-all cursor-pointer disabled:opacity-50 ${t.color}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
