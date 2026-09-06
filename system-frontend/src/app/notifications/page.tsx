"use client";

import React, { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { AppLoading } from "@/components/ui/app-loading";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  data: { message?: string; type?: string };
  read_at: string | null;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/notifications");
      setNotifications(data || []);
    } catch (error) {
      toast.error("โหลดรายการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const markOneAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: dayjs().toISOString() } : n)),
    );
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "POST" });
    } catch (error) {
      toast.error("ทำเครื่องหมายอ่านแล้วไม่สำเร็จ");
    }
  };

  const markAllAsRead = async () => {
    const toastId = toast.loading("กำลังทำเครื่องหมายอ่านแล้วทั้งหมด...");
    try {
      await apiFetch("/notifications/mark-read", { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || dayjs().toISOString() })),
      );
      toast.success("อ่านแล้วทั้งหมด", { id: toastId });
    } catch (error) {
      toast.error("ทำเครื่องหมายอ่านแล้วไม่สำเร็จ", { id: toastId });
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">การแจ้งเตือน</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              รายการแจ้งเตือนทั้งหมดของคุณ
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <CheckCheck className="w-4 h-4" /> อ่านทั้งหมด
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <AppLoading />
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Bell className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            ยังไม่มีการแจ้งเตือน
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            {notifications.map((n) => {
              const isUnread = !n.read_at;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start justify-between gap-4 px-4 py-3 rounded-xl border border-slate-100",
                    isUnread && "bg-blue-50/40",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {n.data?.message || "-"}
                      </p>
                      {isUnread && (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none shrink-0">
                          ใหม่
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {dayjs(n.created_at).format("DD/MM/YYYY HH:mm")}
                    </p>
                  </div>
                  {isUnread && (
                    <button
                      onClick={() => markOneAsRead(n.id)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer shrink-0"
                      title="ทำเครื่องหมายว่าอ่านแล้ว"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
