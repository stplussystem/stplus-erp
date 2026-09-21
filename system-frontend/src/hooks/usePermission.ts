"use client";

import { useState, useEffect, useCallback } from "react";
import { getUserRaw, AUTH_UPDATED_EVENT } from "@/lib/auth-storage";

export function usePermission(permissionName: string): boolean {
  const [hasPermission, setHasPermission] = useState(false);

  const recompute = useCallback(() => {
    try {
      const storedUser = getUserRaw();

      if (!storedUser) {
        setHasPermission(false);
        return;
      }

      const parsedData = JSON.parse(storedUser);
      const user = parsedData.user;

      if (!user) {
        setHasPermission(false);
        return;
      }

      // 1. ถ้าเป็น Platform Admin ให้ผ่านฉลุย
      if (user.is_platform_admin) {
        setHasPermission(true);
        return;
      }

      // 🚀 2. เช็ค Super Admin (รองรับข้อมูลทั้งแบบ String ธรรมดา และแบบ Object)
      const isSuperAdmin =
        Array.isArray(user.roles) &&
        user.roles.some((r: any) =>
          typeof r === "string"
            ? r.includes("Super Admin")
            : r?.name?.includes("Super Admin"),
        );

      if (isSuperAdmin) {
        setHasPermission(true);
        return;
      }

      // 3. วนลูปเช็คสิทธิ์รายตัว (รองรับข้อมูลทั้งแบบ String และแบบ Object)
      const match =
        Array.isArray(user.permissions) &&
        user.permissions.some((p: any) =>
          typeof p === "string"
            ? p === permissionName
            : p?.name === permissionName,
        );

      setHasPermission(!!match);
    } catch (error) {
      console.error("Error checking permission:", error);
      setHasPermission(false);
    }
  }, [permissionName]);

  useEffect(() => {
    recompute();

    // 🚀 เดิม hook นี้เช็คแค่ตอน mount ครั้งเดียว ถ้าแอดมินเปลี่ยนสิทธิ์/role ให้ผู้ใช้ระหว่างที่หน้าเปิดค้างไว้
    // ปุ่ม/เมนูที่ผูกกับ hook นี้จะไม่มีทางรู้เลยจนกว่าจะ refresh มือ — ฟัง 2 event เพิ่ม:
    // (1) auth:updated — ยิงในแท็บตัวเองทุกครั้งที่ setSession()/clearSession() ทำงาน (เช่น หลัง AppLayout รีเฟรช /api/me)
    // (2) storage — เบราว์เซอร์ยิงให้อัตโนมัติเมื่อแท็บอื่นของ origin เดียวกันเขียน localStorage เปลี่ยน (cross-tab sync ฟรี)
    window.addEventListener(AUTH_UPDATED_EVENT, recompute);
    window.addEventListener("storage", recompute);
    return () => {
      window.removeEventListener(AUTH_UPDATED_EVENT, recompute);
      window.removeEventListener("storage", recompute);
    };
  }, [recompute]);

  return hasPermission;
}
