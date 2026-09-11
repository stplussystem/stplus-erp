"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getUserRaw } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";

interface GuardProps {
  children: React.ReactNode;
  permission: string; // 💡 ส่งชื่อสิทธิ์ที่ต้องการล็อกไว้ที่นี่
}

export default function RoleRouteGuard({ children, permission }: GuardProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const storedUser =
      getUserRaw();

    if (!storedUser) {
      router.replace("/");
      return;
    }

    try {
      const parsedData = JSON.parse(storedUser);
      const user = parsedData.user;

      if (!user) {
        router.replace("/");
        return;
      }

      // 🛡️ เช็คเงื่อนไขความปลอดภัยสูงสุดในจุดเดียว
      const isSuperAdmin =
        Array.isArray(user.roles) &&
        user.roles.some((r: any) =>
          typeof r === "string"
            ? r.includes("Super Admin")
            : r?.name?.includes("Super Admin"),
        );

      const hasPermission =
        user.is_platform_admin ||
        isSuperAdmin ||
        (Array.isArray(user.permissions) &&
          user.permissions.some((p: any) =>
            typeof p === "string" ? p === permission : p?.name === permission,
          ));

      if (!hasPermission) {
        toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        router.replace("/dashboard");
      } else {
        setIsAuthorized(true);
      }
    } catch (error) {
      router.replace("/");
    }
  }, [permission, router]);

  if (!isAuthorized) {
    return (
      <AppLoading
        text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..."
        minHeight="min-h-screen"
        className="bg-muted/50"
      />
    );
  }

  return <>{children}</>;
}
