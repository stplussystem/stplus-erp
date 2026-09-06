"use client";

import React, { useState } from "react";
import { X, ShieldCheck, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getToken, clearSession } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PasswordModal({ isOpen, onClose }: PasswordModalProps) {
  const router = useRouter();
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdValues, setPwdValues] = useState({ newPwd: "", confirmPwd: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSavingPwd, setIsSavingPwd] = useState(false);

  if (!isOpen) return null;

  const handleLogout = async () => {
    try {
      const token =
        getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      if (token) {
        await fetch(`${apiUrl}/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearSession();
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่");
      router.push("/login");
    }
  };

  const handleSavePassword = async () => {
    const newErrors: Record<string, string> = {};
    if (!pwdValues.newPwd) newErrors.newPwd = "กรุณากรอกรหัสผ่านใหม่";
    else if (pwdValues.newPwd.length < 6)
      newErrors.newPwd = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    if (!pwdValues.confirmPwd)
      newErrors.confirmPwd = "กรุณายืนยันรหัสผ่านใหม่";
    else if (pwdValues.newPwd && pwdValues.newPwd !== pwdValues.confirmPwd)
      newErrors.confirmPwd = "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setIsSavingPwd(true);

    try {
      const token =
        getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const res = await fetch(`${apiUrl}/user/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          password: pwdValues.newPwd,
          password_confirmation: pwdValues.confirmPwd,
        }),
      });

      if (res.ok) {
        onClose();
        setPwdValues({ newPwd: "", confirmPwd: "" });
        setTimeout(() => handleLogout(), 1500);
      } else {
        const data = await res.json();
        toast.error(data.message || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
      }
    } catch (error) {
      toast.error("ระบบขัดข้อง ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
    } finally {
      setIsSavingPwd(false);
    }
  };

  const resetAndClose = () => {
    setErrors({});
    setPwdValues({ newPwd: "", confirmPwd: "" });
    setShowNewPwd(false);
    setShowConfirmPwd(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-lg text-foreground">
              แก้ไขรหัสผ่านใหม่
            </span>
          </div>
          <button
            onClick={resetAndClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              รหัสผ่านใหม่
            </label>
            <div
              className={cn(
                "flex items-center w-full h-10 px-4 rounded-xl border bg-white dark:bg-slate-950 focus-within:ring-2 transition-all overflow-hidden",
                errors.newPwd
                  ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-100"
                  : "border-slate-200 dark:border-slate-700 focus-within:border-blue-500 focus-within:ring-blue-100",
              )}
            >
              <input
                type={showNewPwd ? "text" : "password"}
                className="flex-1 h-full bg-transparent border-none outline-none text-foreground placeholder:text-slate-400 px-1"
                placeholder="กรอกรหัสผ่านใหม่..."
                value={pwdValues.newPwd}
                onChange={(e) => {
                  setPwdValues({ ...pwdValues, newPwd: e.target.value });
                  setErrors((prev) => ({ ...prev, newPwd: "" }));
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPwd(!showNewPwd)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 shrink-0 flex items-center justify-center"
              >
                {showNewPwd ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.newPwd && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.newPwd}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              ยืนยันรหัสผ่านใหม่
            </label>
            <div
              className={cn(
                "flex items-center w-full h-10 px-4 rounded-xl border bg-white dark:bg-slate-950 focus-within:ring-2 transition-all overflow-hidden",
                errors.confirmPwd
                  ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-100"
                  : "border-slate-200 dark:border-slate-700 focus-within:border-blue-500 focus-within:ring-blue-100",
              )}
            >
              <input
                type={showConfirmPwd ? "text" : "password"}
                className="flex-1 h-full bg-transparent border-none outline-none text-foreground placeholder:text-slate-400 px-1"
                placeholder="กรอกยืนยันรหัสผ่านอีกครั้ง..."
                value={pwdValues.confirmPwd}
                onChange={(e) => {
                  setPwdValues({ ...pwdValues, confirmPwd: e.target.value });
                  setErrors((prev) => ({ ...prev, confirmPwd: "" }));
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 shrink-0 flex items-center justify-center"
              >
                {showConfirmPwd ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.confirmPwd && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.confirmPwd}
              </p>
            )}
          </div>
        </div>
        <div className="p-5 border-t dark:border-slate-700 flex gap-3 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={resetAndClose}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSavePassword}
            disabled={isSavingPwd}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {isSavingPwd ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                บันทึกรหัสผ่าน
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
