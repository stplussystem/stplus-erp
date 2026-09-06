"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { toast } from "sonner";
import {
  Edit2,
  Loader2,
  ShieldCheck,
  X,
  CheckCheck,
  Package,
  ShoppingCart,
  Settings,
  FolderKey,
  Save,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken, getUserRaw } from "@/lib/auth-storage";

const getGroupIcon = (groupName: string) => {
  if (groupName.includes("คลังสินค้า"))
    return <Package className="w-5 h-5 text-blue-600" />;
  if (groupName.includes("จัดซื้อ"))
    return <ShoppingCart className="w-5 h-5 text-blue-600" />;
  if (groupName.includes("ตั้งค่า") || groupName.includes("ระบบ"))
    return <Settings className="w-5 h-5 text-blue-600" />;
  return <FolderKey className="w-5 h-5 text-blue-600" />;
};

interface EditUserDialogProps {
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  departments: any[];
  rolesList: any[];
  permissionGroups: any;
}

export default function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
  departments,
  rolesList,
  permissionGroups,
}: EditUserDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department_id: "",
  });
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 🚀 เพิ่ม State สำหรับเก็บไฟล์และรูปพรีวิวลายเซ็น
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  // เก็บข้อมูลคนล็อกอิน
  const [loggedInUser, setLoggedInUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = getUserRaw();
    if (storedUser) setLoggedInUser(JSON.parse(storedUser));
  }, []);

  useEffect(() => {
    if (user && open) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        department_id: user.department_id ? String(user.department_id) : "",
      });
      setSelectedRoles(user.roles?.map((r: any) => r.name) || []);
      setSelectedPermissions(user.permissions?.map((p: any) => p.name) || []);

      // 🚀 ดึงประวัติรูปลายเซ็นเดิมมาโชว์พรีวิว (ถ้ามี)
      if (user.signature_path) {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
          "http://127.0.0.1:8000";
        setSignaturePreview(`${baseUrl}/storage/${user.signature_path}`);
      } else {
        setSignaturePreview(null);
      }
      setSignatureFile(null); // ล้างไฟล์เก่าที่เลือกค้างไว้
    }
  }, [user, open]);

  // ตัวแปรเช็คว่า "กำลังแก้ไขข้อมูลของตัวเองอยู่หรือไม่" (isSelf)
  const isSelf = user && loggedInUser && user.id === loggedInUser.user?.id;

  // 🚀 ฟังก์ชันจัดการเมื่อเลือกไฟล์รูปภาพลายเซ็น
  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // บังคับขนาดไม่เกิน 2MB เพื่อเซฟพื้นที่เซิร์ฟเวอร์
      if (file.size > 2 * 1024 * 1024) {
        return toast.error("ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB ครับ");
      }

      setSignatureFile(file);
      setSignaturePreview(URL.createObjectURL(file)); // สร้าง Object URL ให้เห็นภาพทันที
    }
  };

  const toggleRole = (roleName: string) => {
    if (isSelf) return; // ล็อคไม่ให้กดถ้าเป็นตัวเอง
    setSelectedRoles((prev) =>
      prev.includes(roleName)
        ? prev.filter((r) => r !== roleName)
        : [...prev, roleName],
    );
  };

  const togglePermission = (permName: string) => {
    if (isSelf) return; // ล็อคไม่ให้กดถ้าเป็นตัวเอง
    setSelectedPermissions((prev) =>
      prev.includes(permName)
        ? prev.filter((p) => p !== permName)
        : [...prev, permName],
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = "กรุณากรอกชื่อ-นามสกุล";
    if (!formData.email) newErrors.email = "กรุณากรอกอีเมล";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validate()) return;
    setLoading(true);

    const token = getToken();
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    try {
      // 🚀 เปลี่ยนมาใช้ FormData เพื่อส่งไฟล์รูปภาพข้ามฝั่ง
      const bodyFormData = new FormData();
      bodyFormData.append("name", formData.name);
      bodyFormData.append("email", formData.email);
      if (formData.department_id) {
        bodyFormData.append("department_id", formData.department_id);
      } else {
        bodyFormData.append("department_id", "");
      }

      // 🚀 แปะไฟล์รูปภาพลายเซ็นแนบไปด้วยถ้ามีการกดอัปโหลดใหม่
      if (signatureFile) {
        bodyFormData.append("signature", signatureFile);
      }

      // ถ้า "ไม่ใช่ตัวเอง" ถึงจะส่งข้อมูลสิทธิ์ไปอัปเดต
      if (!isSelf) {
        selectedRoles.forEach((role) => bodyFormData.append("roles[]", role));
        selectedPermissions.forEach((perm) =>
          bodyFormData.append("permissions[]", perm),
        );
      }

      // ⚠️ ทริคแก้บั๊กในตำนานของ Laravel: ส่งไฟล์ต้องเป็น POST แล้วใช้ฟิลด์ _method แฝงตัวเป็น PUT
      bodyFormData.append("_method", "PUT");

      const res = await fetch(`${apiUrl}/users/${user.id}`, {
        method: "POST", // สลับมาใช้ POST แทน PUT
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          // ❌ ไม่ใส่ Content-Type เพื่อปล่อยให้ระบบสร้าง Boundary แยกร่างไฟล์ออโต้
        },
        body: bodyFormData,
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("อัปเดตข้อมูลผู้ใช้งานและลายเซ็นเรียบร้อยแล้ว");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (error) {
      toast.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl p-0 border-none shadow-2xl [&>button.absolute]:hidden bg-white dark:bg-slate-950 flex flex-col">
        {/* --- ส่วนหัว Header --- */}
        <div className="bg-blue-600 px-8 py-6 text-white flex flex-row justify-between items-center z-20 shadow-sm shrink-0">
          <div>
            <DialogTitle className="text-md font-bold flex items-center gap-3 text-white">
              <Edit2 className="w-6 h-6" />
              แก้ไขข้อมูลผู้ใช้งาน
            </DialogTitle>
            <p className="text-blue-100 text-[11px] mt-1">
              ปรับปรุงรายละเอียด สิทธิ์การเข้าถึง และลายเซ็นดิจิทัลในระบบ
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* --- ส่วนเนื้อหาฟอร์ม --- */}
        <div className="overflow-y-auto flex-1 pb-10 custom-scrollbar">
          <form
            id="edit-user-form"
            onSubmit={handleSubmit}
            className="p-8 space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="font-bold text-slate-700 dark:text-slate-300">
                  ชื่อ-นามสกุล <span className="text-red-500">*</span>
                </Label>
                <Input
                  name="name"
                  autoComplete="name"
                  placeholder="ระบุชื่อ-นามสกุล"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  aria-invalid={!!errors.name}
                  className={cn(
                    "h-12 rounded-xl bg-slate-50 dark:bg-slate-900",
                    errors.name &&
                      "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                  )}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs font-medium mt-1">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="font-bold text-slate-700 dark:text-slate-300">
                  อีเมล <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  aria-invalid={!!errors.email}
                  className={cn(
                    "h-12 rounded-xl bg-slate-50 dark:bg-slate-900",
                    errors.email &&
                      "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                  )}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs font-medium mt-1">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label className="font-bold text-slate-700 dark:text-slate-300">
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
                    ...(departments || []).map((dept: any) => ({
                      value: String(dept.id),
                      label: dept.name,
                    })),
                  ]}
                />
              </div>

              {/* 🖋️ [NEW] เพิ่มกล่องอัปโหลดลายเซ็นดิจิทัล เข้าสู่ฟอร์มหลัก */}
              <div className="space-y-3 md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-6 mt-2">
                <Label className="font-bold text-slate-700 dark:text-slate-300">
                  ลายเซ็นดิจิทัลสำหรับเอกสาร (Digital Signature)
                </Label>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {/* กรอบสี่เหลี่ยมโชว์ภาพลายเซ็น */}
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

                  {/* ฝั่งปุ่มกดเลือกรูปและคำแนะนำ */}
                  <div className="flex-1 space-y-2 mt-1">
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      id="signature-file-upload"
                      className="hidden"
                      onChange={handleSignatureChange}
                    />
                    <label
                      htmlFor="signature-file-upload"
                      className="h-10 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer inline-flex select-none"
                    >
                      เลือกไฟล์ภาพลายเซ็น
                    </label>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      * รูปภาพควรกระชับและมีขนาดกว้างมากกว่าสูง <br />*
                      แนะนำอย่างยิ่งให้ใช้ **รูปพื้นหลังโปร่งใส (Transparent
                      PNG)**
                      เพื่อให้ลายเซ็นแสดงผลได้เนียนตาสวยงามเมื่อประทับลงใบสั่งซื้อ
                      (PO) และใบรับสินค้า (GR)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- ส่วนกำหนด Roles --- */}
            <div className="space-y-4 mt-6">
              <div className="flex items-center gap-2 pb-2 border-b dark:border-slate-800">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  กำหนดบทบาทหลัก (Roles)
                </h3>
                {isSelf && (
                  <span className="ml-2 text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 rounded-full font-bold">
                    ไม่อนุญาตให้แก้ไขสิทธิ์ของตัวเอง
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 p-3 px-4">
                {rolesList?.map((role) => {
                  const isChecked = selectedRoles.includes(role.name);
                  return (
                    <label
                      key={role.id}
                      className={cn(
                        "flex items-center gap-3 p-3 border rounded-xl transition-all",
                        isSelf
                          ? "opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50"
                          : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800",
                        !isSelf && isChecked
                          ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
                          : "border-slate-200 dark:border-slate-800",
                        isSelf &&
                          isChecked &&
                          "border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800",
                      )}
                    >
                      <input
                        type="checkbox"
                        disabled={isSelf}
                        checked={isChecked}
                        onChange={() => toggleRole(role.name)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                      />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {role.name.replace(/\s*\(C\d+\)/, "")}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* --- ส่วนกำหนด Permissions --- */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b dark:border-slate-800">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  สิทธิ์การใช้งานเพิ่มเติม (Permissions)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {Object.keys(permissionGroups || {}).length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-slate-400">
                    ไม่มีข้อมูลสิทธิ์
                  </div>
                ) : (
                  Object.keys(permissionGroups).map((groupName) => (
                    <div
                      key={groupName}
                      className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-800"
                    >
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        {getGroupIcon(groupName)} {groupName}
                      </h4>
                      <div className="flex flex-col gap-2">
                        {permissionGroups[groupName].map((perm: any) => {
                          const isChecked = selectedPermissions.includes(
                            perm.name,
                          );
                          return (
                            <label
                              key={perm.id}
                              className={cn(
                                "flex items-center gap-2.5 p-3 px-4 rounded-xl border transition-all select-none",
                                isSelf
                                  ? "opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50"
                                  : "cursor-pointer hover:border-blue-400 dark:hover:border-blue-500",
                                !isSelf && isChecked
                                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300",
                                isSelf &&
                                  isChecked &&
                                  "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="hidden"
                                disabled={isSelf}
                                checked={isChecked}
                                onChange={() => togglePermission(perm.name)}
                              />
                              {isChecked ? (
                                <CheckCheck
                                  className={cn(
                                    "w-4 h-4",
                                    isSelf ? "text-blue-500" : "text-white",
                                  )}
                                />
                              ) : (
                                <ShieldCheck className="w-4 h-4 opacity-40 text-slate-500" />
                              )}
                              <span className="text-sm font-bold">
                                {perm.title_th || perm.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </form>
        </div>

        {/* --- ส่วนปุ่มกดยืนยัน Footer --- */}
        <div className="p-8 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex gap-3 justify-center shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ยกเลิก
          </Button>
          <Button
            type="submit"
            form="edit-user-form"
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}{" "}
            บันทึกแล้วปิด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
