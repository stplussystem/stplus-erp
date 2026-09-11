"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spotlight, ArrowLeft, Save, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";

interface UserOption {
  id: number;
  name: string;
}

export default function RentalJobCreatePage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [jobTypeOptions, setJobTypeOptions] = useState<string[]>([]);
  const [customJobType, setCustomJobType] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    location: "",
    status: "draft",
    contact_id: "",
    pic_user_id: "",
    start_date: "",
    end_date: "",
    job_types: [] as string[],
    note: "",
  });
  const [selectedContactName, setSelectedContactName] = useState("");
  const [selectedContactCode, setSelectedContactCode] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getToken();
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };

        const [usersRes, jobTypesRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/options`, {
            headers,
          }),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/rental-jobs/job-type-options`,
            { headers },
          ),
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.data || []);
        }
        if (jobTypesRes.ok) {
          const data = await jobTypesRes.json();
          setJobTypeOptions(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching form data:", error);
      }
    };
    fetchData();
  }, []);

  const toggleJobType = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      job_types: prev.job_types.includes(type)
        ? prev.job_types.filter((t) => t !== type)
        : [...prev.job_types, type],
    }));
  };

  const addCustomJobType = () => {
    const trimmed = customJobType.trim();
    if (!trimmed) return;
    if (!jobTypeOptions.includes(trimmed)) {
      setJobTypeOptions((prev) => [...prev, trimmed]);
    }
    if (!formData.job_types.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        job_types: [...prev.job_types, trimmed],
      }));
    }
    setCustomJobType("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("กรุณากรอกชื่องานเช่า");
      return;
    }
    if (
      formData.start_date &&
      formData.end_date &&
      formData.end_date < formData.start_date
    ) {
      toast.error("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("กำลังบันทึกงานเช่า...");
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/rental-jobs`,
        {
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
        },
      );

      if (res.ok) {
        const result = await res.json();
        toast.success("บันทึกงานเช่าสำเร็จ", { id: toastId });
        router.push(`/rental-jobs/${result.data.id}`);
      } else {
        const err = await res.json();
        toast.error("ไม่สามารถบันทึกได้", {
          id: toastId,
          description: err.message,
        });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Spotlight className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">เพิ่มงานเช่า</h1>
          </div>
        </div>
        <button
          onClick={() => router.push("/rental-jobs")}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-full transition-all cursor-pointer"
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
              ชื่องาน <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              สถานที่
            </label>
            <input
              type="text"
              className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
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
                setSelectedContactName(
                  contactData.business_name || contactData.contact_name || "",
                );
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
                setFormData({
                  ...formData,
                  pic_user_id: v === "__none__" ? "" : v,
                })
              }
              options={[
                { value: "__none__", label: "-- ไม่ระบุ --" },
                ...users.map((u) => ({ value: String(u.id), label: u.name })),
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              สถานะ
            </label>
            <AppSelect
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
              options={[
                { value: "draft", label: "ร่าง" },
                { value: "confirmed", label: "ยืนยันแล้ว" },
                { value: "in_progress", label: "กำลังดำเนินการ" },
                { value: "completed", label: "เสร็จสิ้น" },
                { value: "cancelled", label: "ยกเลิก" },
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

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            รูปแบบงาน (เลือกได้มากกว่า 1)
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {jobTypeOptions.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleJobType(type)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  formData.job_types.includes(type)
                    ? "bg-blue-200 border-blue-300 text-blue-700"
                    : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ระบุรูปแบบงานเพิ่มเติมเอง แล้วกด +"
              className="flex-1 h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={customJobType}
              onChange={(e) => setCustomJobType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomJobType();
                }
              }}
            />
            <button
              type="button"
              onClick={addCustomJobType}
              className="h-10 px-4 rounded-xl border border-border text-muted-foreground hover:bg-muted/50 flex items-center gap-1.5 text-sm font-bold cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          </div>
          {formData.job_types.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {formData.job_types.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full"
                >
                  {type}
                  <button
                    type="button"
                    onClick={() => toggleJobType(type)}
                    className="cursor-pointer hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            หมายเหตุ
          </label>
          <textarea
            className="w-full px-4 py-2.5 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
            rows={3}
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push("/rental-jobs")}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            บันทึกงานเช่า
          </button>
        </div>
      </form>
    </div>
  );
}
