"use client";

import React, { useState } from "react";
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
import { Plus, ShieldPlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AddPermissionDialog({
  onAdded,
}: {
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", group: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem("stplus_token");
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    try {
      const res = await fetch(`${apiUrl}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json", // 💡 สิ่งที่ขาดไป! ต้องบอก Laravel ให้ตอบกลับเป็น JSON เสมอ
        },
        body: JSON.stringify(formData),
      });

      // 💡 เช็คก่อนว่า Backend ส่ง JSON กลับมาจริงไหม
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();

        if (res.ok) {
          toast.success("สร้างสิทธิ์ใหม่เรียบร้อย");
          setFormData({ name: "", group: "" });
          setOpen(false);
          onAdded(); // รีเฟรชหน้าจัดการสิทธิ์
        } else {
          // ถ้ากรอกชื่อซ้ำ จะแจ้งเตือนที่นี่ครับ
          toast.error(data.message || "ข้อมูลไม่ถูกต้อง");
          console.error("Validation Errors:", data.errors);
        }
      } else {
        // ถ้าเซิร์ฟเวอร์พัง จะพ่น HTML ออกมาทาง Console ให้เราเห็นครับ
        const htmlText = await res.text();
        console.error("🚨 Backend Error:", htmlText);
        toast.error("ระบบขัดข้อง กรุณาเช็ค Console (F12)");
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      toast.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 rounded-xl px-6 py-2.5 font-bold flex items-center gap-2 transition-all active:scale-95">
          <Plus className="w-5 h-5" /> เพิ่มสิทธิ์ใหม่
        </button>
      </DialogTrigger>

      {/* 💡 ซ่อนปุ่ม X ดำ และทำขอบโค้งมน */}
      <DialogContent className="sm:max-w-[550px] p-0 rounded-3xl overflow-hidden border-none shadow-2xl [&>button.absolute]:hidden">
        {/* 💡 Header สีน้ำเงินสไตล์เดียวกับหน้า Add User */}
        <div className="bg-blue-600 p-6 md:p-8 text-white flex justify-between items-center">
          <div>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <ShieldPlus className="w-7 h-7" /> สร้างกุญแจสิทธิ์ใหม่
            </DialogTitle>
            <p className="text-blue-100 text-sm mt-1">
              กำหนดกลุ่มและชื่อสิทธิ์สำหรับใช้ในระบบ
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 md:p-8 bg-white dark:bg-slate-950">
          <form
            id="add-permission-form"
            onSubmit={handleSubmit}
            className="space-y-6"
            autoComplete="off"
          >
            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">
                  ชื่อกลุ่ม (Group)
                </Label>
                <Input
                  placeholder="เช่น 📦 คลังสินค้า"
                  required
                  value={formData.group}
                  onChange={(e) =>
                    setFormData({ ...formData, group: e.target.value })
                  }
                  className="rounded-xl h-11"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">
                  ชื่อสิทธิ์ (System Name - ภาษาอังกฤษ)
                </Label>
                <Input
                  placeholder="เช่น inventory_view"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="rounded-xl h-11"
                  autoComplete="off"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  แนะนำ: ใช้ตัวพิมพ์เล็กและห้ามเว้นวรรค (ใช้ _ แทนการเว้นวรรค)
                </p>
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex gap-3">
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
            form="add-permission-form"
            disabled={loading}
            className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-600/30"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              "บันทึกสิทธิ์"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
