"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  FolderKey,
  Trash2,
  AlertTriangle,
  Loader2,
  ListTree,
  Move,
} from "lucide-react";
import { toast } from "sonner";
import AddPermissionDialog from "@/components/permissions/AddPermissionDialog";
import EditPermissionDialog from "@/components/permissions/EditPermissionDialog";
import GroupIconDialog from "@/components/permissions/GroupIconDialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  getToken,
  getUserRaw,
  getPermissionsLayoutMode,
  setPermissionsLayoutMode,
  getPermissionsGroupPositions,
  setPermissionsGroupPositions,
} from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { MENU_ICON_MAP } from "@/lib/menu-icons";

// 🎨 icon ของกลุ่มที่แสดงตรงนี้ต้องตรงกับของจริงที่ AppLayout ใช้ในเมนู sidebar/topbar เสมอ —
// mirror logic เดียวกับ UserSessionFormatter::format() ฝั่ง backend (หยิบ icon ของ permission
// ตัวแรกในกลุ่มที่มี icon ไม่ว่าง) แทนการเดาจาก substring ชื่อกลุ่มแบบเดิมที่ไม่ตรงของจริงเลย
const getGroupIconName = (permsInGroup: any[]) =>
  permsInGroup.find((p) => p.icon)?.icon || "FolderKey";

const GroupIcon = ({ iconName }: { iconName: string }) => {
  const IconComp = MENU_ICON_MAP[iconName] || FolderKey;
  return <IconComp className="w-5 h-5 text-blue-600" />;
};

const CARD_WIDTH = 380;
const CARD_HEIGHT_ESTIMATE = 320;
const CARD_GAP = 24;

