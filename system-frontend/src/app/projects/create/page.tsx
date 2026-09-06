"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";

interface UserOption {
  id: number;
  name: string;
}

export default function ProjectCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
    contact_id: "",
    pic_user_id: "",
    start_date: "",
    end_date: "",
  });
  const [selectedContactName, setSelectedContactName] = useState("");
  const [selectedContactCode, setSelectedContactCode] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/options`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
  }, []);

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
    const toastId = toast.loading("กำลังสร้างโครงการ...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...formData,
          contact_id: formData.contact_id || null,
          pic_user_id: formData.pic_user_id || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("สร้างโครงการสำเร็จ", { id: toastId });
        router.push(`/projects/${data.data.id}`);
      } else {
        const err = await res.json();
        toast.error("ไม่สามารถสร้างโครงการได้", { id: toastId, description: err.message });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">สร้างโครงการใหม่</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              กรอกข้อมูลโครงการเพื่อเริ่มต้นผูกเอกสารต่างๆ เข้าด้วยกัน
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/projects")}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-full transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-5"
      >
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            ชื่อโครงการ <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="เช่น โครงการติดตั้งระบบไฟฟ้า อาคาร A"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">รายละเอียด</label>
          <textarea
            className="w-full px-4 py-2.5 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="รายละเอียดเพิ่มเติมของโครงการ"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกโครงการ
          </button>
        </div>
      </form>
    </div>
  );
}
