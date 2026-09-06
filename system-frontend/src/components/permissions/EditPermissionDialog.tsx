"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppSelect } from "@/components/ui/app-select";
import { GroupComboboxField } from "./GroupComboboxField";
import { toast } from "sonner";
import { Edit2, Loader2, Save, X, MenuSquare, ShieldCheck, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { MENU_ICONS as AVAILABLE_ICONS } from "@/lib/menu-icons";

interface EditPermissionDialogProps {
  permission: any;
  onUpdated: () => void;
}

export default function EditPermissionDialog({
  permission,
  onUpdated,
}: EditPermissionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingGroups, setExistingGroups] = useState<string[]>([]);
  const [existingSubGroups, setExistingSubGroups] = useState<string[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const userStr =
      getUserRaw();
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setIsPlatformAdmin(
          userData?.is_platform_admin === 1 ||
            userData?.is_platform_admin === true ||
            userData?.user?.is_platform_admin === 1 ||
            userData?.user?.is_platform_admin === true,
        );
      } catch (e) {}
    }
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    title_th: "",
    group: "",
    sub_group: "",
    is_menu: false,
    icon: "FolderKey",
    path: "",
    sort_order: "0",
  });

  const loadMasterSuggestions = async () => {
    const token =
      getToken();
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    try {
      const res = await fetch(`${apiUrl}/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const groups = Object.keys(data);
        setExistingGroups(groups);

        const subSet = new Set<string>();
        groups.forEach((g) => {
          if (Array.isArray(data[g])) {
            data[g].forEach((p: any) => {
              if (p.sub_group) subSet.add(p.sub_group);
            });
          }
        });
        setExistingSubGroups(Array.from(subSet));
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (open && permission) {
      setFormData({
        name: permission.name || "",
        title_th: permission.title_th || "",
        group: permission.group || "",
        sub_group: permission.sub_group || "",
        is_menu: permission.is_menu === 1 || permission.is_menu === true,
        icon: permission.icon || "FolderKey",
        path: permission.path || "",
        sort_order: permission.sort_order?.toString() || "0",
      });
      setErrors({});
      loadMasterSuggestions();
    }
  }, [open, permission]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "กรุณาระบุรหัสสิทธิ์";
    if (!formData.group.trim()) newErrors.group = "กรุณาระบุหรือเลือกหมวดหมู่หลัก";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const token =
      getToken();
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    try {
      const res = await fetch(`${apiUrl}/permissions/${permission.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          is_menu: formData.is_menu ? 1 : 0,
          sort_order: Number(formData.sort_order) || 0,
          sub_group:
            formData.sub_group.trim() !== "" ? formData.sub_group : "ทั่วไป",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("อัปเดตสิทธิ์การใช้งานเรียบร้อย");
        onUpdated();
        setOpen(false);
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (error) {
      toast.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer">
          <Edit2 className="w-4 h-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl p-0 border-none shadow-2xl [&>button.absolute]:hidden bg-white dark:bg-slate-950 flex flex-col">
        <div className="bg-amber-500 px-8 py-6 text-white flex justify-between items-center z-20 shrink-0">
          <div>
            <DialogTitle className="text-lg font-bold flex items-center gap-3 text-white">
              <Edit2 className="w-6 h-6" /> แก้ไขข้อมูลสิทธิ์ (Permission)
            </DialogTitle>
            <p className="text-amber-100 text-[11px] mt-1">
              ปรับปรุงรหัส ชื่อ และการตั้งค่าเมนู
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-black/10 rounded-full transition-colors cursor-pointer text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-8 custom-scrollbar">
          <form
            id="edit-permission-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="font-bold text-slate-700 dark:text-slate-300">
                  รหัสสิทธิ์ <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="เช่น view_reports"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  readOnly={!isPlatformAdmin}
                  aria-invalid={!!errors.name}
                  className={cn(
                    "h-12 rounded-xl focus:ring-amber-500",
                    !isPlatformAdmin
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-inner"
                      : errors.name
                        ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-slate-50 dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-900 border-amber-200",
                  )}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs font-medium mt-1">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="font-bold text-slate-700 dark:text-slate-300">
                  ชื่อแสดงผล (ภาษาไทย)
                </Label>
                <Input
                  placeholder="เช่น ดูรายงานยอดขาย"
                  value={formData.title_th}
                  onChange={(e) =>
                    setFormData({ ...formData, title_th: e.target.value })
                  }
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-amber-500"
                />
              </div>

              {/* 🔀 หมวดหมู่หลัก — combobox เลือกของเดิม/พิมพ์สร้างใหม่ (เหมือนหมวดหมู่สินค้าใน products/create) */}
              <div className="space-y-3">
                <Label className="font-bold text-slate-700 dark:text-slate-300">
                  หมวดหมู่หลัก (Main Group){" "}
                  <span className="text-red-500">*</span>
                </Label>
                <GroupComboboxField
                  value={formData.group}
                  onChange={(v) => {
                    setFormData({ ...formData, group: v });
                    setErrors((prev) => ({ ...prev, group: "" }));
                  }}
                  options={existingGroups}
                  placeholder="เช่น เอกสารขาย, รายงาน"
                  error={!!errors.group}
                  accentColor="amber"
                />
                {errors.group && (
                  <p className="text-red-500 text-xs font-medium mt-1">
                    {errors.group}
                  </p>
                )}
              </div>

              {/* 🔀 กลุ่มย่อย — combobox เลือกของเดิม/พิมพ์สร้างใหม่ */}
              <div className="space-y-3">
                <Label className="font-bold text-slate-700 dark:text-slate-300">
                  กลุ่มย่อย (Sub Group)
                </Label>
                <GroupComboboxField
                  value={formData.sub_group}
                  onChange={(v) => setFormData({ ...formData, sub_group: v })}
                  options={existingSubGroups}
                  placeholder="เช่น ทั่วไป, แท็บ"
                  accentColor="amber"
                />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      formData.is_menu
                        ? "bg-amber-100 text-amber-600"
                        : "bg-slate-200 text-slate-500",
                    )}
                  >
                    <MenuSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">
                      นำไปแสดงเป็นเมนูหลัก (Sidebar Menu)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      เปิดสวิตช์นี้
                      หากต้องการให้สิทธิ์นี้โชว์เป็นปุ่มกดที่เมนูด้านซ้าย
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.is_menu}
                  onCheckedChange={(val) =>
                    setFormData({ ...formData, is_menu: val })
                  }
                />
              </div>
            </div>

            {formData.is_menu && (
              <div className="p-6 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30 space-y-5 animate-in fade-in slide-in-from-top-4">
                <div className="space-y-3">
                  <Label className="font-bold text-slate-700 dark:text-slate-300">
                    เลือกไอคอน (Icon)
                  </Label>
                  <AppSelect
                    value={formData.icon}
                    onValueChange={(val) =>
                      setFormData({ ...formData, icon: val })
                    }
                    placeholder="คลิกเพื่อเลือกไอคอน..."
                    triggerClassName="h-12 bg-white dark:bg-slate-900 focus:ring-amber-500 border-amber-200"
                    contentClassName="max-h-[300px]"
                    options={AVAILABLE_ICONS.map((ic) => ({
                      value: ic.id,
                      label: (
                        <div className="flex items-center gap-3">
                          <ic.icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                          <span className="font-medium">{ic.label}</span>
                        </div>
                      ),
                    }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2 space-y-3">
                    <Label className="font-bold text-slate-700 dark:text-slate-300">
                      ลิงก์ปลายทาง (Path)
                    </Label>
                    <Input
                      placeholder="เช่น /reports/sales"
                      value={formData.path}
                      onChange={(e) =>
                        setFormData({ ...formData, path: e.target.value })
                      }
                      className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:ring-amber-500 border-amber-200"
                    />
                  </div>
                  <div className="col-span-1 space-y-3">
                    <Label className="font-bold text-slate-700 dark:text-slate-300">
                      ลำดับ (Sort)
                    </Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.sort_order}
                      onChange={(e) =>
                        setFormData({ ...formData, sort_order: e.target.value })
                      }
                      className="h-12 rounded-xl bg-white dark:bg-slate-900 text-center focus:ring-amber-500 border-amber-200"
                    />
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex justify-center gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ยกเลิก
          </Button>
          <Button
            type="submit"
            form="edit-permission-form"
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>อัปเดตข้อมูล</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