export default function PermissionsPage() {
  const [permissionGroups, setPermissionGroups] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [colCount, setColCount] = useState(3);
  const [isMounted, setIsMounted] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [savingAutoSync, setSavingAutoSync] = useState(false);

  // 🧲 เรียงอิสระ (ลากกล่องแต่ละหมวดจัดตำแหน่งเอง) ↔ เรียงตามลำดับหมายเลขแบบเดิม — เก็บ preference
  // นี้ per-browser ผ่าน auth-storage.ts (pattern เดียวกับ layoutMode/miniSidebar)
  const [freeLayoutMode, setFreeLayoutMode] = useState<"default" | "free">("default");
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const dragState = useRef<{
    group: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const authHeaders = () => {
    const token =
      getToken();
    return { Accept: "application/json", Authorization: `Bearer ${token}` };
  };
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

  const fetchAutoSyncSetting = async () => {
    const res = await fetch(`${apiUrl}/settings/auto-sync-permissions`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      setAutoSyncEnabled(!!data.auto_sync_new_permissions_to_all_companies);
    }
  };

  const toggleAutoSync = async (checked: boolean) => {
    setSavingAutoSync(true);
    try {
      const res = await fetch(`${apiUrl}/settings/auto-sync-permissions`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) throw new Error();
      setAutoSyncEnabled(checked);
      toast.success(
        checked
          ? "เปิด auto-sync สิทธิ์ใหม่ให้ทุกบริษัทแล้ว"
          : "ปิด auto-sync แล้ว บริษัทอื่นจะไม่ได้สิทธิ์ใหม่อัตโนมัติ",
      );
    } catch {
      toast.error("บันทึกการตั้งค่าไม่สำเร็จ");
    } finally {
      setSavingAutoSync(false);
    }
  };

  const fetchPermissions = async () => {
    setLoading(true);
    const token =
      getToken();
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    try {
      const res = await fetch(`${apiUrl}/permissions`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPermissionGroups(data);
      } else {
        toast.error("โหลดรายการสิทธิ์ไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
    setIsMounted(true);
    setFreeLayoutMode(getPermissionsLayoutMode());
    setPositions(getPermissionsGroupPositions());
    const updateCols = () => {
      if (window.innerWidth >= 1024) setColCount(3);
      else if (window.innerWidth >= 768) setColCount(2);
      else setColCount(1);
    };
    updateCols();
    window.addEventListener("resize", updateCols);

    try {
      const rawUser =
        getUserRaw();
      const user = rawUser ? JSON.parse(rawUser) : null;
      if (user?.is_platform_admin) {
        setIsPlatformAdmin(true);
        fetchAutoSyncSetting();
      }
    } catch {}

    return () => window.removeEventListener("resize", updateCols);
  }, []);

  const proceedDelete = async () => {
    if (!permissionToDelete) return;
    setIsDeleting(true);

    const token =
      getToken();
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    try {
      const res = await fetch(
        `${apiUrl}/permissions/${permissionToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "ลบสิทธิ์การใช้งานสำเร็จ");
        fetchPermissions();
        setPermissionToDelete(null);
      } else {
        toast.error(data.message || "ไม่สามารถลบได้");
      }
    } catch (error: any) {
      toast.error(`เกิดข้อผิดพลาดในการลบข้อมูล: ${error.message || error}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // 🗑️ ลบ permission ทุกตัวในกลุ่มพร้อมกันในคลิกเดียว — backend เช็ค all-or-nothing ให้แล้ว (บล็อกทั้งกลุ่ม
  // ถ้ามี permission ตัวใดตัวหนึ่งยังถูกมอบให้ role อยู่จริง) ฝั่งนี้แค่โชว์ error message จาก backend ตรงๆ
  const proceedDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);

    const token = getToken();
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    try {
      const res = await fetch(
        `${apiUrl}/permissions/group/${encodeURIComponent(groupToDelete)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "ลบกลุ่มสำเร็จ");
        fetchPermissions();
        setGroupToDelete(null);
      } else {
        toast.error(data.message || "ไม่สามารถลบกลุ่มนี้ได้");
      }
    } catch (error: any) {
      toast.error(`เกิดข้อผิดพลาดในการลบข้อมูล: ${error.message || error}`);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // 🔀 สลับโหมด "เรียงอิสระ" — ครั้งแรกที่เปิดโหมดนี้ (กลุ่มไหนยังไม่เคยมีตำแหน่งบันทึกไว้) คำนวณตำแหน่ง
  // เริ่มต้นจาก layout grid ปัจจุบัน (คอลัมน์/แถวเดิม) ไม่ให้การ์ดกระโดดไปกองที่ (0,0) พร้อมกันหมด
  const toggleFreeLayout = (checked: boolean) => {
    const mode: "default" | "free" = checked ? "free" : "default";
    if (checked) {
      setPositions((prev) => {
        const next = { ...prev };
        Object.keys(permissionGroups).forEach((g, i) => {
          if (!next[g]) {
            const col = i % colCount;
            const row = Math.floor(i / colCount);
            next[g] = {
              x: col * (CARD_WIDTH + CARD_GAP),
              y: row * (CARD_HEIGHT_ESTIMATE + CARD_GAP),
            };
          }
        });
        setPermissionsGroupPositions(next);
        return next;
      });
    }
    setFreeLayoutMode(mode);
    setPermissionsLayoutMode(mode);
  };

  const handleDragPointerDown = (e: React.PointerEvent, groupName: string) => {
    if (freeLayoutMode !== "free") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const start = positions[groupName] || { x: 0, y: 0 };
    dragState.current = {
      group: groupName,
      startX: e.clientX,
      startY: e.clientY,
      origX: start.x,
      origY: start.y,
    };
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const { group, startX, startY, origX, origY } = dragState.current;
    setPositions((prev) => ({
      ...prev,
      [group]: {
        x: Math.max(0, origX + (e.clientX - startX)),
        y: Math.max(0, origY + (e.clientY - startY)),
      },
    }));
  };

  const handleDragPointerUp = () => {
    if (!dragState.current) return;
    dragState.current = null;
    setPositions((prev) => {
      setPermissionsGroupPositions(prev);
      return prev;
    });
  };

  // 🃏 การ์ดกลุ่มหนึ่งใบ — ใช้ร่วมกันทั้งโหมด grid ปกติและโหมดเรียงอิสระ (draggable=true เฉพาะโหมดหลัง
  // ต่อ pointer handler ไว้ที่ตัวหัวข้อกลุ่มเท่านั้น ไม่ครอบทั้งการ์ด กันชนกับปุ่มแก้ icon/สร้างสิทธิ์ข้างๆ)
  const renderGroupCard = (groupName: string, draggable: boolean) => {
    const permsInGroup = permissionGroups[groupName];
    const groupIconName = getGroupIconName(permsInGroup);
    const subGroups = permsInGroup.reduce((acc: any, perm: any) => {
      const sub = perm.sub_group || "ทั่วไป"; // ถ้าไม่ระบุให้ลงกลุ่ม 'ทั่วไป'
      if (!acc[sub]) acc[sub] = [];
      acc[sub].push(perm);
      return acc;
    }, {});

    return (
      <div
        key={groupName}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm w-full"
      >
        <div className="flex justify-between items-center mb-4">
          <h3
            className={cn(
              "font-bold text-md flex items-center gap-3 text-blue-700 dark:text-blue-400 select-none",
              draggable && "cursor-move touch-none",
            )}
            onPointerDown={
              draggable ? (e) => handleDragPointerDown(e, groupName) : undefined
            }
            onPointerMove={draggable ? handleDragPointerMove : undefined}
            onPointerUp={draggable ? handleDragPointerUp : undefined}
          >
            <GroupIcon iconName={groupIconName} /> {groupName}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <GroupIconDialog
              group={groupName}
              currentIcon={groupIconName}
              onUpdated={fetchPermissions}
            />
            <AddPermissionDialog
              onSuccess={fetchPermissions}
              defaultGroup={groupName}
              isIconOnly={true}
            />
            <button
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title={`ลบกลุ่ม "${groupName}" ทั้งหมด`}
              onClick={() => setGroupToDelete(groupName)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 🚀 วนลูปแสดงกลุ่มย่อย */}
        <div className="space-y-6">
          {Object.keys(subGroups).map((subGroupName) => (
            <div key={subGroupName} className="space-y-3">
              <div className="flex items-center gap-2 text-slate-500 border-b border-slate-100 pb-1">
                <ListTree className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  {subGroupName}
                </h4>
              </div>
              <div className="space-y-2">
                {subGroups[subGroupName].map((perm: any) => (
                  <div
                    key={perm.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                        {perm.title_th || perm.name}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {perm.title_th && (
                          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800/50 font-mono">
                            {perm.name}
                          </span>
                        )}
                        {/* 🚀 โชว์เลขลำดับ Sort */}
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                          ลำดับ: {perm.sort_order || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <EditPermissionDialog
                        permission={perm}
                        onUpdated={fetchPermissions}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0 cursor-pointer rounded-lg"
                        onClick={() => setPermissionToDelete(perm)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const columnsData: string[][] = Array.from({ length: colCount }, () => []);
  if (isMounted) {
    Object.keys(permissionGroups).forEach((groupName, index) => {
      columnsData[index % colCount].push(groupName);
    });
  }

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              จัดการสิทธิ์การใช้งาน
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              จัดการบทบาทและสิทธิ์การเข้าถึงเมนูต่างๆ ในระบบ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
            <Label
              htmlFor="free-layout-toggle"
              className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Move className="w-3.5 h-3.5" /> เรียงอิสระ
            </Label>
            <Switch
              id="free-layout-toggle"
              checked={freeLayoutMode === "free"}
              onCheckedChange={toggleFreeLayout}
            />
          </div>
          {isPlatformAdmin && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <Label
                htmlFor="auto-sync-toggle"
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300"
              >
                Auto-sync สิทธิ์ใหม่ให้ทุกบริษัท
              </Label>
              <Switch
                id="auto-sync-toggle"
                checked={autoSyncEnabled}
                disabled={savingAutoSync}
                onCheckedChange={toggleAutoSync}
              />
            </div>
          )}
          <AddPermissionDialog onSuccess={fetchPermissions} />
        </div>
      </div>

      {loading ? (
        <AppLoading />
      ) : Object.keys(permissionGroups).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-10 text-center text-slate-400">
          ยังไม่มีสิทธิ์การใช้งานในระบบ
        </div>
      ) : freeLayoutMode === "free" ? (
        <div
          className="relative w-full"
          style={{
            minHeight:
              Math.max(
                ...Object.keys(permissionGroups).map(
                  (g) => (positions[g]?.y ?? 0) + CARD_HEIGHT_ESTIMATE,
                ),
                600,
              ) + CARD_GAP,
          }}
        >
          {Object.keys(permissionGroups).map((groupName) => (
            <div
              key={groupName}
              className="absolute"
              style={{
                left: positions[groupName]?.x ?? 0,
                top: positions[groupName]?.y ?? 0,
                width: CARD_WIDTH,
              }}
            >
              {renderGroupCard(groupName, true)}
            </div>
          ))}
        </div>
      ) : (
      <div
        className={cn(
          "grid gap-6 items-start",
          colCount === 3
            ? "grid-cols-3"
            : colCount === 2
              ? "grid-cols-2"
              : "grid-cols-1",
        )}
      >
        {columnsData.map((colGroups, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-6 w-full">
            {colGroups.map((groupName) => renderGroupCard(groupName, false))}
          </div>
        ))}
      </div>
      )}

      <Dialog
        open={!!permissionToDelete}
        onOpenChange={(open) => !open && setPermissionToDelete(null)}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900 [&>button.absolute]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>ยืนยันการลบสิทธิ์การใช้งาน</DialogTitle>
            <DialogDescription>
              สิทธิ์นี้จะถูกลบออกจากระบบอย่างถาวร
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 flex flex-col items-center text-center space-y-5">
            <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-2 border-4 border-red-100 dark:border-red-900/30">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              ยืนยันการลบ?
            </h3>
            <p className="text-slate-500">
              ลบสิทธิ์{" "}
              <strong className="text-slate-800 dark:text-slate-200 text-lg">
                "{permissionToDelete?.title_th || permissionToDelete?.name}"
              </strong>{" "}
              ออกจากระบบ <br /> ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนกลับมาได้
            </p>
          </div>
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-3">
            <Button
              variant="outline"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              onClick={() => setPermissionToDelete(null)}
              disabled={isDeleting}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-800 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              onClick={proceedDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังลบ...</span>
                </div>
              ) : (
                "ยืนยันการลบ"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!groupToDelete}
        onOpenChange={(open) => !open && setGroupToDelete(null)}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900 [&>button.absolute]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>ยืนยันการลบกลุ่มทั้งหมด</DialogTitle>
            <DialogDescription>
              สิทธิ์ทุกตัวในกลุ่มนี้จะถูกลบออกจากระบบอย่างถาวร
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 flex flex-col items-center text-center space-y-5">
            <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-2 border-4 border-red-100 dark:border-red-900/30">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              ลบกลุ่มนี้ทั้งหมด?
            </h3>
            <p className="text-slate-500">
              ลบสิทธิ์ทุกตัว (
              {groupToDelete
                ? (permissionGroups[groupToDelete] || []).length
                : 0}{" "}
              รายการ) ในกลุ่ม{" "}
              <strong className="text-slate-800 dark:text-slate-200 text-lg">
                "{groupToDelete}"
              </strong>{" "}
              ออกจากระบบ <br /> ถ้ามีสิทธิ์ตัวใดตัวหนึ่งยังถูกมอบให้ role
              อยู่ ระบบจะไม่ยอมให้ลบ <br /> ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนกลับมาได้
            </p>
          </div>
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-3">
            <Button
              variant="outline"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              onClick={() => setGroupToDelete(null)}
              disabled={isDeletingGroup}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-800 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              onClick={proceedDeleteGroup}
              disabled={isDeletingGroup}
            >
              {isDeletingGroup ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังลบ...</span>
                </div>
              ) : (
                "ยืนยันลบกลุ่มทั้งหมด"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
