"use client";

import React, { useEffect, useState } from "react";
import { getToken, getUserRaw } from "@/lib/auth-storage";

// ==========================================
// 1. IMPORTS (จัดระเบียบใหม่ให้คลีน)
// ==========================================
import {
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  CheckCheck,
  FolderKey,
  X,
  ShieldPlus,
  ArrowLeft,
  Save,
  AlertTriangle,
} from "lucide-react"; // 🚀 ลบ Badge ออกจากที่นี่แล้วครับ!
import { MENU_ICON_MAP } from "@/lib/menu-icons";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge"; // 🚀 ดึง Badge จาก UI โฟลเดอร์ของเราแทน (แก้บั๊กหกเหลี่ยม)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
// 🎨 icon ของกลุ่มต้องตรงกับของจริงที่ AppLayout ใช้ในเมนู sidebar/topbar เสมอ — mirror logic เดียวกับ
// UserSessionFormatter::format() ฝั่ง backend (หยิบ icon ของ permission ตัวแรกในกลุ่มที่มี icon ไม่ว่าง)
// แทนการเดาจาก substring ชื่อกลุ่มแบบเดิมที่ไม่ตรงของจริงเลย
const getGroupIcon = (permsInGroup: any[]) => {
  const iconName = permsInGroup.find((p) => p.icon)?.icon || "FolderKey";
  const IconComp = MENU_ICON_MAP[iconName] || FolderKey;
  return <IconComp className="w-5 h-5 text-blue-600" />;
};

