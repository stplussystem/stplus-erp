"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { toast } from "sonner";
import { Pencil, Save, Loader2, X, ArrowLeft } from "lucide-react";
import { MENU_ICONS } from "@/lib/menu-icons";
import { getToken } from "@/lib/auth-storage";

interface GroupIconDialogProps {
  group: string;
  currentIcon: string;
  onUpdated: () => void;
}

// 🎨 แก้ icon ของ "กลุ่ม" ทั้งกลุ่มในครั้งเดียว — เดิมไม่มี UI ให้แก้ตรงๆ ต้องไปหาว่า permission
// ตัวไหนในกลุ่ม "ชนะ" (ตัวแรกตาม sort_order ที่มี icon) แล้วแก้ทีละตัว เปราะบางมาก
// dialog นี้เรียก PATCH /permissions/group-icon ซึ่ง set icon เดียวกันให้ทุก permission ในกลุ่มไปเลย
export default function GroupIconDialog({
  group,
  currentIcon,
  onUpdated,
}: GroupIconDialogProps) {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState(currentIcon);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const token = getToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    try {
      const res = await fetch(`${apiUrl}/permissions/group-icon`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ group, icon }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("อัปเดต icon ของกลุ่มสำเร็จ");
        onUpdated();
        setOpen(false);
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setIcon(currentIcon);
      }}
    >
      <DialogTrigger asChild>
        <button
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          title={`แก้ไข icon กลุ่ม "${group}"`}
        >
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-950 [&>button.absolute]:hidden">
        <div className="bg-blue-600 px-8 py-6 text-white flex justify-between items-center">
          <div>
            <DialogTitle className="text-lg font-bold text-white">
              แก้ไข icon กลุ่ม
            </DialogTitle>
            <p className="text-blue-100 text-[11px] mt-1">"{group}"</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-3">
          <Label className="font-bold text-slate-700 dark:text-slate-300">
            เลือกไอคอนใหม่ให้กลุ่มนี้
          </Label>
          <AppSelect
            value={icon}
            onValueChange={setIcon}
            placeholder="คลิกเพื่อเลือกไอคอน..."
            triggerClassName="h-12 bg-slate-50 dark:bg-slate-900 focus:ring-blue-500"
            contentClassName="max-h-[300px]"
            options={MENU_ICONS.map((ic) => ({
              value: ic.id,
              label: (
                <div className="flex items-center gap-3">
                  <ic.icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  <span className="font-medium">{ic.label}</span>
                </div>
              ),
            }))}
          />
          <p className="text-xs text-slate-400 pt-1">
            icon นี้จะถูกตั้งให้กับสิทธิ์ทุกตัวในกลุ่มนี้ มีผลกับทุกบริษัทในระบบ
          </p>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>บันทึก</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
