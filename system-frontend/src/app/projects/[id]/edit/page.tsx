"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FolderKanban, ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { PROJECT_STAGES } from "@/lib/projectStages";

interface UserOption {
  id: number;
  name: string;
}

export default function ProjectEditPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
    stage: "",
    contact_id: "",
    pic_user_id: "",
    start_date: "",
    end_date: "",
  });
  const [selectedContactName, setSelectedContactName] = useState("");
  const [selectedContactCode, setSelectedContactCode] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = getToken();
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

        const [projRes, usersRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/options`, { headers }),
        ]);

        if (projRes.ok) {
          const data = await projRes.json();
          const p = data.data;
          setFormData({
            name: p.name || "",
            description: p.description || "",
            status: p.status || "active",
            stage: p.stage || "",
            contact_id: p.contact_id ? String(p.contact_id) : "",
            pic_user_id: p.pic_user_id ? String(p.pic_user_id) : "",
            start_date: p.start_date || "",
            end_date: p.end_date || "",
          });
          setSelectedContactName(p.contact?.business_name || p.contact?.name || "");
          setSelectedContactCode(p.contact?.contact_code || "");
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching project:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("กรุณากรอกชื่อโครงการ");
      return;
    }
    if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      toast.error("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("กำลังบันทึกการแก้ไข...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...formData,
          stage: formData.stage || null,
          contact_id: formData.contact_id || null,
          pic_user_id: formData.pic_user_id || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }),
      });

      if (res.ok) {
        toast.success("บันทึกการแก้ไขสำเร็จ", { id: toastId });
        router.push(`/projects/${projectId}`);
      } else {
        const err = await res.json();
        toast.error("ไม่สามารถบันทึกได้", { id: toastId, description: err.message });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AppLoading text="กำลังโหลดข้อมูลโครงการ..." />;
  }

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">แก้ไขโครงการ</h1>
          </div>
        </div>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              ชื่อโครงการ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-foreground mb-1.5">รายละเอียด</label>
            <textarea
              className="w-full px-4 py-2.5 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              ลูกค้า / ผู้ติดต่อ
            </label>
            <ContactSearchDropdown
              value={formData.contact_id}
              selectedName={selectedContactName}
              selectedCode={selectedContactCode}
              onChange={(id, contactData) => {
                setFormData({ ...formData, contact_id: id });
                setSelectedContactName(contactData.business_name || contactData.contact_name || "");
                setSelectedContactCode(contactData.contact_code || "");
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              ผู้รับผิดชอบ (PIC)
            </label>
            <AppSelect
              value={formData.pic_user_id || "__none__"}
              onValueChange={(v) =>
                setFormData({ ...formData, pic_user_id: v === "__none__" ? "" : v })
              }
              options={[
                { value: "__none__", label: "-- ไม่ระบุ --" },
                ...users.map((u) => ({ value: String(u.id), label: u.name })),
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">สถานะ</label>
            <AppSelect
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
              options={[
                { value: "active", label: "กำลังดำเนินการ" },
                { value: "completed", label: "เสร็จสิ้น" },
                { value: "on_hold", label: "พักไว้" },
                { value: "cancelled", label: "ยกเลิก" },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">ขั้นตอนงาน</label>
            <AppSelect
              value={formData.stage || "__none__"}
              onValueChange={(v) => setFormData({ ...formData, stage: v === "__none__" ? "" : v })}
              options={[
                { value: "__none__", label: "-- ยังไม่ระบุ --" },
                ...PROJECT_STAGES.map((s) => ({ value: s.value, label: s.label })),
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              วันที่เริ่มต้น
            </label>
            <AppDatePicker
              value={formData.start_date}
              onChange={(v) => setFormData({ ...formData, start_date: v })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              วันที่สิ้นสุด
            </label>
            <AppDatePicker
              value={formData.end_date}
              onChange={(v) => setFormData({ ...formData, end_date: v })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}`)}
            className="flex justify-center h-10 p-4 w-full md:w-auto gap-2  text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกการแก้ไข
          </button>
        </div>
      </form>
    </div>
  );
}
