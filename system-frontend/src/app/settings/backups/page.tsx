"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DatabaseBackup,
  Download,
  RotateCcw,
  Trash2,
  Save,
  Loader2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  HardDrive,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import dayjs from "dayjs";
import Link from "next/link";
import { toast } from "sonner";
import { getToken, getUserRaw, clearSession } from "@/lib/auth-storage";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { cn } from "@/lib/utils";

interface BackupTarget {
  key: string;
  label: string;
  path: string;
  available: boolean;
  free_bytes: number | null;
  total_bytes: number | null;
  same_disk_as_local: boolean;
  is_primary: boolean;
  is_secondary: boolean;
}

interface BackupItem {
  file_name: string;
  location: string;
  size: number;
  type: "manual" | "auto" | "prerestore";
  created_at: string;
  created_by: { id: number | null; name: string } | null;
  total_rows: number | null;
  file_count: number | null;
  table_count: number | null;
}

interface BackupSettings {
  enabled: boolean;
  frequency: "daily" | "weekly";
  time: string;
  weekday: number;
  keep: number;
  last_auto_run: string | null;
  last_auto_status: "success" | "failed" | null;
  last_auto_message: string | null;
  primary: string;
  secondary: string | null;
}

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  manual: { label: "ด้วยมือ", className: "bg-blue-50 text-blue-600 border-blue-200" },
  auto: { label: "อัตโนมัติ", className: "bg-green-50 text-green-600 border-green-200" },
  prerestore: { label: "ก่อนกู้คืน", className: "bg-amber-50 text-amber-600 border-amber-200" },
};

const WEEKDAYS = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];

const CONFIRM_TEXT = "กู้คืนข้อมูล";
const RESTORE_TIMEOUT_MS = 10 * 60 * 1000;

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatGB = (bytes: number | null) => (bytes == null ? "-" : `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`);

