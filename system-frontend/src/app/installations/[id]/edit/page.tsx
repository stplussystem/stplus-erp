"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MapPin, ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";

interface UserOption {
  id: number;
  name: string;
}

export default function InstallationEditPage() {
  const router = useRouter();
  const params = useParams();
  const recordId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [installationNumber, setInstallationNumber] = useState("");

  const [formData, setFormData] = useState({
    site_name: "",
    site_address: "",
    room_location: "",
    install_notes: "",
    warranty_months: "",
    installed_by: "",
    scheduled_at: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = getToken();
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [recordRes, usersRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/installations/${recordId}`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/options`, { headers }),
        ]);

        if (recordRes.ok) {
          const data = await recordRes.json();
          const r = data.data;
          if (r.status !== "scheduled") {
            toast.error("แก้ไขได้เฉพาะงานที่ยังไม่ติดตั้งเท่านั้น");
            router.push(`/installations/${recordId}`);
            return;
          }
          setInstallationNumber(r.installation_number);
          setFormData({
            site_name: r.site_name || "",
            site_address: r.site_address || "",
            room_location: r.room_location || "",
            install_notes: r.install_notes || "",
            warranty_months: r.warranty_months != null ? String(r.warranty_months) : "",
            installed_by: r.installed_by ? String(r.installed_by) : "",
            scheduled_at: r.scheduled_at || "",
          });
        } else {
          toast.error("ไม่พบข้อมูลงานติดตั้ง");
          router.push("/installations");
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.data || []);
        }
      } catch (error) {
        toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading("กำลังบันทึกการแก้ไข...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/installations/${recordId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...formData,
          warranty_months: formData.warranty_months ? Number(formData.warranty_months) : null,
          installed_by: formData.installed_by || null,
          scheduled_at: formData.scheduled_at || null,
        }),
      });
      if (res.ok) {
        toast.success("บันทึกการแก้ไขสำเร็จ", { id: toastId });
        router.push(`/installations/${recordId}`);
      } else {
        const err = await res.json();
        toast.error("บันทึกไม่สำเร็จ", { id: toastId, description: err.message });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AppLoading />;
  }

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">แก้ไขงานติดตั้ง {installationNumber}</h1>
          </div>
        </div>
        <button
          onClick={() => router.push(`/installations/${recordId}`)}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อสถานที่</label>
            <input
              type="text"
              className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.site_name}
              onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ที่อยู่ติดตั้ง</label>
            <textarea
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
              rows={2}
              value={formData.site_address}
              onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ห้อง/จุดติดตั้ง</label>
            <input
              type="text"
              className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.room_location}
              onChange={(e) => setFormData({ ...formData, room_location: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ประกัน (เดือน)</label>
            <input
              type="number"
              min="0"
              className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.warranty_months}
              onChange={(e) => setFormData({ ...formData, warranty_months: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ช่างผู้ติดตั้ง</label>
            <AppSelect
              value={formData.installed_by || "__none__"}
              onValueChange={(v) =>
                setFormData({ ...formData, installed_by: v === "__none__" ? "" : v })
              }
              options={[
                { value: "__none__", label: "-- ไม่ระบุ --" },
                ...users.map((u) => ({ value: String(u.id), label: u.name })),
              ]}
            />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">วันที่นัดหมาย</label>
            <AppDatePicker
              value={formData.scheduled_at}
              onChange={(v) => setFormData({ ...formData, scheduled_at: v })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">หมายเหตุ</label>
          <textarea
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
            rows={3}
            value={formData.install_notes}
            onChange={(e) => setFormData({ ...formData, install_notes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => router.push(`/installations/${recordId}`)}
            className="h-10 px-5 rounded-full font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all hover:border-slate-400"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 rounded-full h-10 px-6 gap-2 shadow-lg shadow-blue-600/20 text-white flex items-center justify-center font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกการแก้ไข
          </button>
        </div>
      </div>
    </div>
  );
}
