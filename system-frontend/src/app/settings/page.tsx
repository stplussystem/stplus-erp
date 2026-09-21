"use client";

import React, { useState } from "react";
import {
  Bell,
  BellRing,
  Save,
  Loader2,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getToken } from "@/lib/auth-storage";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    web_notification: true,
    line_notify: false,
  });

  const getAuthHeader = () => {
    const token =
      getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("บันทึกการตั้งค่าระบบเรียบร้อยแล้ว");
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
          <Settings2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-md font-bold tracking-tight">
            ตั้งค่าระบบโปรแกรม
          </h1>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            จัดการการทำงานพื้นฐานและการแจ้งเตือนภายในระบบ ST PLUS
          </p>
        </div>
      </div>

      {/* 🚀 2. กล่องเนื้อหาชิดซ้าย และกำหนดความกว้างสูงสุดไว้ที่ 5xl เพื่อไม่ให้ยาวเกินไป (วงสีส้ม) */}
      <div className=" max-w-4xl bg-white dark:bg-slate-900 rounded-3xl p-8 border border-border dark:border-slate-800 shadow-xl space-y-8 max-w-5xl">
        {/* ส่วนที่ 1: การแจ้งเตือน */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b dark:border-slate-800">
            <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
            <h3 className="font-bold text-foreground dark:text-slate-200 text-lg">
              การแจ้งเตือน (Notifications)
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* 💡 แจ้งเตือนผ่านหน้าเว็บ */}
            <div className="flex items-center justify-between p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/50 transition-all hover:shadow-md">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30 shrink-0">
                  <BellRing className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-foreground dark:text-slate-200">
                    แจ้งเตือนผ่านหน้าเว็บ (Web Push)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    แสดงข้อความเด้งเตือนที่มุมจอเมื่อมีความเคลื่อนไหว
                  </p>
                </div>
              </div>
              {/* 🚀 3. แก้ไขปุ่ม Toggle ให้แสดงผลถูกต้อง (วงสีเขียว) */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                <input
                  type="checkbox"
                  checked={settings.web_notification}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      web_notification: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* 💡 แจ้งเตือนผ่าน LINE */}
            <div className="flex items-center justify-between p-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 transition-all hover:shadow-md">
              <div className="flex gap-4 items-center">
                {/* แก้ไขสีพื้นหลังให้เข้มขึ้นเพื่อให้เห็นชัดเจน */}
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
                  <Bell className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-foreground dark:text-slate-200">
                    LINE Notify
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ส่งข้อความแจ้งเตือนเข้ากลุ่ม LINE ของทีมงาน
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                <input
                  type="checkbox"
                  checked={settings.line_notify}
                  onChange={(e) =>
                    setSettings({ ...settings, line_notify: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Telegram Coming Soon */}
            <div className="flex items-center justify-between p-6 bg-muted/50 dark:bg-slate-800/40 rounded-2xl border border-border dark:border-slate-800 opacity-60">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-slate-400 rounded-xl flex items-center justify-center text-white shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-muted-foreground flex items-center gap-2">
                    Telegram Notification{" "}
                    <Badge
                      variant="secondary"
                      className="text-[10px] py-0 bg-muted text-muted-foreground border-none"
                    >
                      COMING SOON
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    บอทแจ้งเตือนผ่าน Telegram (กำลังพัฒนา)
                  </p>
                </div>
              </div>
              <div className="shrink-0 ml-4">
                <div className="w-14 h-7 bg-muted rounded-full flex items-center px-1">
                  <div className="w-5 h-5 bg-white rounded-full shadow-sm"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ส่วนปุ่มกด */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSaveSettings}
            disabled={loading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 rounded-full h-10 px-6 gap-2 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}{" "}
            บันทึกการตั้งค่าทั้งหมด
          </Button>
        </div>
      </div>
    </div>
  );
}
