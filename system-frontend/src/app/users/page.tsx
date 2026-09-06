"use client";

import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Trash2,
  Edit2,
  Loader2,
  AlertTriangle,
  KeyRound,
  Users,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { AppLoading } from "@/components/ui/app-loading";
import { AppPagination } from "@/components/ui/app-pagination";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getToken, getUserRaw } from "@/lib/auth-storage";

// นำเข้า Components
import AddUserDialog from "@/components/users/AddUserDialog";
import EditUserDialog from "@/components/users/EditUserDialog";
import ResetPasswordDialog from "@/components/users/ResetPasswordDialog";
import UserExcelActions from "@/components/users/UserExcelActions"; // 🚀 นำเข้า Component Excel

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [departments, setDepartments] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<any>({});

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isResetPwdOpen, setIsResetPwdOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<any>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const getAuthHeader = () => {
    const token =
      getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/users`, { headers: getAuthHeader() });
      if (res.ok) {
        setUsers(await res.json());
      } else {
        // 🛡️ เดิม fetch ล้มเหลวเงียบๆ ไม่มี toast ผู้ใช้แยกไม่ออกว่า "ยังไม่มีข้อมูล" หรือ "โหลดพัง"
        toast.error("โหลดรายชื่อผู้ใช้งานไม่สำเร็จ");
      }
    } catch (e) {
      console.error(e);
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const [dRes, rRes, pRes] = await Promise.all([
        fetch(`${apiUrl}/departments`, { headers: getAuthHeader() }),
        fetch(`${apiUrl}/roles`, { headers: getAuthHeader() }),
        fetch(`${apiUrl}/permissions`, { headers: getAuthHeader() }),
      ]);

      if (dRes.ok) {
        const dData = await dRes.json();
        setDepartments(Array.isArray(dData) ? dData : dData.data || []);
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        setRolesList(Array.isArray(rData) ? rData : rData.data || []);
      }
      if (pRes.ok) setPermissionGroups(await pRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDependencies();

    // 🚀 ระบบดักฟังสัญญาณ Refresh จาก UserExcelActions ตอนโหลดไฟล์เสร็จ
    const handleRefresh = () => fetchUsers();
    window.addEventListener("refreshUsers", handleRefresh);
    return () => window.removeEventListener("refreshUsers", handleRefresh);
  }, []);

  const handleToggleStatus = async (user: any) => {
    const isProtected =
      user.is_platform_admin === true || user.is_platform_admin === 1;
    if (isProtected) {
      toast.error(
        "ไม่อนุญาตให้ระงับการใช้งาน Platform Admin (ผู้ดูแลระบบสูงสุด)",
      );
      return;
    }

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/users/${user.id}/toggle-status`, {
        method: "PATCH",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        setUsers((prev: any) =>
          prev.map((u: any) =>
            u.id === user.id ? { ...u, is_active: data.is_active } : u,
          ),
        );
      } else {
        toast.error("เปลี่ยนสถานะไม่สำเร็จ");
      }
    } catch (e) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
  };

  const confirmDelete = (user: any) => {
    setUserToDelete(user);
    setIsDeleteOpen(true);
  };

  const proceedDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        toast.success("ย้ายผู้ใช้งานไปที่ถังขยะสำเร็จ");
        fetchUsers();
        setIsDeleteOpen(false);
      } else {
        const err = await res.json();
        toast.error(`ไม่สามารถลบได้: ${err.message}`);
      }
    } catch (e) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsDeleting(false);
      setUserToDelete(null);
    }
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setIsEditOpen(true);
  };

  const handleResetPwdClick = (user: any) => {
    setUserToReset(user);
    setIsResetPwdOpen(true);
  };

  const [loggedInUser, setLoggedInUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = getUserRaw();
    if (storedUser) setLoggedInUser(JSON.parse(storedUser));
  }, []);

  const isMePlatformAdmin =
    loggedInUser?.user?.is_platform_admin === 1 ||
    loggedInUser?.user?.is_platform_admin === true;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              จัดการผู้ใช้งาน
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              จัดการบัญชี, บทบาท (Roles) และสิทธิ์การเข้าถึง (Permissions)
              ในระบบ
            </p>
          </div>
        </div>

        {/* 🚀 เพิ่มกลุ่มปุ่มต่างๆ ไว้ด้วยกัน */}
        <div className="flex flex-wrap items-center gap-2">
          {isMePlatformAdmin && (
            <Button
              variant="outline"
              className="rounded-full h-10 px-4 gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
              onClick={() => router.push("/company-access")}
            >
              <Building2 className="w-4 h-4 mr-2" /> สิทธิ์เข้าหลายบริษัท
            </Button>
          )}
          <UserExcelActions />

          <Button
            variant="outline"
            className="text-red-500 hover:text-red-700 border-red-200 rounded-full h-10 px-4 gap-2 hover:bg-red-50 cursor-pointer transition-all hover:scale-102 transition-transform"
            onClick={() => router.push("/users/trash")}
          >
            <Trash2 className="w-4 h-4 mr-2" /> ถังขยะ
          </Button>

          <AddUserDialog onSuccess={fetchUsers} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden shadow-sm p-4">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="py-4 font-bold">ชื่อ-นามสกุล</TableHead>
              <TableHead className="font-bold">แผนก</TableHead>
              <TableHead className="font-bold">บทบาท</TableHead>
              <TableHead className="font-bold text-center">สถานะ</TableHead>
              <TableHead className="text-right px-6 font-bold">
                จัดการ
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <AppLoading />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-10 text-slate-400 italic"
                >
                  ไม่มีข้อมูลผู้ใช้งาน
                </TableCell>
              </TableRow>
            ) : (
              // 🚀 เปลี่ยนตรงนี้ให้ตัดแบ่งทีละ 10 คน
              users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((user: any) => {
                const isActive =
                  user.is_active === 1 ||
                  user.is_active === true ||
                  user.is_active === "1";

                const isPlatformAdmin =
                  user.is_platform_admin === true ||
                  user.is_platform_admin === 1;

                const isSuperAdmin = user.roles?.some((role: any) =>
                  role.name.includes("Super Admin"),
                );

                return (
                  <TableRow
                    key={user.id}
                    className={cn(
                      "transition-colors",
                      !isActive
                        ? "bg-slate-50 dark:bg-slate-900/50 opacity-70"
                        : "hover:bg-slate-50/50",
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold overflow-hidden border shrink-0",
                            isActive
                              ? "bg-blue-100 text-blue-600 border-blue-200"
                              : "bg-slate-200 text-slate-500 border-slate-300 grayscale",
                          )}
                        >
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              className="w-full h-full object-cover"
                              alt={user.name}
                            />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p
                            className={cn(
                              "font-bold truncate",
                              isActive
                                ? "text-slate-800 dark:text-slate-200"
                                : "text-slate-500 line-through",
                            )}
                          >
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.department ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            isActive
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200",
                          )}
                        >
                          {user.department.name}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          - ไม่ระบุ -
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.roles && user.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role: any) => (
                            <Badge
                              key={role.id}
                              variant="outline"
                              className={cn(
                                isActive
                                  ? "bg-blue-50 text-blue-600 border-blue-200"
                                  : "bg-slate-100 text-slate-500 border-slate-200",
                              )}
                            >
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          - ไม่มีบทบาท -
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => handleToggleStatus(user)}
                          disabled={isPlatformAdmin}
                          className="cursor-pointer data-[state=checked]:bg-green-600"
                        />
                        <span className="text-[10px] font-bold">
                          {isActive ? "ใช้งานปกติ" : "ถูกระงับ"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                          onClick={() => handleResetPwdClick(user)}
                          title="รีเซ็ตรหัสผ่าน"
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                          onClick={() => handleEditClick(user)}
                          title="แก้ไขข้อมูล"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-30"
                          onClick={() => confirmDelete(user)}
                          disabled={
                            isPlatformAdmin ||
                            (isSuperAdmin && !isMePlatformAdmin)
                          }
                          title="ลบผู้ใช้งาน"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AppPagination
        currentPage={currentPage}
        lastPage={Math.ceil(users.length / itemsPerPage) || 1}
        total={users.length}
        perPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      <EditUserDialog
        user={editingUser}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={fetchUsers}
        departments={departments}
        rolesList={rolesList}
        permissionGroups={permissionGroups}
      />
      <ResetPasswordDialog
        open={isResetPwdOpen}
        onOpenChange={setIsResetPwdOpen}
        user={userToReset}
      />

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900 [&>button.absolute]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>ยืนยันการย้ายลงถังขยะ</DialogTitle>
            <DialogDescription>
              ผู้ใช้งานจะถูกปิดกั้นการเข้าสู่ระบบ แต่สามารถกู้คืนได้ในภายหลัง
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 flex flex-col items-center text-center space-y-5">
            <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-2 border-4 border-red-100 dark:border-red-900/30">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              ย้ายไปถังขยะ?
            </h3>
            <p className="text-slate-500">
              ย้าย{" "}
              <strong className="text-slate-800 dark:text-slate-200 text-lg">
                "{userToDelete?.name}"
              </strong>{" "}
              ลงถังขยะ <br /> คุณสามารถกู้คืนกลับมาได้ในภายหลัง
            </p>
          </div>
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl font-bold border-slate-200 dark:border-slate-700 cursor-pointer"
              onClick={() => setIsDeleteOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1 h-12 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 cursor-pointer"
              onClick={proceedDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>กำลังย้ายลงถังขยะ</span>
              </div>
            ) : (
              "ย้ายลงถังขยะ"
            )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
