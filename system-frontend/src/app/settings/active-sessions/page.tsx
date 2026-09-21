"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MonitorSmartphone, RefreshCw, LogOut, Info } from "lucide-react";
import dayjs from "dayjs";
import { toast } from "sonner";
import Link from "next/link";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { Checkbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { cn } from "@/lib/utils";

interface SessionRow {
  user_id: number;
  name: string;
  username: string | null;
  email: string | null;
  company: { id: number; name: string } | null;
  is_active: boolean;
  is_self: boolean;
  session_count: number;
  forceable_count: number;
  last_activity_at: string | null;
  is_online: boolean;
}

const REFRESH_MS = 15000;

// "3 นาทีที่แล้ว" — token ไม่มีวันหมดอายุ จึงแสดงเวลาใช้งานล่าสุดแบบอ่านง่ายแทนวันหมดอายุ
const timeAgo = (iso: string | null) => {
  if (!iso) return "-";
  const mins = Math.max(0, dayjs().diff(dayjs(iso), "minute"));
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
};

export default function ActiveSessionsPage() {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [onlineMinutes, setOnlineMinutes] = useState(5);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${getToken()}`, Accept: "application/json" }),
    [],
  );

  useEffect(() => {
    try {
      const rawUser = getUserRaw();
      // storage เก็บ payload ทั้งก้อน {user: {...}} ต้อง unwrap .user ก่อนเสมอ (ดู company/register-settings/page.tsx)
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

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const res = await fetch(`${apiUrl}/active-sessions`, { headers: authHeaders() });
        if (res.ok) {
          const result = await res.json();
          setRows(result.data || []);
          setOnlineMinutes(result.online_within_minutes || 5);
          // ตัดรายการที่เลือกไว้แต่ไม่มี session ให้ตัดแล้ว (เช่นถูกตัดไปแล้ว)
          setSelected((prev) => {
            const valid = new Set((result.data as SessionRow[]).filter((r) => r.forceable_count > 0).map((r) => r.user_id));
            return new Set([...prev].filter((id) => valid.has(id)));
          });
        } else if (!silent) {
          toast.error("โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
        }
      } catch {
        if (!silent) toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiUrl, authHeaders],
  );

  useEffect(() => {
    if (!isAuthorized) return;
    fetchData();
    const timer = setInterval(() => fetchData(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [isAuthorized, fetchData]);

  const visibleRows = useMemo(
    () => (filter === "online" ? rows.filter((r) => r.is_online) : rows),
    [rows, filter],
  );
  // แถวที่เลือกได้ = มี session ที่ตัดได้ (session ปัจจุบันของแอดมินเองไม่ถูกนับ)
  const selectableRows = useMemo(() => visibleRows.filter((r) => r.forceable_count > 0), [visibleRows]);
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.user_id));
  const someSelected = selectableRows.some((r) => selected.has(r.user_id));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      selectableRows.forEach((r) => (checked ? next.add(r.user_id) : next.delete(r.user_id)));
      return next;
    });
  };

  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedRows = rows.filter((r) => selected.has(r.user_id));
  const selectedSessions = selectedRows.reduce((sum, r) => sum + r.forceable_count, 0);

  const confirmForceLogout = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/active-sessions/force-logout`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [...selected] }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(result.message || "บังคับออกจากระบบเรียบร้อยแล้ว");
        setConfirmOpen(false);
        setSelected(new Set());
        fetchData(true);
      } else {
        toast.error(result.message || "บังคับออกจากระบบไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthorized || loading) {
    return <AppLoading />;
  }

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <MonitorSmartphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">ผู้ใช้ที่ล็อกอินอยู่</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ดูผู้ใช้ที่มี session ค้างอยู่ และบังคับออกจากระบบก่อนกู้คืนข้อมูล
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} /> รีเฟรช
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={selected.size === 0}
            className="flex justify-center h-10 px-5 py-2 gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-800 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4" /> บังคับออกจากระบบ{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 mb-6 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed space-y-1">
          <p>
            &quot;ออนไลน์&quot; = มีการใช้งานภายใน {onlineMinutes} นาทีล่าสุด (หน้ารายการจะรีเฟรชเองทุก {REFRESH_MS / 1000} วินาที)
            การบังคับออกจากระบบจะตัด session ทุกเครื่องของผู้ใช้ที่เลือก ผู้ใช้ต้องล็อกอินใหม่ และงานที่กรอกค้างไว้ยังไม่บันทึกอาจหายได้
          </p>
          <p>
            session ของคุณที่กำลังใช้หน้านี้จะไม่ถูกตัด — ผู้ใช้ที่ถูกตัดสามารถล็อกอินกลับเข้ามาได้ทันที ควรแจ้งผู้ใช้ให้หยุดใช้งานก่อนกู้คืนข้อมูล{" "}
            <Link href="/settings/backups" className="font-bold underline">
              ไปหน้าสำรองข้อมูล
            </Link>
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full sm:w-56">
            <label className="block text-xs font-medium text-muted-foreground mb-1">แสดง</label>
            <AppSelect
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: "all", label: "ผู้ใช้ที่มี session ทั้งหมด" },
                { value: "online", label: `เฉพาะออนไลน์ (ภายใน ${onlineMinutes} นาที)` },
              ]}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            ทั้งหมด <b className="text-foreground">{rows.length}</b> คน • ออนไลน์{" "}
            <b className="text-green-600">{rows.filter((r) => r.is_online).length}</b> คน
            {selected.size > 0 && (
              <>
                {" "}
                • เลือกไว้ <b className="text-red-600">{selected.size}</b> คน ({selectedSessions} session)
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 w-12">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    disabled={selectableRows.length === 0}
                    aria-label="เลือกทั้งหมด"
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 font-bold">ผู้ใช้</th>
                <th className="px-6 py-4 font-bold">บริษัท</th>
                <th className="px-6 py-4 font-bold text-right">จำนวน session</th>
                <th className="px-6 py-4 font-bold">ใช้งานล่าสุด</th>
                <th className="px-6 py-4 font-bold text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    {filter === "online" ? "ไม่มีผู้ใช้ออนไลน์ในขณะนี้" : "ไม่มีผู้ใช้ที่ล็อกอินค้างอยู่"}
                  </td>
                </tr>
              ) : (
                visibleRows.map((r) => {
                  const selectable = r.forceable_count > 0;
                  return (
                    <tr
                      key={r.user_id}
                      className={cn("hover:bg-muted/50 transition-colors", selected.has(r.user_id) && "bg-red-50/60 dark:bg-red-950/10")}
                    >
                      <td className="px-6 py-4">
                        <Checkbox
                          checked={selected.has(r.user_id)}
                          onCheckedChange={(v) => toggleOne(r.user_id, v === true)}
                          disabled={!selectable}
                          aria-label={`เลือก ${r.name}`}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground flex items-center gap-2">
                          {r.name}
                          {r.is_self && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                              คุณ
                            </span>
                          )}
                          {!r.is_active && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                              ถูกระงับ
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-normal">{r.username || r.email || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{r.company?.name || "-"}</td>
                      <td className="px-6 py-4 text-right text-foreground">
                        {r.session_count}
                        {r.is_self && <div className="text-[11px] text-muted-foreground">(ตัดได้ {r.forceable_count})</div>}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {timeAgo(r.last_activity_at)}
                        {r.last_activity_at && (
                          <div className="text-[11px]">{dayjs(r.last_activity_at).format("DD/MM/YYYY HH:mm")}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            r.is_online
                              ? "bg-green-50 text-green-600 border-green-200"
                              : "bg-muted/50 text-muted-foreground border-border",
                          )}
                        >
                          {r.is_online ? "ออนไลน์" : "ไม่ได้ใช้งาน"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AppConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={LogOut}
        iconColorClass="bg-red-50 text-red-500 border-red-100/50"
        title="ยืนยันการบังคับออกจากระบบ?"
        description={
          <>
            ตัด session ของ <b className="text-foreground">{selected.size} ผู้ใช้</b> ({selectedSessions} session) ผู้ใช้เหล่านี้จะถูกเด้งออกจากระบบและต้องล็อกอินใหม่
            <div className="mt-2 text-xs text-left max-h-28 overflow-y-auto">
              {selectedRows.map((r) => (
                <div key={r.user_id}>• {r.name}</div>
              ))}
            </div>
          </>
        }
        confirmLabel="บังคับออกจากระบบ"
        confirmColorClass="bg-red-600 hover:bg-red-700 shadow-red-600/20"
        onConfirm={confirmForceLogout}
        loading={submitting}
      />
    </div>
  );
}