export default function RolesPage() {
  // ==========================================
  // 3. STATES
  // ==========================================
  // ข้อมูลหลัก
  const [roles, setRoles] = useState<any[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  // ระบบกรองบริษัท (สำหรับ Platform Admin)
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const [loggedInUser, setLoggedInUser] = useState<any>(null);

  // Modal (สร้าง/แก้ไข)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  // ตัวแปรเช็คสถานะพระเจ้า (Platform Admin)
  const isMePlatformAdmin =
    loggedInUser?.user?.is_platform_admin === 1 ||
    loggedInUser?.user?.is_platform_admin === true;

  // 🛡️ backend (RoleController::currentUserCanGrantAll) บล็อกไม่ให้ user ที่ไม่ใช่ platform/company admin
  // มอบสิทธิ์ที่ตัวเองไม่มีให้ role ได้อยู่แล้ว — กรอง checkbox ฝั่งนี้ให้ตรงกันไปเลย (mirror logic เดียวกับ
  // usePermission.ts) กันไม่ให้ user เห็น/ติ๊กสิทธิ์ทั้งระบบที่ตัวเองไม่มีสิทธิ์มอบ แล้วไปเจอ 403 ตอน submit
  const isMeSuperAdminByRole =
    Array.isArray(loggedInUser?.user?.roles) &&
    loggedInUser.user.roles.some((r: any) =>
      typeof r === "string"
        ? r.includes("Super Admin")
        : r?.name?.includes("Super Admin"),
    );
  const canGrantAnyPermission = isMePlatformAdmin || isMeSuperAdminByRole;
  const myPermissionNames: string[] = Array.isArray(loggedInUser?.user?.permissions)
    ? loggedInUser.user.permissions.map((p: any) => (typeof p === "string" ? p : p?.name))
    : [];

  const visiblePermissionGroups: Record<string, any[]> = canGrantAnyPermission
    ? permissionGroups
    : Object.keys(permissionGroups).reduce((acc: Record<string, any[]>, g) => {
        const filtered = permissionGroups[g].filter((p: any) =>
          myPermissionNames.includes(p.name),
        );
        if (filtered.length > 0) acc[g] = filtered;
        return acc;
      }, {});

  // ==========================================
  // 4. API FETCHING
  // ==========================================
  const getAuthHeader = () => {
    const token = getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  };

  const fetchRoles = async (companyId = "all") => {
    setIsLoading(true);
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    try {
      const res = await fetch(`${apiUrl}/roles?company_id=${companyId}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) setRoles(await res.json());
    } catch (e) {
      toast.error("โหลดข้อมูลกลุ่มตำแหน่งไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPermissions = async () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    try {
      const res = await fetch(`${apiUrl}/permissions`, {
        headers: getAuthHeader(),
      });
      if (res.ok) setPermissionGroups(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCompanies = async () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    try {
      const res = await fetch(`${apiUrl}/companies`, {
        headers: getAuthHeader(),
      });
      if (res.ok) setCompanies(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // 1. โหลดข้อมูล User ปัจจุบัน
    const storedUser = getUserRaw();
    let isPlatformAdmin = false;

    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setLoggedInUser(parsedUser);
      isPlatformAdmin =
        parsedUser?.user?.is_platform_admin === 1 ||
        parsedUser?.user?.is_platform_admin === true;
    }

    // 2. โหลดสิทธิ์ทั้งหมด และ โหลด Roles (ค่าเริ่มต้นคือทั้งหมด)
    fetchPermissions();
    fetchRoles(selectedCompanyId);

    // 3. ถ้าเป็น Platform Admin ให้โหลดรายชื่อบริษัทมาทำ Dropdown ด้วย
    if (isPlatformAdmin) {
      fetchCompanies();
    }
  }, []);

  // ==========================================
  // 5. HANDLERS
  // ==========================================
  const handleFilterChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    fetchRoles(companyId);
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData({ name: "" });
    setSelectedPermissions([]);
    setErrors({});
    setIsDialogOpen(true);
  };

  const openEdit = (role: any) => {
    setEditingId(role.id);
    setFormData({ name: role.name });
    setSelectedPermissions(role.permissions?.map((p: any) => p.name) || []);
    setErrors({});
    setIsDialogOpen(true);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "กรุณากรอกชื่อตำแหน่ง";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const togglePermission = (permName: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permName)
        ? prev.filter((n) => n !== permName)
        : [...prev, permName],
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    try {
      const url = editingId
        ? `${apiUrl}/roles/${editingId}`
        : `${apiUrl}/roles`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeader(),
        body: JSON.stringify({
          name: formData.name,
          permissions: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "บันทึกข้อมูลสำเร็จ");
        setIsDialogOpen(false);
        fetchRoles(selectedCompanyId); // โหลด Roles ใหม่โดยอิงจากตัวกรองปัจจุบัน
      } else if (res.status === 422 && data.errors) {
        const fieldErrors: Record<string, string> = {};
        Object.keys(data.errors).forEach((key) => {
          fieldErrors[key] = Array.isArray(data.errors[key])
            ? data.errors[key][0]
            : data.errors[key];
        });
        setErrors(fieldErrors);
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด");
      }
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeleteRole = async () => {
    if (!deleteTarget) return;
    setIsDeletingRole(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/roles/${deleteTarget}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        setDeleteTarget(null);
        fetchRoles(selectedCompanyId);
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error("ลบข้อมูลไม่สำเร็จ");
    } finally {
      setIsDeletingRole(false);
    }
  };

  // ==========================================
  // 6. RENDER UI
  // ==========================================
  return (
    <div className="w-full max-w-full px-4 py-2 overflow-x-hidden text-foreground mx-auto space-y-6 antialiased">
      {/* --- ส่วนหัว (Header & Actions) --- */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <ShieldPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              จัดการกลุ่มตำแหน่ง (Roles)
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              สร้างแพ็คเกจสิทธิ์แบบเหมา เพื่อความง่ายในการกำหนดสิทธิ์ให้พนักงาน
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* 🚀 ตัวกรองบริษัท (แสดงเฉพาะ Platform Admin) */}
          {isMePlatformAdmin && (
            <div className="flex items-center gap-2 w-full sm:w-auto bg-white dark:bg-slate-900 p-1 pl-3 rounded-xl border border-border dark:border-slate-800">
              <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                เลือกบริษัท:
              </span>
              <div className="w-full sm:w-[220px]">
                <AppSelect
                  value={selectedCompanyId}
                  onValueChange={handleFilterChange}
                  triggerClassName="h-9 border-none bg-transparent shadow-none focus:ring-0"
                  options={[
                    { value: "all", label: "ทั้งหมด (รวมทุกบริษัท)" },
                    ...[...companies]
                      .sort((a, b) => (a.id === 1 ? -1 : b.id === 1 ? 1 : 0))
                      .map((c: any) => ({
                        value: c.id.toString(),
                        label: `${c.id === 1 ? "👑" : "🏢"} ${c.name}`,
                      })),
                  ]}
                />
              </div>
            </div>
          )}

          <Button
            onClick={openAdd}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            <Plus className="w-5 h-5 mr-1" /> เพิ่มตำแหน่งใหม่
          </Button>
        </div>
      </div>

      {/* --- ส่วนแสดงผลการ์ด Roles --- */}
      {isLoading ? (
        <AppLoading text="กำลังโหลดข้อมูลตำแหน่ง..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.length === 0 ? (
            <div className="col-span-full p-10 text-center bg-white dark:bg-slate-900 rounded-3xl border border-border dark:border-slate-800 border-dashed">
              <ShieldCheck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground font-bold">
                ยังไม่มีข้อมูลตำแหน่งในบริษัทนี้
              </p>
            </div>
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-border dark:border-slate-800 flex flex-col h-full hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    {/* 🚀 ตัดคำว่า (C...) ทิ้ง */}
                    <h3 className="text-lg font-black text-foreground dark:text-slate-100">
                      {role.name.replace(/\s*\(C\d+\)/, "")}
                    </h3>

                    {/* 🚀 โชว์ป้ายบริษัทสวยๆ ถ้าเป็น Platform Admin */}
                    {isMePlatformAdmin && (
                      <div className="mt-1.5">
                        <Badge
                          variant="outline"
                          className="bg-purple-50 text-purple-600 border-purple-200 text-[10px] px-2.5 py-0.5 rounded-lg font-bold"
                        >
                          🏢 {role.company_name || "ไม่ระบุบริษัท"}
                        </Badge>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2 font-medium">
                      {role.permissions?.length || 0} สิทธิ์การเข้าถึง
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {/* ซ่อนปุ่มแก้ไข/ลบ ถ้าเป็น Super Admin */}
                    {!role.name.includes("Super Admin") && (
                      <>
                        <AppTooltip label="แก้ไข">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(role)}
                            className="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </AppTooltip>
                        <AppTooltip label="ลบ">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(role.id)}
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AppTooltip>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 mt-2">
                  {role.name.includes("Super Admin") ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl text-blue-600 dark:text-blue-400 text-sm font-bold flex flex-col items-center justify-center h-full border border-blue-100 dark:border-blue-900/50">
                      <ShieldCheck className="w-8 h-8 mb-2 opacity-80" />
                      มีสิทธิ์เข้าถึงทุกระบบ (Bypass)
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {role.permissions?.slice(0, 8).map((p: any) => (
                        <span
                          key={p.id}
                          className="bg-muted dark:bg-slate-800 text-muted-foreground px-2.5 py-1 rounded-lg text-xs font-medium border border-border dark:border-slate-700"
                        >
                          {p.title_th || p.name}
                        </span>
                      ))}
                      {(role.permissions?.length || 0) > 8 && (
                        <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-900/50">
                          +{role.permissions.length - 8} สิทธิ์
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* --- Popup สร้าง/แก้ไข Role --- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl p-0 border-none shadow-2xl [&>button.absolute]:hidden bg-white dark:bg-slate-950">
          <DialogHeader className="bg-blue-600 px-8 py-6 text-white flex flex-row justify-between items-center sticky top-0 z-20 shadow-sm">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-3 text-white">
                <ShieldCheck className="w-6 h-6" />
                {editingId ? "แก้ไขตำแหน่งและสิทธิ์" : "สร้างตำแหน่งใหม่"}
              </DialogTitle>
              <p className="text-blue-100 text-[11px] mt-1">
                กำหนดชื่อตำแหน่งและเลือกกุญแจสิทธิ์การใช้งาน
              </p>
            </div>
            <button
              onClick={() => setIsDialogOpen(false)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </DialogHeader>

          <form onSubmit={onSubmit} className="p-8 space-y-8">
            <div className="space-y-3">
              <Label className="font-bold text-foreground text-md">
                ชื่อตำแหน่ง (Role Name) <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="เช่น พนักงานคลังสินค้า, ฝ่ายจัดซื้อ"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ name: e.target.value });
                  setErrors((prev) => ({ ...prev, name: "" }));
                }}
                aria-invalid={!!errors.name}
                className="h-12 rounded-xl text-md bg-muted/50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950"
              />
              {errors.name && (
                <p className="text-red-500 text-xs font-medium mt-1">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border dark:border-slate-800">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                <h3 className="font-bold text-md text-foreground dark:text-slate-200">
                  เลือกกุญแจสิทธิ์ (Permissions) ให้พวงนี้
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {Object.keys(visiblePermissionGroups).length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-muted-foreground font-bold bg-muted/50 dark:bg-slate-900 rounded-2xl border border-dashed border-border dark:border-slate-800">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    ยังไม่มีสิทธิ์ในระบบ กรุณาไปสร้างในเมนู "สิทธิ์การใช้งาน"
                    ก่อนครับ
                  </div>
                ) : (
                  Object.keys(visiblePermissionGroups).map((groupName) => (
                    <div
                      key={groupName}
                      className="p-5 bg-muted/50 dark:bg-slate-900/50 rounded-2xl border border-border dark:border-slate-800"
                    >
                      <h4 className="font-bold text-sm text-foreground dark:text-slate-200 mb-4 flex items-center gap-2">
                        {getGroupIcon(permissionGroups[groupName])} {groupName}
                      </h4>
                      <div className="flex flex-col gap-2.5">
                        {visiblePermissionGroups[groupName].map((perm: any) => (
                          <label
                            key={perm.id}
                            className={cn(
                              "flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all select-none group",
                              selectedPermissions.includes(perm.name)
                                ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20"
                                : "bg-white dark:bg-slate-800 border-border dark:border-slate-700 text-muted-foreground hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm",
                            )}
                          >
                            <span className="text-sm font-bold tracking-wide">
                              {perm.title_th || perm.name}
                            </span>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={selectedPermissions.includes(perm.name)}
                              onChange={() => togglePermission(perm.name)}
                            />
                            {selectedPermissions.includes(perm.name) ? (
                              <CheckCheck className="w-5 h-5 text-white" />
                            ) : (
                              <div className="w-5 h-5 rounded-md border-2 border-border dark:border-slate-600 group-hover:border-blue-400 transition-colors"></div>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-6 border-t border-border dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              >
                <ArrowLeft className="w-4 h-4" /> ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}{" "}
                บันทึกตำแหน่งสิทธิ์
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AppConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        icon={AlertTriangle}
        iconColorClass="bg-red-50 text-red-600 border-red-100/50"
        title="ยืนยันการลบ?"
        description="ยืนยันการลบตำแหน่งนี้? (จะลบได้เมื่อไม่มีผู้ใช้งานเหลืออยู่)"
        confirmLabel={isDeletingRole ? "กำลังลบ..." : "ยืนยันลบ"}
        confirmColorClass="bg-red-600 hover:bg-red-700 shadow-red-600/20"
        onConfirm={executeDeleteRole}
        loading={isDeletingRole}
      />
    </div>
  );
}
