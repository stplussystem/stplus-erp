"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  KeyRound,
  Eye,
  EyeOff,
  X,
  ShieldCheck,
  Loader2,
  Save,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

export default function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: ResetPasswordDialogProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetPwdValues, setResetPwdValues] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [showResetConfirmPwd, setShowResetConfirmPwd] = useState(false);
  const [resetErrors, setResetErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (open) {
      setResetPwdValues({ password: "", confirmPassword: "" });
      setResetErrors({});
      setShowResetPwd(false);
      setShowResetConfirmPwd(false);
    }
  }, [open, user]);

  const clearResetError = (field: string) => {
    setResetErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const getAuthHeader = () => {
    const token = getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  };

  const submitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string[]> = {};
    if (!resetPwdValues.password)
      newErrors.password = ["กรุณากรอกรหัสผ่านใหม่"];
    if (!resetPwdValues.confirmPassword)
      newErrors.confirmPassword = ["กรุณายืนยันรหัสผ่านใหม่"];
    if (
      resetPwdValues.password &&
      resetPwdValues.confirmPassword &&
      resetPwdValues.password !== resetPwdValues.confirmPassword
    ) {
      newErrors.confirmPassword = ["รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน"];
    }
    if (Object.keys(newErrors).length > 0) {
      setResetErrors(newErrors);
      return;
    }
    setResetErrors({});

    if (!user) return;

    setIsResetting(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/users/${user.id}/reset-password`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          password: resetPwdValues.password,
          password_confirmation: resetPwdValues.confirmPassword,
        }),
      });

      if (res.ok) {
        toast.success(`รีเซ็ตรหัสผ่านให้ ${user.name} สำเร็จ!`);
        onOpenChange(false);
      } else if (res.status === 422) {
        const errData = await res.json();
        if (errData.errors) setResetErrors(errData.errors);
      } else {
        toast.error("รีเซ็ตรหัสผ่านไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setIsResetting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900 [&>button.absolute]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>เปลี่ยนรหัสผ่านเร่งด่วน</DialogTitle>
          <DialogDescription>
            ฟอร์มสำหรับเปลี่ยนรหัสผ่านพนักงานโดยแอดมิน
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-amber-200 dark:border-amber-800">
            <ShieldCheck className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-slate-500 text-sm mb-6 text-center">
            รีเซ็ตรหัสผ่าน{" "}
            <strong className="text-red-600 dark:text-slate-200 text-lg">
              {user.name}
            </strong>{" "}
            ใหม่
          </p>
          <form
            id="reset-pwd-form"
            onSubmit={submitResetPassword}
            className="space-y-5"
            autoComplete="off"
          >
            {/* 🚀 เวทมนตร์ล่อเบราว์เซอร์: สร้างช่องปลอมซ่อนไว้ ให้ Chrome เอาข้อมูลมาทิ้งไว้ตรงนี้! */}
            <div className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden">
              <input
                type="text"
                name="fake_username"
                autoComplete="username"
                tabIndex={-1}
              />
              <input
                type="password"
                name="fake_password"
                autoComplete="current-password"
                tabIndex={-1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">
                รหัสผ่านใหม่
              </Label>
              <div className="relative">
                <Input
                  type={showResetPwd ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={resetPwdValues.password}
                  onChange={(e) => {
                    setResetPwdValues({
                      ...resetPwdValues,
                      password: e.target.value,
                    });
                    clearResetError("password");
                  }}
                  className={cn(
                    "rounded-xl h-11 pr-10",
                    resetErrors.password &&
                      "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowResetPwd(!showResetPwd)}
                  className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showResetPwd ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {resetErrors.password && (
                <p className="text-red-500 text-xs font-medium mt-1">
                  {resetErrors.password[0]}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-bold text-slate-500">
                ยืนยันรหัสผ่านใหม่
              </Label>
              <div className="relative">
                <Input
                  type={showResetConfirmPwd ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={resetPwdValues.confirmPassword}
                  onChange={(e) => {
                    setResetPwdValues({
                      ...resetPwdValues,
                      confirmPassword: e.target.value,
                    });
                    clearResetError("confirmPassword");
                  }}
                  className={cn(
                    "rounded-xl h-11 pr-10",
                    resetErrors.confirmPassword &&
                      "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowResetConfirmPwd(!showResetConfirmPwd)}
                  className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showResetConfirmPwd ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {resetErrors.confirmPassword && (
                <p className="text-red-500 text-xs font-medium mt-1">
                  {resetErrors.confirmPassword[0]}
                </p>
              )}
            </div>
          </form>
          <div className="bg-slate-50 dark:bg-slate-800/50 flex gap-3 pt-6 justify-center">
            <Button
              type="button"
              variant="outline"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="w-4 h-4" /> ยกเลิก
            </Button>
            <Button
              type="submit"
              form="reset-pwd-form"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              disabled={isResetting}
            >
              {isResetting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              บันทึกข้อมูล
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
