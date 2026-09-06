"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Wrench, ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";

interface UserOption {
  id: number;
  name: string;
}

export default function RepairEditPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ticketNumber, setTicketNumber] = useState("");

  const [formData, setFormData] = useState({
    reported_issue: "",
    diagnosis_notes: "",
    repair_cost: "",
    assigned_to: "",
    is_under_warranty: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = getToken();
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [ticketRes, usersRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/repairs/${ticketId}`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/options`, { headers }),
        ]);

        if (ticketRes.ok) {
          const data = await ticketRes.json();
          const t = data.data;
          setTicketNumber(t.ticket_number);
          setFormData({
            reported_issue: t.reported_issue || "",
            diagnosis_notes: t.diagnosis_notes || "",
            repair_cost: t.repair_cost != null ? String(t.repair_cost) : "",
            assigned_to: t.assigned_to ? String(t.assigned_to) : "",
            is_under_warranty: !!t.is_under_warranty,
          });
        } else {
          toast.error("ไม่พบข้อมูลงานซ่อม");
          router.push("/repairs");
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
  }, [ticketId]);

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading("กำลังบันทึกการแก้ไข...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repairs/${ticketId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...formData,
          repair_cost: formData.repair_cost ? Number(formData.repair_cost) : null,
          assigned_to: formData.assigned_to || null,
        }),
      });
      if (res.ok) {
        toast.success("บันทึกการแก้ไขสำเร็จ", { id: toastId });
        router.push(`/repairs/${ticketId}`);
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
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">แก้ไขงานซ่อม {ticketNumber}</h1>
          </div>
        </div>
        <button
          onClick={() => router.push(`/repairs/${ticketId}`)}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            อาการที่ลูกค้าแจ้ง
          </label>
          <textarea
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
            rows={3}
            value={formData.reported_issue}
            onChange={(e) => setFormData({ ...formData, reported_issue: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            บันทึกการตรวจ/ซ่อม
          </label>
          <textarea
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
            rows={4}
            value={formData.diagnosis_notes}
            onChange={(e) => setFormData({ ...formData, diagnosis_notes: e.target.value })}
            placeholder="บันทึกผลการตรวจสอบ สาเหตุ วิธีแก้ไข..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              ค่าซ่อมโดยประมาณ (บาท)
            </label>
            <input
              type="number"
              min="0"
              className="w-full h-10 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.repair_cost}
              onChange={(e) => setFormData({ ...formData, repair_cost: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              ช่างผู้รับผิดชอบ
            </label>
            <AppSelect
              value={formData.assigned_to || "__none__"}
              onValueChange={(v) =>
                setFormData({ ...formData, assigned_to: v === "__none__" ? "" : v })
              }
              options={[
                { value: "__none__", label: "-- ไม่ระบุ --" },
                ...users.map((u) => ({ value: String(u.id), label: u.name })),
              ]}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_under_warranty}
              onChange={(e) => setFormData({ ...formData, is_under_warranty: e.target.checked })}
              className="w-4 h-4 rounded cursor-pointer"
            />
            อยู่ในประกัน
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => router.push(`/repairs/${ticketId}`)}
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
