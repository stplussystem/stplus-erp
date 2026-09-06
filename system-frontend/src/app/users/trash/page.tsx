"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Trash,
  ArchiveRestore,
  ArrowLeft,
  AlertTriangle,
  CheckSquare,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppLoading } from "@/components/ui/app-loading";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";

export default function TrashUsersPage() {
  const [trashedUsers, setTrashedUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // 💡 State สำหรับควบคุม Popup ยืนยัน
  const [targetRestore, setTargetRestore] = useState<number | "batch" | null>(
    null,
  );
  const [targetDelete, setTargetDelete] = useState<number | "batch" | null>(
    null,
  );

  const getAuthHeader = () => {
    const token = getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  };

  const fetchTrashedUsers = async () => {
    setIsLoading(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/users/trashed`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        setTrashedUsers(await res.json());
        setSelectedIds([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashedUsers();
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.length === trashedUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(trashedUsers.map((user) => user.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // 🚀 ฟังก์ชันยืนยันการกู้คืน (รวมทั้งเดี่ยวและกลุ่ม)
  const proceedRestore = async () => {
    if (!targetRestore) return;
    setIsProcessingBatch(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      let res;

      if (targetRestore === "batch") {
        res = await fetch(`${apiUrl}/users/restore-batch`, {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify({ ids: selectedIds }),
        });
      } else {
        res = await fetch(`${apiUrl}/users/${targetRestore}/restore`, {
          method: "POST",
          headers: getAuthHeader(),
        });
      }

      if (res.ok) {
        toast.success(
          targetRestore === "batch"
            ? `กู้คืน ${selectedIds.length} บัญชีเรียบร้อยแล้ว`
            : "กู้คืนบัญชีเรียบร้อยแล้ว",
        );
        fetchTrashedUsers();
        setTargetRestore(null); // ปิด Popup
      } else {
        // 🛡️ เดิมไม่มี else — ถ้า backend ปฏิเสธ (เช่น ไม่มีสิทธิ์) จะไม่มี toast แจ้งเลย ผู้ใช้ไม่รู้ว่ากู้คืนไม่สำเร็จ
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "กู้คืนบัญชีไม่สำเร็จ");
      }
    } catch (e) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // 🚀 ฟังก์ชันยืนยันการลบถาวร (รวมทั้งเดี่ยวและกลุ่ม)
  const proceedDelete = async () => {
    if (!targetDelete) return;
    setIsProcessingBatch(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      let res;

      if (targetDelete === "batch") {
        res = await fetch(`${apiUrl}/users/force-batch`, {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify({ ids: selectedIds }),
        });
      } else {
        res = await fetch(`${apiUrl}/users/${targetDelete}/force`, {
          method: "DELETE",
          headers: getAuthHeader(),
        });
      }

      if (res.ok) {
        toast.success(
          targetDelete === "batch"
            ? `ลบทิ้งถาวร ${selectedIds.length} บัญชีเรียบร้อยแล้ว`
            : "ลบข้อมูลแบบถาวรเรียบร้อยแล้ว",
        );
        fetchTrashedUsers();
        setTargetDelete(null); // ปิด Popup
      } else {
        // 🛡️ เดิมไม่มี else — ถ้า backend ปฏิเสธ (เช่น ไม่มีสิทธิ์) จะไม่มี toast แจ้งเลย ผู้ใช้ไม่รู้ว่าลบไม่สำเร็จ
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "ลบข้อมูลถาวรไม่สำเร็จ");
      }
    } catch (e) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-red-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              ถังขยะ (บัญชีที่ถูกลบ)
            </h1>
             <p className="text-slate-500 text-[11px] mt-0.5">
              บัญชีที่อยู่ในนี้จะไม่สามารถเข้าสู่ระบบได้
              คุณสามารถกู้คืนหรือลบทิ้งถาวรได้
            </p>
          </div>
        </div>

        <Link href="/users">
          <Button
            variant="outline"
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> กลับไปหน้าจัดการผู้ใช้งาน
          </Button>
        </Link>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-blue-700 dark:text-blue-400 font-bold">
            <CheckSquare className="w-5 h-5" />
            เลือกอยู่ {selectedIds.length} รายการ
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 font-bold cursor-pointer rounded-xl bg-white dark:bg-slate-900"
              onClick={() => setTargetRestore("batch")} // 💡 เรียก Popup กู้คืนกลุ่ม
            >
              <ArchiveRestore className="w-4 h-4 mr-2" />
              กู้คืนทั้งหมดที่เลือก
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-bold cursor-pointer rounded-xl bg-white dark:bg-slate-900"
              onClick={() => setTargetDelete("batch")} // 💡 เรียก Popup ลบกลุ่ม
            >
              <Trash className="w-4 h-4 mr-2" />
              ลบทิ้งถาวรที่เลือก
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border rounded-3xl overflow-hidden shadow-sm min-h-[50vh]">
        {isLoading ? (
          <AppLoading text="กำลังค้นหาข้อมูลในถังขยะ..." minHeight="py-32" />
        ) : trashedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 text-center">
            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Trash className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-500 mb-1">
              ถังขยะว่างเปล่า
            </h3>
            <p className="text-sm">ไม่มีบัญชีผู้ใช้งานที่ถูกลบในขณะนี้</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex items-center gap-4 p-4 px-6 bg-slate-50 dark:bg-slate-800/50">
              <label className="flex items-center justify-center cursor-pointer p-1">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                  checked={
                    selectedIds.length === trashedUsers.length &&
                    trashedUsers.length > 0
                  }
                  onChange={toggleSelectAll}
                />
              </label>
              <div className="text-sm font-bold text-slate-500 flex-1">
                ข้อมูลผู้ใช้งาน
              </div>
              <div className="text-sm font-bold text-slate-500 w-48 hidden md:block">
                วันที่ถูกลบ
              </div>
              <div className="text-sm font-bold text-slate-500 w-40 text-right">
                จัดการ
              </div>
            </div>

            {trashedUsers.map((user: any) => (
              <div
                key={user.id}
                className={cn(
                  "flex items-center gap-4 p-4 px-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30",
                  selectedIds.includes(user.id)
                    ? "bg-blue-50/50 dark:bg-blue-900/10"
                    : "",
                )}
              >
                <label className="flex items-center justify-center cursor-pointer p-1">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                    checked={selectedIds.includes(user.id)}
                    onChange={() => toggleSelect(user.id)}
                  />
                </label>

                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold grayscale shrink-0 border border-slate-300">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm">{user.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-slate-700 dark:text-slate-300 line-through truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="w-48 hidden md:flex items-center gap-1 text-xs text-red-500 font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  {new Date(user.deleted_at).toLocaleDateString("th-TH")}
                </div>

                <div className="flex gap-2 w-40 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                    onClick={() => setTargetRestore(user.id)} // 💡 เรียก Popup กู้คืนเดี่ยว
                    title="กู้คืน"
                  >
                    <ArchiveRestore className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    onClick={() => setTargetDelete(user.id)} // 💡 เรียก Popup ลบเดี่ยว
                    title="ลบทิ้งถาวร"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🟢 Popup ยืนยันการกู้คืน */}
      <Dialog
        open={!!targetRestore}
        onOpenChange={(open) => !open && setTargetRestore(null)}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900 [&>button.absolute]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>ยืนยันการกู้คืน</DialogTitle>
            <DialogDescription>
              คุณต้องการกู้คืนบัญชีผู้ใช้นี้หรือไม่
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 flex flex-col items-center text-center space-y-5">
            {/* 🚀 เปลี่ยนจาก emerald เป็น green ให้หมด */}
            <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-full flex items-center justify-center mb-2 border-4 border-green-100 dark:border-green-900/30">
              <ArchiveRestore className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
              ยืนยันการกู้คืน?
            </h3>
            <p className="text-slate-500">
              คุณต้องการกู้คืน{" "}
              {targetRestore === "batch" ? (
                <strong className="text-green-600 text-lg">
                  {selectedIds.length} บัญชีที่เลือก
                </strong>
              ) : (
                "บัญชีนี้"
              )}{" "}
              ใช่หรือไม่?
              <br />
              บัญชีนี้จะสามารถกลับมาเข้าระบบได้ตามปกติ
            </p>
          </div>
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl font-bold cursor-pointer"
              onClick={() => setTargetRestore(null)}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1 h-12 rounded-xl font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 cursor-pointer"
              onClick={proceedRestore}
              disabled={isProcessingBatch}
            >
              {isProcessingBatch ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังกู้คืนข้อมูล</span>
                </div>
              ) : (
                "ยืนยันกู้คืน"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🔴 Popup ยืนยันการลบทิ้งถาวร */}
      <Dialog
        open={!!targetDelete}
        onOpenChange={(open) => !open && setTargetDelete(null)}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900 [&>button.absolute]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>ยืนยันการลบทิ้งถาวร</DialogTitle>
            <DialogDescription>
              คุณต้องการลบทิ้งบัญชีผู้ใช้นี้ถาวรหรือไม่
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 flex flex-col items-center text-center space-y-5">
            <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-2 border-4 border-red-100 dark:border-red-900/30">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
              ยืนยันการลบทิ้งถาวร?
            </h3>
            <p className="text-slate-500">
              คุณต้องการลบทิ้ง{" "}
              {targetDelete === "batch" ? (
                <strong className="text-red-600 text-lg">
                  {selectedIds.length} บัญชีที่เลือก
                </strong>
              ) : (
                "บัญชีนี้"
              )}{" "}
              ใช่หรือไม่?
              <br />
              <span className="text-red-500 font-bold">
                ข้อมูลจะหายไปและไม่สามารถกู้คืนได้อีก!
              </span>
            </p>
          </div>
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl font-bold cursor-pointer"
              onClick={() => setTargetDelete(null)}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1 h-12 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 cursor-pointer"
              onClick={proceedDelete}
              disabled={isProcessingBatch}
            >
              {isProcessingBatch ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "ยืนยันลบทิ้งถาวร"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
