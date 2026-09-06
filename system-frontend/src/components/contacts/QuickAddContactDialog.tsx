"use client";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";

interface QuickAddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contactId: string, contactData: any) => void;
}

// 🚀 เพิ่มลูกค้าใหม่แบบด่วน — ใช้เฉพาะฟิลด์บังคับขั้นต่ำของ ContactController::store()
// (contact_code, business_name, contact_type, branch_type) บวกฟิลด์ที่มีประโยชน์เพิ่มเติม (มือถือ/ที่อยู่)
export function QuickAddContactDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickAddContactDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_code: "",
    business_name: "",
    contact_type: "company",
    mobile: "",
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setForm({
      contact_code: "",
      business_name: "",
      contact_type: "company",
      mobile: "",
      address: "",
    });
    setErrors({});
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.contact_code.trim())
      newErrors.contact_code = "กรุณาระบุรหัสผู้ติดต่อ";
    if (!form.business_name.trim())
      newErrors.business_name = "กรุณาระบุชื่อกิจการ/ลูกค้า";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const body = new FormData();
      body.append("contact_code", form.contact_code.trim());
      body.append("business_name", form.business_name.trim());
      body.append("contact_type", form.contact_type);
      body.append("branch_type", "head_office");
      if (form.mobile.trim()) body.append("mobile", form.mobile.trim());
      if (form.address.trim()) body.append("address", form.address.trim());

      const res = await fetch(`${apiUrl}/contacts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        if (result?.errors) {
          const fieldErrors: Record<string, string> = {};
          Object.keys(result.errors).forEach((k) => {
            fieldErrors[k] = result.errors[k][0];
          });
          setErrors(fieldErrors);
        }
        toast.error(result?.message || "เพิ่มลูกค้าไม่สำเร็จ");
        return;
      }
      const newContact = result.data || result;
      toast.success("เพิ่มลูกค้าใหม่สำเร็จ");
      onCreated(String(newContact.id), newContact);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบขณะเพิ่มลูกค้า");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md rounded-2xl p-0 bg-white border-0 shadow-2xl overflow-hidden [&>button]:hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <DialogTitle className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <UserPlus className="w-5 h-5 text-blue-600" /> เพิ่มลูกค้าใหม่แบบด่วน
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              รหัสผู้ติดต่อ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`w-full h-10 px-4 text-sm rounded-xl border outline-none focus:ring-2 ${
                errors.contact_code
                  ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
              }`}
              placeholder="เช่น ABCDE"
              value={form.contact_code}
              onChange={(e) =>
                setForm({ ...form, contact_code: e.target.value })
              }
            />
            {errors.contact_code && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.contact_code}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              ชื่อกิจการ/ลูกค้า <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`w-full h-10 px-4 text-sm rounded-xl border outline-none focus:ring-2 ${
                errors.business_name
                  ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
              }`}
              placeholder="ชื่อบริษัท / ชื่อลูกค้า"
              value={form.business_name}
              onChange={(e) =>
                setForm({ ...form, business_name: e.target.value })
              }
            />
            {errors.business_name && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.business_name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              เบอร์โทร
            </label>
            <input
              type="text"
              className="w-full h-10 px-4 text-sm rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="เช่น 0812345678"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              ที่อยู่ (แบบย่อ)
            </label>
            <textarea
              rows={2}
              className="w-full p-3 text-sm rounded-xl border border-slate-200 outline-none resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="ที่อยู่สำหรับติดต่อ"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 px-4 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer transition-all"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            บันทึกลูกค้า
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
