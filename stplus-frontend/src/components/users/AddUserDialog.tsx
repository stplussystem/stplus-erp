"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus,
  Loader2,
  ShieldCheck,
  X,
  CheckCheck,
  Package,
  ShoppingCart,
  Settings,
  FolderKey,
} from "lucide-react";
import { cn } from "@/lib/utils";

const getGroupIcon = (groupName: string) => {
  if (groupName.includes("คลังสินค้า"))
    return <Package className="w-5 h-5 text-blue-600" />;
  if (groupName.includes("จัดซื้อ"))
    return <ShoppingCart className="w-5 h-5 text-blue-600" />;
  if (groupName.includes("ตั้งค่า") || groupName.includes("ระบบ"))
    return <Settings className="w-5 h-5 text-blue-600" />;

  // ถ้าหาไม่เจอ ให้แสดงไอคอนโฟลเดอร์กุญแจเป็นค่าเริ่มต้น
  return <FolderKey className="w-5 h-5 text-blue-600" />;
};
export default function AddUserDialog({
  onUserAdded,
}: {
  onUserAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionGroups, setPermissionGroups] = useState<any>({});

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const fetchPermissions = async () => {
    try {
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
    } catch (error) {
      console.error("Fetch permissions error:", error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPermissions();
    }
  }, [open]);

  const togglePermission = (permName: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permName)
        ? prev.filter((name) => name !== permName)
        : [...prev, permName],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน!");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("stplus_token");
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const payload = {
        name: formData.name,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        permissions: selectedPermissions,
      };

      const res = await fetch(`${apiUrl}/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("เพิ่มพนักงานสำเร็จ!");
        setFormData({
          name: "",
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
        });
        setSelectedPermissions([]);
        setOpen(false);
        onUserAdded();
      } else {
        const err = await res.json();
        toast.error(err.message || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 rounded-xl px-6 py-2.5 font-bold flex items-center gap-2 transition-all active:scale-95">
          <UserPlus className="w-5 h-5" /> เพิ่มพนักงาน
        </button>
      </DialogTrigger>

      {/* 💡 เพิ่ม [&>button.absolute]:hidden เพื่อซ่อนปุ่ม X สีดำตัวเก่าของระบบ */}
      <DialogContent className="sm:max-w-[750px] p-0 rounded-3xl overflow-hidden border-none shadow-2xl [&>button.absolute]:hidden">
        <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
          <div>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <UserPlus className="w-7 h-7" /> เพิ่มผู้ใช้งานใหม่
            </DialogTitle>
            <p className="text-blue-100 text-sm mt-1">
              กรอกข้อมูลบัญชีและกำหนดสิทธิ์การเข้าถึงเมนูต่างๆ
            </p>
          </div>
          {/* ปุ่ม X สีขาวสวยๆ ของเรายังอยู่เหมือนเดิม */}
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
          <form
            id="add-user-form"
            onSubmit={handleSubmit}
            className="space-y-8"
            autoComplete="off"
          >
            {/* ข้อมูลบัญชี */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b dark:border-slate-800">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  ข้อมูลบัญชีผู้ใช้
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    ชื่อ-นามสกุล
                  </Label>
                  <Input
                    placeholder="สมชาย ใจดี"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="rounded-xl h-11"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    Username
                  </Label>
                  <Input
                    placeholder="somchai_j"
                    required
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="rounded-xl h-11"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-bold text-slate-500">
                    อีเมล
                  </Label>
                  <Input
                    type="email"
                    placeholder="somchai@stplus.com"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="rounded-xl h-11"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    รหัสผ่าน
                  </Label>
                  {/* 💡 ใส่ autoComplete="new-password" เพื่อกันเบราว์เซอร์เติมรหัสเก่า */}
                  <Input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="rounded-xl h-11"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    ยืนยันรหัสผ่าน
                  </Label>
                  {/* 💡 ใส่ autoComplete="new-password" ที่นี่ด้วย */}
                  <Input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    className={cn(
                      "rounded-xl h-11",
                      formData.confirmPassword &&
                        formData.password !== formData.confirmPassword
                        ? "border-red-500 bg-red-50"
                        : "",
                    )}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {/* สิทธิ์การใช้งานแบบ Dynamic */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b dark:border-slate-800">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  กำหนดสิทธิ์การใช้งาน (Dynamic Permissions)
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {Object.keys(permissionGroups).length === 0 ? (
                  <p className="text-center py-4 text-slate-400 text-sm italic">
                    ยังไม่มีข้อมูลสิทธิ์ในระบบ
                    กรุณาเพิ่มสิทธิ์ที่หน้าจัดการสิทธิ์ก่อน
                  </p>
                ) : (
                  Object.keys(permissionGroups).map((groupName) => (
                    <div
                      key={groupName}
                      className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800"
                    >
                      <h4 className="font-bold text-sm text-blue-700 dark:text-blue-400 mb-4 flex items-center gap-2">
                        {getGroupIcon(groupName)}
                        {groupName}
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {permissionGroups[groupName].map((perm: any) => (
                          <label
                            key={perm.id}
                            className={cn(
                              "flex items-center gap-2.5 p-3 px-4 rounded-xl border cursor-pointer transition-all select-none",
                              selectedPermissions.includes(perm.name)
                                ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={selectedPermissions.includes(perm.name)}
                              onChange={() => togglePermission(perm.name)}
                            />
                            {selectedPermissions.includes(perm.name) ? (
                              <CheckCheck className="w-4 h-4" />
                            ) : (
                              <ShieldCheck className="w-4 h-4 opacity-40" />
                            )}
                            <span className="text-sm font-bold">
                              {perm.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="p-8 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="flex-1 h-12 rounded-xl font-bold"
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            form="add-user-form"
            className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-600/30"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "สร้างบัญชีพนักงานใหม่"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
