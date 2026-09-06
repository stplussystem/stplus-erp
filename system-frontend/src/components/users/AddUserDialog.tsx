"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { toast } from "sonner";
import {
  UserPlus,
  Loader2,
  ShieldCheck,
  X,
  CheckCheck,
  Package,
  ShoppingCart,
  Settings,
  FolderKey,
  Eye,
  EyeOff,
  Save,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";

const getGroupIcon = (groupName: string) => {
  if (groupName.includes("คลังสินค้า"))
    return <Package className="w-5 h-5 text-blue-600" />;
  if (groupName.includes("จัดซื้อ"))
    return <ShoppingCart className="w-5 h-5 text-blue-600" />;
  if (groupName.includes("ตั้งค่า") || groupName.includes("ระบบ"))
    return <Settings className="w-5 h-5 text-blue-600" />;
  return <FolderKey className="w-5 h-5 text-blue-600" />;
};

export default function AddUserDialog({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionGroups, setPermissionGroups] = useState<any>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    department_id: "",
  });

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // 🚀 เพิ่ม State สำหรับเก็บไฟล์และรูปพรีวิวลายเซ็น
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const clearError = (field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const fetchDependencies = async () => {
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const [dRes, pRes, rRes] = await Promise.all([
        fetch(`${apiUrl}/departments`, { headers }),
        fetch(`${apiUrl}/permissions`, { headers }),
        fetch(`${apiUrl}/roles`, { headers }),
      ]);

      if (dRes.ok) {
        const dData = await dRes.json();
        setDepartments(Array.isArray(dData) ? dData : dData.data || []);
      }
      if (pRes.ok) setPermissionGroups(await pRes.json());
      if (rRes.ok) {
        const rData = await rRes.json();
        setRolesList(Array.isArray(rData) ? rData : rData.data || []);
      }
    } catch (error) {
      console.error("Fetch dependencies error:", error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDependencies();
      setErrors({});
      // เคลียร์รูปเก่าทิ้งเมื่อเปิดหน้าต่างใหม่
      setSignatureFile(null);
      setSignaturePreview(null);
    }
  }, [open]);

  // 🚀 ฟังก์ชันจัดการเมื่อเลือกไฟล์รูปภาพลายเซ็น
  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        return toast.error("ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB ครับ");
      }
      setSignatureFile(file);
      setSignaturePreview(URL.createObjectURL(file));
    }
  };

  const toggleRole = (roleName: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleName)
        ? prev.filter((name) => name !== roleName)
        : [...prev, roleName],
    );
  };

  const togglePermission = (permName: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permName)
        ? prev.filter((name) => name !== permName)
        : [...prev, permName],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string[]> = {};
    if (!formData.name) newErrors.name = ["กรุณากรอกชื่อ-นามสกุล"];
    if (!formData.username) newErrors.username = ["กรุณากรอก Username"];
    if (!formData.email) newErrors.email = ["กรุณากรอกอีเมล"];
    if (!formData.password) newErrors.password = ["กรุณากรอกรหัสผ่าน"];
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = ["รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน"];
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      // 🚀 เปลี่ยนมาใช้ FormData สำหรับหน้า Add
      const bodyFormData = new FormData();
      bodyFormData.append("name", formData.name);
      bodyFormData.append("username", formData.username);
      bodyFormData.append("email", formData.email);
      bodyFormData.append("password", formData.password);

      if (formData.department_id) {
        bodyFormData.append("department_id", formData.department_id);
      } else {
        bodyFormData.append("department_id", "");
      }

      // แนบไฟล์รูปภาพ
      if (signatureFile) {
        bodyFormData.append("signature", signatureFile);
      }

      // แนบ Array ของสิทธิ์
      selectedRoles.forEach((role) => bodyFormData.append("roles[]", role));
      selectedPermissions.forEach((perm) =>
        bodyFormData.append("permissions[]", perm),
      );

      const res = await fetch(`${apiUrl}/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          // ❌ ไม่ใส่ Content-Type
        },
        body: bodyFormData,
      });

      if (res.ok) {
        toast.success("เพิ่มพนักงานสำเร็จ!");
        setFormData({
          name: "",
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
          department_id: "",
        });
        setSelectedRoles([]);
        setSelectedPermissions([]);
        setSignatureFile(null);
        setSignaturePreview(null);
        setOpen(false);
        onSuccess();
      } else if (res.status === 422) {
        const errData = await res.json();
        if (errData.errors) setErrors(errData.errors);
      } else {
        toast.error("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
      }
    } catch (error) {
      toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
          <UserPlus className="w-4 h-4" /> เพิ่มพนักงาน
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[750px] p-0 rounded-3xl overflow-hidden border-none shadow-2xl [&>button.absolute]:hidden">
        <div className="bg-blue-600 px-8 py-6 text-white flex justify-between items-center">
          <div>
            <DialogTitle className="text-md font-bold flex items-center gap-3">
              <UserPlus className="w-7 h-7" /> เพิ่มผู้ใช้งานใหม่
            </DialogTitle>
            <p className="text-blue-100 text-[11px] mt-1">
              กรอกข้อมูลบัญชี กำหนดบทบาทและสิทธิ์
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 pt-2 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
          <form
            id="add-user-form"
            onSubmit={handleSubmit}
            className="space-y-10"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b dark:border-slate-800 mt-6">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  ข้อมูลบัญชีผู้ใช้
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    ชื่อ-นามสกุล
                  </Label>
                  <Input
                    name="name"
                    autoComplete="name"
                    placeholder="สมชาย ใจดี"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      clearError("name");
                    }}
                    className={cn(
                      "rounded-xl h-11",
                      errors.name &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.name[0]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    Username
                  </Label>
                  <Input
                    name="username"
                    autoComplete="username"
                    placeholder="somchai_j"
                    value={formData.username}
                    onChange={(e) => {
                      setFormData({ ...formData, username: e.target.value });
                      clearError("username");
                    }}
                    className={cn(
                      "rounded-xl h-11",
                      errors.username &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                  />
                  {errors.username && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.username[0]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    อีเมล
                  </Label>
                  <Input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="somchai@stplus.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      clearError("email");
                    }}
                    className={cn(
                      "rounded-xl h-11",
                      errors.email &&
                        "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                    )}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.email[0]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    แผนก (Department)
                  </Label>
                  <AppSelect
                    value={formData.department_id || "__none__"}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        department_id: v === "__none__" ? "" : v,
                      })
                    }
                    options={[
                      { value: "__none__", label: "-- ไม่ระบุแผนก --" },
                      ...departments.map((dept) => ({
                        value: String(dept.id),
                        label: dept.name,
                      })),
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    รหัสผ่าน
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPwd ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        clearError("password");
                      }}
                      className={cn(
                        "rounded-xl h-11 pr-10",
                        errors.password &&
                          "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPwd ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.password[0]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    ยืนยันรหัสผ่าน
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPwd ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        });
                        clearError("confirmPassword");
                      }}
                      className={cn(
                        "rounded-xl h-11 pr-10",
                        errors.confirmPassword &&
                          "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPwd ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.confirmPassword[0]}
                    </p>
                  )}
                </div>

                {/* 🖋️ โซนอัปโหลดลายเซ็น */}
                <div className="space-y-3 md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-6 mt-2">
                  <Label className="text-xs font-bold text-slate-500">
                    ลายเซ็นดิจิทัลสำหรับเอกสาร (Digital Signature)
                  </Label>
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="w-44 h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden relative shadow-inner">
                      {signaturePreview ? (
                        <img
                          src={signaturePreview}
                          alt="Signature Preview"
                          className="max-w-full max-h-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          ยังไม่มีข้อมูลลายเซ็น
                        </span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2 mt-1">
                      <input
                        type="file"
                        accept="image/png, image/jpeg"
                        id="signature-file-upload-add"
                        className="hidden"
                        onChange={handleSignatureChange}
                      />
                      <label
                        htmlFor="signature-file-upload-add"
                        className="h-10 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer inline-flex select-none"
                      >
                        เลือกไฟล์ภาพลายเซ็น
                      </label>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        * รูปภาพควรกระชับและมีขนาดกว้างมากกว่าสูง <br />*
                        แนะนำอย่างยิ่งให้ใช้ **รูปพื้นหลังโปร่งใส (Transparent
                        PNG)**{" "}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex items-center gap-2 pb-2 border-b dark:border-slate-800">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  กำหนดบทบาทหลัก (Roles)
                </h3>
              </div>
              <div className="flex items-center gap-4 p-3 px-4">
                {rolesList.map((role) => (
                  <label
                    key={role.id}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors",
                      selectedRoles.includes(role.name)
                        ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
                        : "border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:border-slate-800",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.name)}
                      onChange={() => toggleRole(role.name)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {role.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex items-center gap-2 pb-2 border-b dark:border-slate-800">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  สิทธิ์การเข้าถึงเมนูย่อย (Direct Permissions)
                </h3>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                * ติ๊กเลือกเฉพาะสิทธิ์ที่ต้องการให้เพิ่มพิเศษ นอกเหนือจาก Roles
                ที่เลือกไว้ด้านบน
              </p>

              <div className="grid grid-cols-1 gap-6">
                {Object.keys(permissionGroups).length === 0 ? (
                  <p className="text-center py-4 text-slate-400 text-sm italic">
                    ยังไม่มีข้อมูลสิทธิ์ในระบบ
                  </p>
                ) : (
                  Object.keys(permissionGroups).map((groupName) => (
                    <div
                      key={groupName}
                      className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800"
                    >
                      <h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-500 mb-4 flex items-center gap-2">
                        {getGroupIcon(groupName)}
                        {groupName}
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {permissionGroups[groupName].map((perm: any) => (
                          <label
                            key={perm.id}
                            className={cn(
                              "flex items-center gap-2.5 p-3 px-4 rounded-xl border cursor-pointer transition-all select-none",
                              selectedPermissions.includes(perm.name)
                                ? "bg-blue-600 border-blue-600 text-white shadow-md scale-[1.02]"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:bg-blue-50",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={selectedPermissions.includes(perm.name)}
                              onChange={() => togglePermission(perm.name)}
                            />
                            {selectedPermissions.includes(perm.name) ? (
                              <CheckCheck className="w-4 h-4 text-white" />
                            ) : (
                              <ShieldCheck className="w-4 h-4 opacity-40" />
                            )}
                            <span className="text-sm font-bold">
                              {perm.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="p-8 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex gap-3 justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ยกเลิก
          </Button>
          <Button
            type="submit"
            form="add-user-form"
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>บันทึกข้อมูล</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
