"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash, X, ArchiveRestore, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";

interface TrashUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void; // ดึงข้อมูลผู้ใช้ในตารางหลักใหม่เมื่อมีการกู้คืน
}

export default function TrashUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: TrashUserDialogProps) {
  const [trashedUsers, setTrashedUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [forceDeleteTarget, setForceDeleteTarget] = useState<number | null>(null);
  const [isForceDeleting, setIsForceDeleting] = useState(false);

  const getAuthHeader = () => {
    const token =
      getToken();
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
      if (res.ok) setTrashedUsers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTrashedUsers();
    }
  }, [open]);

  const handleRestore = async (id: number) => {
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/users/${id}/restore`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        toast.success("กู้คืนบัญชีเรียบร้อยแล้ว");
        fetchTrashedUsers();
        onSuccess(); // บอกหน้าหลักให้โหลดข้อมูลใหม่
      }
    } catch (e) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
  };

  const executeForceDelete = async () => {
    if (!forceDeleteTarget) return;
    setIsForceDeleting(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/users/${forceDeleteTarget}/force`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        toast.success("ลบข้อมูลแบบถาวรเรียบร้อยแล้ว");
        setForceDeleteTarget(null);
        fetchTrashedUsers();
      }
    } catch (e) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsForceDeleting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 💡 คอมเมนต์แก้ตรงนี้: เปลี่ยนจาก max-w-4xl เป็น max-w-5xl หรือ w-[90vw] เพื่อขยายให้กว้างเต็มตาขึ้นแบบในรูป */}
      <DialogContent className="sm:max-w-xl !max-w-xl w-[95vw] sm:w-[90vw] md:w-[80vw] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900 [&>button.absolute]:hidden">
        <DialogHeader className="bg-red-50 dark:bg-red-900/20 p-6 border-b border-red-100 dark:border-red-900/30 flex flex-row justify-between items-center">
          <div>
            <DialogTitle className="text-md font-bold text-red-600 flex items-center gap-2">
              <Trash className="w-6 h-6" /> ถังขยะ (ผู้ใช้งานที่ถูกลบ)
            </DialogTitle>
            <DialogDescription className="text-red-500/80 text-[11px] mt-1">
              บัญชีที่อยู่ในนี้จะไม่สามารถเข้าสู่ระบบได้ คุณสามารถกู้คืนหรือลบทิ้งถาวรได้
            </DialogDescription>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors p-2 text-red-500 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </DialogHeader>

        <div className="p-6 w-[800px] !max-w-[800px] overflow-y-auto">
          {isLoading ? (
            <AppLoading text="กำลังค้นหาถังขยะ..." minHeight="min-h-0" className="py-20" />
          ) : trashedUsers.length === 0 ? (
            <div className="text-center py-20 text-slate-400 italic">
              ถังขยะว่างเปล่า ไม่มีผู้ใช้งานที่ถูกลบ
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 💡 คอมเมนต์: พอขยายกว้างแล้ว โค้ดดี้เลยปรับให้แสดงผลแบบแบ่ง 2 คอลัมน์ตอนจอกว้างด้วยครับ จะได้ไม่ดูโล่งไป */}
              {trashedUsers.map((user: any) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 gap-4"
                >
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold grayscale shrink-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        user.name.charAt(0)
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-bold text-slate-700 dark:text-slate-300 line-through truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {user.email}
                      </p>
                      {/* <p className="text-[10px] text-red-400 mt-1">
                        ถูกลบเมื่อ:{" "}
                        {new Date(user.deleted_at).toLocaleDateString("th-TH")}
                      </p> */}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-end shrink-0">
                    <Button
                      variant="outline"
                      className="rounded-xl text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 font-bold cursor-pointer transition-colors"
                      onClick={() => handleRestore(user.id)}
                    >
                      <ArchiveRestore className="w-4 h-4 mr-1" /> กู้คืน
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-bold cursor-pointer transition-colors"
                      onClick={() => setForceDeleteTarget(user.id)}
                    >
                      <Trash className="w-4 h-4 mr-1" /> ลบถาวร
                    </Button>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-end shrink-0">
                    <p className="text-[10px] text-red-400 mt-1">
                        ถูกลบเมื่อ:{" "}
                        {new Date(user.deleted_at).toLocaleDateString("th-TH")}
                      </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AppConfirmDialog
      open={forceDeleteTarget !== null}
      onOpenChange={(v) => !v && setForceDeleteTarget(null)}
      icon={AlertTriangle}
      iconColorClass="bg-red-50 text-red-600 border-red-100/50"
      title="ยืนยันการลบถาวร?"
      description="ข้อมูลจะถูกลบทิ้งถาวรและกู้คืนไม่ได้อีก คุณแน่ใจหรือไม่?"
      confirmLabel={isForceDeleting ? "กำลังลบ..." : "ยืนยันลบถาวร"}
      confirmColorClass="bg-red-600 hover:bg-red-700 shadow-red-600/20"
      onConfirm={executeForceDelete}
      loading={isForceDeleting}
    />
    </>
  );
}
