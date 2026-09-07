"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HousePlus } from "lucide-react";
import { toast } from "sonner";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { Switch } from "@/components/ui/switch";
import { AppLoading } from "@/components/ui/app-loading";
import RegisterCompanyForm from "@/components/company/RegisterCompanyForm";

// 🛡️ เมนูนี้เห็นเฉพาะ Platform Admin เท่านั้น (ดู UserSessionFormatter.php ฝั่ง backend ที่เติมเมนูนี้เข้าไป
// เฉพาะ user.is_platform_admin) — ไม่ใช้ RoleRouteGuard เพราะตัวนั้น bypass ให้ isSuperAdmin ของทุกบริษัท
// ด้วย ซึ่งไม่ต้องการตรงนี้ (ต้องเป็น Platform Admin เจ้าของระบบเท่านั้นจริงๆ)
export default function RegisterCompanyVisibilitySettingsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      const rawUser = getUserRaw();
      const user = rawUser ? JSON.parse(rawUser)?.user : null;
      if (!user?.is_platform_admin) {
        toast.error("เฉพาะ Platform Admin เท่านั้นที่เข้าหน้านี้ได้");
        router.replace("/dashboard");
        return;
      }
      setIsAuthorized(true);
    } catch {
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const fetchSetting = async () => {
      try {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const res = await fetch(`${apiUrl}/settings/register-company-visibility`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          setEnabled(!!data.show_register_company_link);
        } else {
          toast.error("โหลดการตั้งค่าไม่สำเร็จ");
        }
      } catch {
        toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      } finally {
        setLoading(false);
      }
    };
    fetchSetting();
  }, [isAuthorized]);

  const toggleEnabled = async (checked: boolean) => {
    setSaving(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/settings/register-company-visibility`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) throw new Error();
      setEnabled(checked);
      toast.success(
        checked
          ? "แสดงลิงก์ลงทะเบียนบริษัทที่หน้า login แล้ว"
          : "ซ่อนลิงก์ลงทะเบียนบริษัทที่หน้า login แล้ว",
      );
    } catch {
      toast.error("บันทึกการตั้งค่าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthorized || loading) {
    return (
      <AppLoading
        text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..."
        minHeight="min-h-screen"
        className="bg-muted/50"
      />
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <HousePlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">ลงทะเบียนบริษัท</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ควบคุมการแสดงลิงก์สมัครใช้งานบริษัทใหม่ที่หน้าเข้าสู่ระบบ
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              แสดงลิงก์ "สร้างระบบสำหรับบริษัทคุณ" ที่หน้า Login
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              ปิดสวิตช์นี้เพื่อซ่อนลิงก์สมัครเปิดบริษัทใหม่จากหน้า login สาธารณะ (ยังเข้าหน้า
              /register-company ตรงๆ ผ่าน URL ได้อยู่ แค่ไม่มีลิงก์ให้กดจากหน้า login เท่านั้น)
            </p>
          </div>
          <Switch checked={enabled} disabled={saving} onCheckedChange={toggleEnabled} />
        </div>
      </div>

      {/* 🚀 ให้ Platform Admin สร้างบริษัทให้ลูกค้าได้เองอยู่เสมอ ไม่ว่าสวิตช์ด้านบนจะปิดอยู่หรือไม่
          (สวิตช์คุมแค่ลิงก์สาธารณะที่หน้า login เท่านั้น ไม่ได้คุมความสามารถของ Platform Admin เอง) */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mt-6">
        <h3 className="text-sm font-bold text-foreground mb-4">สร้างบริษัทใหม่ให้ลูกค้า</h3>
        <RegisterCompanyForm
          submitLabel="สร้างบริษัทใหม่"
          onSuccess={() =>
            toast.success(
              "สร้างบริษัทใหม่สำเร็จ! ลูกค้าเข้าสู่ระบบด้วยบัญชีที่กรอกไว้ได้ทันที",
            )
          }
        />
      </div>
    </div>
  );
}
