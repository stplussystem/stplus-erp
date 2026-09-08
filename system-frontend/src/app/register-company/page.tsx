"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import Link from "next/link";
import RegisterCompanyForm from "@/components/company/RegisterCompanyForm";
import { cn } from "@/lib/utils";

export default function RegisterCompanyPage() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);
  // 🛡️ ตอนเปิดโหมด "รออนุมัติจาก Platform Admin" ไว้ (ดู CompanyController::getCompanyApprovalSetting())
  // บริษัทที่สมัครจากหน้านี้จะ login ไม่ได้จนกว่าจะอนุมัติ — ต้องบอกลูกค้าให้ชัดแทนข้อความ "สำเร็จ กำลังพา
  // ไปหน้า login" เดิมที่จะทำให้เข้าใจผิดว่า login ได้ทันที
  const [pending, setPending] = useState(false);

  const handleSuccess = (result?: { pending?: boolean }) => {
    setSuccess(true);
    setPending(!!result?.pending);
    // รอให้ลูกค้าอ่านข้อความสำเร็จก่อนค่อยเด้งไปหน้า Login — กรณีรออนุมัติให้เวลาอ่านนานกว่า เพราะข้อความ
    // ยาวกว่าและสำคัญกว่า (ต้องรู้ว่ายัง login ไม่ได้)
    setTimeout(
      () => {
        router.push("/login");
      },
      result?.pending ? 4000 : 2000,
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-border dark:border-slate-700">
        {/* ส่วนหัวของฟอร์ม */}
        <div className="bg-blue-600 p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">OFFICE SYSTEM</h2>
          <p className="text-blue-100 text-sm">ลงทะเบียนเปิดใช้งานบริษัทใหม่</p>
        </div>

        <div className="p-6 md:p-8">
          {success ? (
            <div className="text-center py-8">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                  pending
                    ? "bg-amber-100 text-amber-600"
                    : "bg-green-100 text-green-600",
                )}
              >
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground dark:text-white mb-2">
                {pending ? "ลงทะเบียนสำเร็จ! รอการอนุมัติ" : "ลงทะเบียนสำเร็จ!"}
              </h3>
              <p className="text-muted-foreground mb-6">
                {pending
                  ? "กรุณารอ Platform Admin อนุมัติบัญชีของท่านก่อนจึงจะเข้าสู่ระบบได้ ระบบกำลังพาท่านไปยังหน้าเข้าสู่ระบบ..."
                  : "ระบบกำลังพาท่านไปยังหน้าเข้าสู่ระบบ..."}
              </p>
              <Loader2
                className={cn(
                  "w-6 h-6 animate-spin mx-auto",
                  pending ? "text-amber-600" : "text-blue-600",
                )}
              />
            </div>
          ) : (
            <RegisterCompanyForm
              onSuccess={handleSuccess}
              onCancel={() => router.push("/login")}
            />
          )}

          {/* ลิงก์กลับไปหน้า Login */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
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
