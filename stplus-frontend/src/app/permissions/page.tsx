"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Lock,
  Package,
  ShoppingCart,
  Settings,
  FolderKey,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AddPermissionDialog from "@/components/permissions/AddPermissionDialog";

const getGroupIcon = (groupName: string) => {
  if (groupName.includes("คลังสินค้า"))
    return <Package className="w-5 h-5 text-blue-600" />;
  if (groupName.includes("จัดซื้อ"))
    return <ShoppingCart className="w-5 h-5 text-blue-600" />;
  if (groupName.includes("ตั้งค่า") || groupName.includes("ระบบ"))
    return <Settings className="w-5 h-5 text-blue-600" />;

  return <FolderKey className="w-5 h-5 text-blue-600" />;
};

export default function PermissionsPage() {
  const [permissionGroups, setPermissionGroups] = useState<any>({});

  const fetchPermissions = async () => {
    const token = localStorage.getItem("stplus_token");
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    const res = await fetch(`${apiUrl}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setPermissionGroups(data);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />{" "}
            จัดการสิทธิ์การใช้งาน
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            กำหนดกุญแจสำหรับล็อคเมนูต่างๆ ในระบบ
          </p>
        </div>
        <AddPermissionDialog onAdded={fetchPermissions} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.keys(permissionGroups).map((groupName) => (
          <div
            key={groupName}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm"
          >
            <h3 className="font-bold text-lg mb-4 flex items-center gap-3 text-blue-700 dark:text-blue-400">
              {getGroupIcon(groupName)}
              {groupName}
            </h3>
            <div className="space-y-2">
              {permissionGroups[groupName].map((perm: any) => (
                <div
                  key={perm.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700"
                >
                  <span className="text-sm font-medium">{perm.name}</span>
                  <Lock className="w-3.5 h-3.5 text-slate-300" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
