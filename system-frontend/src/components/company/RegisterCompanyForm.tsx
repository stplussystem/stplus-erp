"use client";

import React, { useState } from "react";
import { Building2, User, Mail, Lock, Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  onSuccess: () => void;
  submitLabel?: string;
  // ใส่เฉพาะบริบทหน้า public (/register-company) ที่ต้องมีปุ่ม "ย้อนกลับ" คู่กับปุ่มสร้างในแถวเดียวกัน —
  // ไม่ใส่ก็ได้ (เช่นหน้าแอดมินที่ฝังฟอร์มนี้ในการ์ดย่อย) จะได้แค่ปุ่มสร้างเต็มความกว้างเดียว
  onCancel?: () => void;
}

// 🚀 Component กลางของฟอร์มลงทะเบียนบริษัทใหม่ — ใช้ร่วมกันทั้งหน้า public (/register-company) และหน้า
// แอดมิน (/company/register-settings) ตั้งใจแยกออกมาเพราะเดิมมีโค้ด validate ซ้ำ 2 ที่แล้วพลาดจุดเดียวกัน
// (ดู CLAUDE.md/บทเรียน) — แก้ที่นี่จุดเดียว ทั้ง 2 หน้าถูกต้องพร้อมกันเสมอ
export default function RegisterCompanyForm({
  onSuccess,
  submitLabel = "สร้างบริษัทใหม่เลย!",
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);
  // 🛡️ Record<string, string[]> ตรงกับ format error 422 ของ Laravel ตรงๆ — pattern เดียวกับ
  // AddUserDialog.tsx ใช้ errors.field[0] ตอนแสดงผล
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [formData, setFormData] = useState({
    company_name: "",
    admin_name: "",
    admin_username: "",
    admin_email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // 🛡️ ต้อง delete key ทิ้ง ไม่ใช่ set เป็น [] — [] เป็นค่า truthy ใน JS ทำให้เงื่อนไข
    // `errors.field && (...)` ที่ใช้โชว์กรอบ/ข้อความแดงไม่มีวันเป็น false แม้เคลียร์แล้ว (บั๊กเดิมที่เจอ)
    setErrors((prev) => {
      const next = { ...prev };
      delete next[e.target.name];
      return next;
    });
  };

  const validate = () => {
    const newErrors: Record<string, string[]> = {};
    if (!formData.company_name) newErrors.company_name = ["กรุณากรอกชื่อบริษัท"];
    if (!formData.admin_name) newErrors.admin_name = ["กรุณากรอกชื่อ-นามสกุลผู้ดูแล"];
    if (!formData.admin_username) newErrors.admin_username = ["กรุณากรอกชื่อผู้ใช้งาน"];
    if (!formData.admin_email) newErrors.admin_email = ["กรุณากรอกอีเมล"];
    if (!formData.password) newErrors.password = ["กรุณากรอกรหัสผ่าน"];
    else if (formData.password.length < 8)
      newErrors.password = ["รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"];
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const res = await fetch(`${apiUrl}/register-company`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({
          company_name: "",
          admin_name: "",
          admin_username: "",
          admin_email: "",
          password: "",
        });
        onSuccess();
      } else if (res.status === 422) {
        const errData = await res.json();
        if (errData.errors) setErrors(errData.errors);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "เกิดข้อผิดพลาดในการลงทะเบียน");
      }
    } catch {
      toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ชื่อบริษัท */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">ชื่อบริษัท</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            name="company_name"
            autoComplete="organization"
            required
            value={formData.company_name}
            onChange={handleChange}
            className={cn(
              "w-full h-10 pl-10 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
              errors.company_name &&
                "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
            )}
            placeholder="บริษัท ตัวอย่าง จำกัด"
          />
        </div>
        {errors.company_name && (
          <p className="text-red-500 text-xs font-medium mt-1">{errors.company_name[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ชื่อ-นามสกุล แอดมิน */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            ชื่อ-นามสกุล (ผู้ดูแล)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              name="admin_name"
              autoComplete="name"
              required
              value={formData.admin_name}
              onChange={handleChange}
              className={cn(
                "w-full h-10 pl-10 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
                errors.admin_name &&
                  "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
              )}
              placeholder="สมชาย ใจดี"
            />
          </div>
          {errors.admin_name && (
            <p className="text-red-500 text-xs font-medium mt-1">{errors.admin_name[0]}</p>
          )}
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            ชื่อผู้ใช้งาน (Username)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              name="admin_username"
              autoComplete="username"
              required
              value={formData.admin_username}
              onChange={handleChange}
              className={cn(
                "w-full h-10 pl-10 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
                errors.admin_username &&
                  "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
              )}
              placeholder="somchai.admin"
            />
          </div>
          {errors.admin_username && (
            <p className="text-red-500 text-xs font-medium mt-1">{errors.admin_username[0]}</p>
          )}
        </div>
      </div>

      {/* อีเมล */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">อีเมลผู้ดูแล</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="email"
            name="admin_email"
            autoComplete="email"
            required
            value={formData.admin_email}
            onChange={handleChange}
            className={cn(
              "w-full h-10 pl-10 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
              errors.admin_email &&
                "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
            )}
            placeholder="admin@company.com"
          />
        </div>
        {errors.admin_email && (
          <p className="text-red-500 text-xs font-medium mt-1">{errors.admin_email[0]}</p>
        )}
      </div>

      {/* รหัสผ่าน */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">รหัสผ่าน</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={formData.password}
            onChange={handleChange}
            className={cn(
              "w-full h-10 pl-10 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
              errors.password &&
                "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
            )}
            placeholder="อย่างน้อย 8 ตัวอักษร"
          />
        </div>
        {errors.password && (
          <p className="text-red-500 text-xs font-medium mt-1">{errors.password[0]}</p>
        )}
      </div>

      <div className={cn("flex gap-3", !onCancel && "w-full")}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex justify-center h-12 px-5 gap-2 text-sm font-semibold items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 h-12 text-sm font-semibold transition-all flex items-center justify-center cursor-pointer disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              กำลังสร้างระบบ...
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
