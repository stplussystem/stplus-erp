"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, Mail, Lock, Loader2, KeyRound } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function RegisterCompanyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ข้อมูลที่ต้องส่งไปให้ API
  const [formData, setFormData] = useState({
    company_name: "",
    admin_name: "",
    admin_username: "",
    admin_email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.company_name) newErrors.company_name = "กรุณากรอกชื่อบริษัท";
    if (!formData.admin_name) newErrors.admin_name = "กรุณากรอกชื่อ-นามสกุลผู้ดูแล";
    if (!formData.admin_username) newErrors.admin_username = "กรุณากรอกชื่อผู้ใช้งาน";
    if (!formData.admin_email) newErrors.admin_email = "กรุณากรอกอีเมล";
    if (!formData.password) newErrors.password = "กรุณากรอกรหัสผ่าน";
    else if (formData.password.length < 8)
      newErrors.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError("");

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const response = await fetch(`${apiUrl}/register-company`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        // จัดการ Error เช่น กรอกข้อมูลซ้ำ หรือรหัสผ่านสั้นไป
        throw new Error(data.message || "เกิดข้อผิดพลาดในการลงทะเบียน");
      }

      // ถ้าสำเร็จ!
      setSuccess(true);

      // รอ 2 วินาทีให้ลูกค้าอ่านข้อความสำเร็จ แล้วเด้งไปหน้า Login
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
        {/* ส่วนหัวของฟอร์ม */}
        <div className="bg-blue-600 p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">OFFICE SYSTEM</h2>
          <p className="text-blue-100 text-sm">ลงทะเบียนเปิดใช้งานบริษัทใหม่</p>
        </div>

        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                ลงทะเบียนสำเร็จ!
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                ระบบกำลังพาท่านไปยังหน้าเข้าสู่ระบบ...
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ชื่อบริษัท */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อบริษัท
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="company_name"
                    autoComplete="organization"
                    required
                    value={formData.company_name}
                    onChange={handleChange}
                    className={cn(
                      "w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
                      errors.company_name &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                    placeholder="บริษัท ตัวอย่าง จำกัด"
                  />
                </div>
                {errors.company_name && (
                  <p className="text-red-500 text-xs font-medium mt-1">{errors.company_name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ชื่อ-นามสกุล แอดมิน */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อ-นามสกุล (ผู้ดูแล)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      name="admin_name"
                      autoComplete="name"
                      required
                      value={formData.admin_name}
                      onChange={handleChange}
                      className={cn(
                        "w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
                        errors.admin_name &&
                          "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                      )}
                      placeholder="สมชาย ใจดี"
                    />
                  </div>
                  {errors.admin_name && (
                    <p className="text-red-500 text-xs font-medium mt-1">{errors.admin_name}</p>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อผู้ใช้งาน (Username)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <KeyRound className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      name="admin_username"
                      autoComplete="username"
                      required
                      value={formData.admin_username}
                      onChange={handleChange}
                      className={cn(
                        "w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
                        errors.admin_username &&
                          "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                      )}
                      placeholder="somchai.admin"
                    />
                  </div>
                  {errors.admin_username && (
                    <p className="text-red-500 text-xs font-medium mt-1">{errors.admin_username}</p>
                  )}
                </div>
              </div>

              {/* อีเมล */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  อีเมลผู้ดูแล
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    name="admin_email"
                    autoComplete="email"
                    required
                    value={formData.admin_email}
                    onChange={handleChange}
                    className={cn(
                      "w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
                      errors.admin_email &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                    placeholder="admin@company.com"
                  />
                </div>
                {errors.admin_email && (
                  <p className="text-red-500 text-xs font-medium mt-1">{errors.admin_email}</p>
                )}
              </div>

              {/* รหัสผ่าน */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
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
                      "w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
                      errors.password &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                  />
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs font-medium mt-1">{errors.password}</p>
                )}
              </div>

              {/* ปุ่ม Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 text-sm font-semibold transition flex items-center justify-center disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    กำลังสร้างระบบ...
                  </>
                ) : (
                  "สร้างบริษัทใหม่เลย!"
                )}
              </button>
            </form>
          )}

          {/* ลิงก์กลับไปหน้า Login */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              มีบัญชีบริษัทอยู่แล้ว?{" "}
              <Link
                href="/login"
                className="text-blue-600 hover:underline font-medium"
              >
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