export default function BackupsPage() {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [form, setForm] = useState({ enabled: false, frequency: "daily", time: "02:00", weekday: "0", keep: "7" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [creating, setCreating] = useState(false);

  // ปลายทางการสำรอง (ในเครื่อง / ที่เก็บภายนอก 1-2) + ปลายทางที่กำลังดูรายการไฟล์อยู่
  const [targets, setTargets] = useState<BackupTarget[]>([]);
  const [viewLocation, setViewLocation] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const [destForm, setDestForm] = useState({ primary: "local", secondary: "none" });
  const [savingDest, setSavingDest] = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BackupItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const applySettings = (s: BackupSettings) => {
    setSettings(s);
    setForm({
      enabled: s.enabled,
      frequency: s.frequency,
      time: s.time,
      weekday: String(s.weekday),
      keep: String(s.keep),
    });
  };

  const fetchData = useCallback(
    async (location?: string) => {
    try {
      const query = location ? `?location=${location}` : "";
      const res = await fetch(`${apiUrl}/backups${query}`, { headers: authHeaders() });
      if (res.ok) {
        const result = await res.json();
        setBackups(result.data || []);
        setTargets(result.targets || []);
        setListError(result.list_error || null);
        setViewLocation(result.location || "local");
        applySettings(result.settings);
        setDestForm({ primary: result.settings.primary || "local", secondary: result.settings.secondary || "none" });
      } else {
        toast.error("โหลดข้อมูลสำรองไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
    },
    [apiUrl, authHeaders],
  );

  useEffect(() => {
    if (isAuthorized) fetchData();
  }, [isAuthorized, fetchData]);

  const refreshList = () => fetchData(viewLocation);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    const toastId = toast.loading("กำลังสำรองข้อมูล...");
    try {
      const res = await fetch(`${apiUrl}/backups`, { method: "POST", headers: authHeaders() });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        if (result.copy_failed) toast.warning(result.message, { id: toastId, duration: 10000 });
        else toast.success("สำรองข้อมูลสำเร็จ", { id: toastId });
        fetchData(viewLocation);
      } else {
        toast.error(result.message || "สำรองข้อมูลไม่สำเร็จ", { id: toastId });
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`${apiUrl}/backups/settings`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          frequency: form.frequency,
          time: form.time,
          weekday: Number(form.weekday),
          keep: Number(form.keep),
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        applySettings(result.data);
        toast.success("บันทึกการตั้งค่าสำรองอัตโนมัติแล้ว");
      } else {
        const firstError = result.errors ? (Object.values(result.errors)[0] as string[])?.[0] : null;
        toast.error(firstError || result.message || "บันทึกไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestTarget = async (key: string) => {
    setTestingKey(key);
    try {
      const res = await fetch(`${apiUrl}/backups/targets/${key}/test`, { method: "POST", headers: authHeaders() });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(result.message || "ปลายทางนี้ใช้งานได้");
        fetchData(viewLocation);
      } else {
        toast.error(result.message || "ทดสอบเขียนไฟล์ไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setTestingKey(null);
    }
  };

  const handleSaveDestination = async () => {
    setSavingDest(true);
    try {
      const res = await fetch(`${apiUrl}/backups/destination`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          primary: destForm.primary,
          secondary: destForm.secondary === "none" ? null : destForm.secondary,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(result.message || "บันทึกปลายทางแล้ว");
        // ปลายทางหลักเปลี่ยน → แสดงรายการไฟล์ของปลายทางใหม่
        fetchData(destForm.primary);
      } else {
        const firstError = result.errors ? (Object.values(result.errors)[0] as string[])?.[0] : null;
        toast.error(firstError || result.message || "บันทึกปลายทางไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSavingDest(false);
    }
  };

  const availableTargets = targets.filter((t) => t.available);
  const targetLabel = (key: string) => targets.find((t) => t.key === key)?.label || key;

  const handleDownload = async (item: BackupItem) => {
    const toastId = toast.loading("กำลังเตรียมไฟล์...");
    try {
      const res = await fetch(`${apiUrl}/backups/${item.file_name}/download?location=${item.location}`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("ดาวน์โหลดเรียบร้อย", { id: toastId });
    } catch {
      toast.error("ดาวน์โหลดไม่สำเร็จ", { id: toastId });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiUrl}/backups/${deleteTarget.file_name}?location=${deleteTarget.location}`, { method: "DELETE", headers: authHeaders() });
      if (res.ok) {
        toast.success("ลบไฟล์สำรองเรียบร้อยแล้ว");
        setDeleteTarget(null);
        fetchData(viewLocation);
      } else {
        toast.error("ลบไฟล์ไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setDeleting(false);
    }
  };

  // ระหว่างกู้คืนตาราง token/ผู้ใช้ถูกแทนที่ → request ที่ล็อกอินอาจ error ชั่วคราว จึง poll endpoint สาธารณะ
  // /backups/restore-status และถือว่า "ยังไม่เสร็จ" ทุกครั้งที่ตอบไม่ใช่ 200 จนกว่าจะได้ done/failed หรือหมดเวลา
  const startPollingRestore = () => {
    const startedAt = Date.now();
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      if (Date.now() - startedAt > RESTORE_TIMEOUT_MS) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setRestoring(false);
        toast.error("การกู้คืนใช้เวลานานผิดปกติ กรุณาตรวจสอบสถานะที่เซิร์ฟเวอร์");
        return;
      }
      try {
        const res = await fetch(`${apiUrl}/backups/restore-status`, { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const { state } = await res.json();
        if (state === "done") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          toast.success("กู้คืนข้อมูลสำเร็จ กรุณาเข้าสู่ระบบใหม่");
          clearSession();
          window.location.href = "/login";
        } else if (state === "failed") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setRestoring(false);
          toast.error("กู้คืนข้อมูลไม่สำเร็จ ระบบเก็บข้อมูลก่อนกู้คืนไว้ให้แล้ว");
          fetchData(viewLocation);
        }
      } catch {
        // เซิร์ฟเวอร์อาจไม่ตอบชั่วคราวระหว่างกู้คืน — poll ต่อ
      }
    }, 2000);
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    if (restoreConfirmText.trim() !== CONFIRM_TEXT) {
      toast.error(`กรุณาพิมพ์ "${CONFIRM_TEXT}" เพื่อยืนยัน`);
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/backups/${restoreTarget.file_name}/restore`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_text: restoreConfirmText.trim(), location: restoreTarget.location }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 202) {
        setRestoreTarget(null);
        setRestoreConfirmText("");
        setRestoring(true);
        startPollingRestore();
      } else {
        toast.error(result.message || "เริ่มกู้คืนไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
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
            <DatabaseBackup className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">สำรองข้อมูล</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              สำรอง/กู้คืนฐานข้อมูลและไฟล์อัปโหลดของทั้งระบบ พร้อมตั้งสำรองอัตโนมัติ
            </p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || restoring}
          className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
          สำรองข้อมูลตอนนี้
        </button>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 mb-6 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
          <p>
            <b>ไฟล์สำรองมีข้อมูลของทุกบริษัทในระบบ</b> (รวมรหัสผ่านที่เข้ารหัสแล้วของผู้ใช้ทั้งหมด) จึงเปิดให้เฉพาะ Platform
            Admin เท่านั้น เก็บไฟล์ที่ดาวน์โหลดไว้ในที่ปลอดภัย
          </p>
          <p>
            ไฟล์สำรองถูกเก็บไว้ในเครื่องเดียวกับฐานข้อมูล ไม่ช่วยกรณีดิสก์เสีย — ควรดาวน์โหลดไปเก็บไว้ที่อื่นเป็นระยะ
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <HardDrive className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold">ปลายทางการสำรองข้อมูล</h2>
        </div>

        <div className="space-y-2 mb-5">
          {targets.map((t) => (
            <div
              key={t.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  {t.available ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  {t.label}
                  {t.is_primary && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                      ปลายทางหลัก
                    </span>
                  )}
                  {t.is_secondary && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200">
                      สำเนาที่สอง
                    </span>
                  )}
                  {t.same_disk_as_local && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      ดิสก์เดียวกับระบบ — ไม่กันดิสก์เสีย
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
                  {t.path}
                  {t.available
                    ? ` • ว่าง ${formatGB(t.free_bytes)} จาก ${formatGB(t.total_bytes)}`
                    : " • ยังไม่ได้เมาต์ หรือเขียนไฟล์ไม่ได้"}
                </div>
              </div>
              <button
                onClick={() => handleTestTarget(t.key)}
                disabled={!t.available || testingKey === t.key}
                className="h-9 px-4 rounded-full border border-border text-foreground bg-background hover:bg-muted text-xs font-medium flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingKey === t.key && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                ทดสอบเขียนไฟล์
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">ปลายทางหลัก</label>
            <AppSelect
              value={destForm.primary}
              onValueChange={(v) => setDestForm((f) => ({ ...f, primary: v, secondary: f.secondary === v ? "none" : f.secondary }))}
              options={availableTargets.map((t) => ({ value: t.key, label: t.label }))}
            />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">สำเนาที่สอง (คัดลอกทุกครั้งที่สำรอง)</label>
            <AppSelect
              value={destForm.secondary}
              onValueChange={(v) => setDestForm((f) => ({ ...f, secondary: v }))}
              options={[
                { value: "none", label: "ไม่ทำสำเนา" },
                ...availableTargets.filter((t) => t.key !== destForm.primary).map((t) => ({ value: t.key, label: t.label })),
              ]}
            />
          </div>
          <button
            onClick={handleSaveDestination}
            disabled={
              savingDest ||
              (destForm.primary === (settings?.primary || "local") &&
                destForm.secondary === (settings?.secondary || "none"))
            }
            className="flex justify-center h-10 px-5 gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all disabled:opacity-50"
          >
            {savingDest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกปลายทาง
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          ที่เก็บภายนอกคือไดรฟ์อื่น/NAS ที่เมาต์เข้าระบบไว้ (ตั้งเส้นทางจริงด้วย BACKUP_HOST_DIR_1 / BACKUP_HOST_DIR_2 ในไฟล์ .env ข้าง
          docker-compose.yml แล้วรัน docker compose up -d) — เมื่อเปลี่ยนปลายทาง ไฟล์เก่ายังอยู่ที่เดิม เลือกดูได้ที่ &quot;แสดงไฟล์จาก&quot; ด้านล่าง
        </p>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold">สำรองข้อมูลอัตโนมัติ</h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 h-10">
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            <span className="text-sm">{form.enabled ? "เปิดใช้งาน" : "ปิดอยู่"}</span>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">ความถี่</label>
            <AppSelect
              value={form.frequency}
              onValueChange={(v) => setForm({ ...form, frequency: v })}
              options={[
                { value: "daily", label: "ทุกวัน" },
                { value: "weekly", label: "ทุกสัปดาห์" },
              ]}
            />
          </div>
          {form.frequency === "weekly" && (
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่สำรอง</label>
              <AppSelect
                value={form.weekday}
                onValueChange={(v) => setForm({ ...form, weekday: v })}
                options={WEEKDAYS.map((label, i) => ({ value: String(i), label }))}
              />
            </div>
          )}
          <div className="w-32">
            <label className="block text-xs font-medium text-muted-foreground mb-1">เวลา (เวลาไทย)</label>
            <Input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="h-10 bg-background border-border rounded-xl text-sm"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1">เก็บไฟล์อัตโนมัติย้อนหลัง</label>
            <Input
              type="number"
              min={1}
              max={60}
              value={form.keep}
              onChange={(e) => setForm({ ...form, keep: e.target.value })}
              className="h-10 bg-background border-border rounded-xl text-sm"
            />
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="flex justify-center h-10 px-5 gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all disabled:opacity-50"
          >
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกการตั้งค่า
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          ระบบลบเฉพาะไฟล์ &quot;อัตโนมัติ&quot; ที่เก่าเกินจำนวนที่ตั้งไว้ ไฟล์ที่สำรองด้วยมือและไฟล์ก่อนกู้คืนจะไม่ถูกลบเอง
        </p>
        {settings?.last_auto_run && (
          <p
            className={cn(
              "text-[11px] mt-1",
              settings.last_auto_status === "failed" ? "text-red-600" : "text-muted-foreground",
            )}
          >
            รอบล่าสุด: {dayjs(settings.last_auto_run).format("DD/MM/YYYY HH:mm")}
            {settings.last_auto_message ? ` — ${settings.last_auto_message}` : ""}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div className="w-full sm:w-64">
          <label className="block text-xs font-medium text-muted-foreground mb-1">แสดงไฟล์จาก</label>
          <AppSelect
            value={viewLocation || "local"}
            onValueChange={(v) => fetchData(v)}
            options={availableTargets.map((t) => ({
              value: t.key,
              label: t.label + (t.is_primary ? " (ปลายทางหลัก)" : ""),
            }))}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          กำลังดูไฟล์ใน: <b className="text-foreground">{targetLabel(viewLocation || "local")}</b>
        </p>
      </div>

      {listError && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs px-4 py-3">{listError}</div>
      )}

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold">วันที่สำรอง</th>
                <th className="px-6 py-4 font-bold">ประเภท</th>
                <th className="px-6 py-4 font-bold">ผู้สั่ง</th>
                <th className="px-6 py-4 font-bold text-right">ขนาด</th>
                <th className="px-6 py-4 font-bold text-right">แถวข้อมูล</th>
                <th className="px-6 py-4 font-bold text-right">ไฟล์อัปโหลด</th>
                <th className="px-6 py-4 font-bold text-right w-[140px]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    ยังไม่มีไฟล์สำรอง กรุณากด &quot;สำรองข้อมูลตอนนี้&quot;
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.file_name} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">
                      {dayjs(b.created_at).format("DD/MM/YYYY HH:mm")}
                      <div className="text-[11px] text-muted-foreground font-normal">{b.file_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold border",
                          TYPE_LABEL[b.type]?.className || "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {TYPE_LABEL[b.type]?.label || b.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{b.created_by?.name || "-"}</td>
                    <td className="px-6 py-4 text-right text-foreground">{formatSize(b.size)}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {b.total_rows != null ? b.total_rows.toLocaleString() : "-"}
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {b.file_count != null ? b.file_count.toLocaleString() : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <AppTooltip label="ดาวน์โหลด">
                          <button
                            onClick={() => handleDownload(b)}
                            className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer transition-all"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </AppTooltip>
                        <AppTooltip label="กู้คืนข้อมูลจากไฟล์นี้">
                          <button
                            onClick={() => {
                              setRestoreConfirmText("");
                              setRestoreTarget(b);
                            }}
                            disabled={restoring}
                            className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-xl cursor-pointer transition-all disabled:opacity-50"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </AppTooltip>
                        <AppTooltip label="ลบ">
                          <button
                            onClick={() => setDeleteTarget(b)}
                            className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </AppTooltip>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AppConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        icon={Trash2}
        iconColorClass="bg-red-50 text-red-500 border-red-100/50"
        title="ยืนยันการลบไฟล์สำรอง?"
        description={
          <>
            ลบไฟล์ <span className="font-bold text-foreground">{deleteTarget?.file_name}</span> ออกจากเซิร์ฟเวอร์
            เมื่อลบแล้วจะไม่สามารถกู้คืนไฟล์นี้ได้
          </>
        }
        confirmLabel="ยืนยันการลบ"
        confirmColorClass="bg-red-600 hover:bg-red-700 shadow-red-600/20"
        onConfirm={confirmDelete}
        loading={deleting}
      />

      <AppConfirmDialog
        open={!!restoreTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRestoreTarget(null);
            setRestoreConfirmText("");
          }
        }}
        icon={AlertTriangle}
        iconColorClass="bg-amber-50 text-amber-500 border-amber-100/50"
        title="ยืนยันการกู้คืนข้อมูล?"
        description={
          <>
            ข้อมูล<b>ทุกบริษัทในระบบ</b>จะถูกแทนที่ด้วยข้อมูลจากไฟล์{" "}
            <span className="font-bold text-foreground">{restoreTarget?.file_name}</span> ผู้ใช้ทุกคนจะต้องเข้าสู่ระบบใหม่
            ระบบจะสำรองข้อมูลปัจจุบันไว้ให้ก่อนอัตโนมัติ (ประเภท &quot;ก่อนกู้คืน&quot;) ควรทำตอนไม่มีผู้ใช้งาน
          </>
        }
        confirmLabel="กู้คืนข้อมูล"
        confirmColorClass="bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
        onConfirm={confirmRestore}
      >
        <p className="text-xs text-muted-foreground mb-3">
          ยังมีผู้ใช้ล็อกอินอยู่?{" "}
          <Link href="/settings/active-sessions" className="text-blue-600 font-bold underline">
            ดูและบังคับออกจากระบบก่อน
          </Link>
        </p>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          พิมพ์ &quot;{CONFIRM_TEXT}&quot; เพื่อยืนยัน
        </label>
        <Input
          value={restoreConfirmText}
          onChange={(e) => setRestoreConfirmText(e.target.value)}
          placeholder={CONFIRM_TEXT}
          className="h-10 rounded-xl text-sm"
        />
      </AppConfirmDialog>

      {restoring && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm text-white gap-4">
          <Loader2 className="w-10 h-10 animate-spin" />
          <div className="text-lg font-bold">กำลังกู้คืนข้อมูล...</div>
          <div className="text-sm text-white/80">กรุณาอย่าปิดหรือรีเฟรชหน้านี้ เสร็จแล้วระบบจะพาไปหน้าเข้าสู่ระบบ</div>
        </div>
      )}
    </div>
  );
}
