"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  User,
  ShieldCheck,
  Camera,
  Loader2,
  Save,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
  X,
  PenTool, // 🚀 นำเข้า Icon เพิ่มสำหรับลายเซ็น
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppLoading } from "@/components/ui/app-loading";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getToken } from "@/lib/auth-storage";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("info");
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // --- State สำหรับจัดการรูปโปรไฟล์ (Avatar) ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [isDeleteAvatarDialogOpen, setIsDeleteAvatarDialogOpen] =
    useState(false);

  // 🚀 --- State สำหรับจัดการรูปลายเซ็น (Signature) ---
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  // --- State สำหรับเปลี่ยนรหัสผ่าน ---
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdValues, setPwdValues] = useState({ newPwd: "", confirmPwd: "" });

  const getAuthHeader = () => {
    const token = getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "security") {
      setActiveTab("security");
    }
  }, []);

  const fetchUser = async () => {
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/user`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setUserData(data);

        // จัดการ URL ของรูปโปรไฟล์ (ถ้าเก็บแบบ relative ให้ต่อ String เพิ่ม)
        if (data.avatar) {
          const isUrl = data.avatar.startsWith("http");
          const baseUrl = apiUrl.replace("/api", "");
          setAvatarPreview(
            isUrl ? data.avatar : `${baseUrl}/storage/${data.avatar}`,
          );
        } else {
          setAvatarPreview(null);
        }

        // 🚀 จัดการพรีวิวรูปลายเซ็น
        if (data.signature_path) {
          const baseUrl = apiUrl.replace("/api", "");
          setSignaturePreview(`${baseUrl}/storage/${data.signature_path}`);
        } else {
          setSignaturePreview(null);
        }

        setSignatureFile(null); // ล้างไฟล์ที่ค้างอยู่ตอนโหลดสำเร็จ
      }
    } catch (error) {
      toast.error("ดึงข้อมูลผู้ใช้ไม่สำเร็จ");
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleInstantAvatarUpload = async (file: File) => {
    setIsAvatarLoading(true);
    const tId = toast.loading("กำลังอัปโหลดรูปโปรไฟล์...");
    setAvatarPreview(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append("name", userData.name);
      formData.append("phone", userData.phone || "");
      formData.append("avatar", file);
      formData.append("_method", "POST");

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/user/profile-update`, {
        method: "POST",
        headers: getAuthHeader(), // ลบ Content-Type ออกให้เป็นแบบ Multi-part
        body: formData,
      });

      if (res.ok) {
        toast.success("เปลี่ยนรูปโปรไฟล์เรียบร้อย!", { id: tId });
        fetchUser();
      } else {
        toast.error("อัปโหลดรูประบบไม่สำเร็จ", { id: tId });
        fetchUser(); // ดึงรูปเก่ากลับมา
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: tId });
      fetchUser();
    } finally {
      setIsAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleInstantAvatarDelete = async () => {
    setIsAvatarLoading(true);
    const tId = toast.loading("กำลังลบรูปโปรไฟล์...");

    try {
      const formData = new FormData();
      formData.append("name", userData.name);
      formData.append("phone", userData.phone || "");
      formData.append("remove_avatar", "1");
      formData.append("_method", "POST");

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/user/profile-update`, {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      });

      if (res.ok) {
        toast.success("ลบรูปโปรไฟล์ออกจากระบบแล้ว!", { id: tId });
        setAvatarPreview(null);
        fetchUser();
        setIsDeleteAvatarDialogOpen(false);
      } else {
        toast.error("ลบรูประบบไม่สำเร็จ", { id: tId });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: tId });
    } finally {
      setIsAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdateTextProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const tId = toast.loading("กำลังบันทึกข้อมูลส่วนตัว...");

    try {
      const formData = new FormData();
      formData.append("name", userData.name);
      formData.append("phone", userData.phone || "");

      // 🚀 แนบไฟล์ลายเซ็นไปพร้อมกับชื่อเลย (ถ้ามีการเลือกไฟล์ใหม่)
      if (signatureFile) {
        formData.append("signature", signatureFile);
      }

      formData.append("_method", "POST");

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/user/profile-update`, {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      });

      if (res.ok) {
        toast.success("บันทึกข้อมูลส่วนตัวเรียบร้อย", { id: tId });
        fetchUser();
      } else {
        const err = await res.json();
        toast.error(`บันทึกไม่สำเร็จ: ${err.message || "เกิดข้อผิดพลาด"}`, {
          id: tId,
        });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ", { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdValues.newPwd !== pwdValues.confirmPwd) {
      toast.error("รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง!");
      return;
    }
    if (pwdValues.newPwd.length < 8) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setIsSavingPwd(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/user/change-password`, {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          password: pwdValues.newPwd,
          password_confirmation: pwdValues.confirmPwd,
        }),
      });

      if (res.ok) {
        toast.success("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว!");
        setPwdValues({ newPwd: "", confirmPwd: "" });
      } else {
        const err = await res.json();
        toast.error(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setIsSavingPwd(false);
    }
  };

  return (
    <div className="p-6 px-4 py-2 w-full max-w-full mx-auto space-y-6 antialiased font-sans">
      {/* 🚀 Popup ยืนยันการลบรูปโปรไฟล์ */}
      <Dialog
        open={isDeleteAvatarDialogOpen}
        onOpenChange={setIsDeleteAvatarDialogOpen}
      >
        <DialogContent className="max-w-sm rounded-3xl p-8 text-center bg-card border-0 shadow-2xl [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-100/50">
              <Trash2 className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
              ลบรูปโปรไฟล์?
            </DialogTitle>
            <p className="text-muted-foreground text-sm leading-relaxed px-4">
              คุณต้องการลบรูปถ่ายโปรไฟล์ปัจจุบัน <br />
              และกลับไปใช้รูปเริ่มต้นใช่หรือไม่?
            </p>
            <div className="flex justify-center gap-3 w-full mt-6 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl border-border hover:bg-muted/50 text-muted-foreground font-semibold cursor-pointer"
                onClick={() => setIsDeleteAvatarDialogOpen(false)}
                disabled={isAvatarLoading}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 font-semibold cursor-pointer"
                onClick={handleInstantAvatarDelete}
                disabled={isAvatarLoading}
              >
                {isAvatarLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "ยืนยันการลบ"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground mx-auto space-y-6 antialiased">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              จัดการข้อมูลส่วนตัว
            </h1>
            <p className="text-muted-foreground text-[11px]">
              จัดการข้อมูลส่วนตัวของคุณ เช่น ชื่อ เบอร์โทรศัพท์ ลายเซ็น
              และรหัสผ่าน
            </p>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-muted dark:bg-slate-800 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("info")}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === "info"
                ? "bg-white dark:bg-slate-900 shadow-sm text-blue-600"
                : "text-muted-foreground",
            )}
          >
            <User className="w-4 h-4" /> ข้อมูลส่วนตัว
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === "security"
                ? "bg-white dark:bg-slate-900 shadow-sm text-blue-600"
                : "text-muted-foreground",
            )}
          >
            <ShieldCheck className="w-4 h-4" /> ความปลอดภัย
          </button>
        </div>

        {activeTab === "info" ? (
          <Card className=" overflow-hidden border border-border dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none relative p-0">
            <div className="bg-muted text-foreground p-4 flex items-center gap-3 relative z-1">
              <User className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                แก้ไขข้อมูลส่วนตัว
              </h3>
            </div>

            <CardContent className="p-8 relative z-1">
              {!userData ? (
                <AppLoading text="กำลังโหลดข้อมูลส่วนตัว..." minHeight="py-20" />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                  {/* 🟢 คอลัมน์ซ้าย: จัดการรูปภาพ Avatar (Instant Upload) */}
                  <div className="lg:col-span-1 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-border dark:border-slate-800 pb-8 lg:pb-0 lg:pr-8">
                    <div
                      className="relative group cursor-pointer w-44 h-44 rounded-full flex-shrink-0"
                      onClick={() =>
                        !isAvatarLoading && fileInputRef.current?.click()
                      }
                    >
                      {avatarPreview && (
                        <button
                          type="button"
                          className="absolute 1 top-0 right-0 h-8 w-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white cursor-pointer z-30 transition-transform active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsDeleteAvatarDialogOpen(true);
                          }}
                          title="ลบรูปโปรไฟล์"
                          disabled={isAvatarLoading}
                        >
                          <X className="h-4 w-4 stroke-[3]" />
                        </button>
                      )}

                      <div className="w-full h-full rounded-full overflow-hidden border-4 border-border dark:border-slate-800 shadow-xl bg-muted/50 dark:bg-slate-900 flex items-center justify-center relative">
                        {isAvatarLoading && (
                          <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/70 flex items-center justify-center z-20 backdrop-blur-sm">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                          </div>
                        )}

                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            className="w-full h-full block object-cover relative z-10"
                            alt="Profile"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-muted-foreground relative z-10">
                            <User className="w-12 h-12 mb-2 opacity-40" />
                            <span className="text-[11px] font-bold">
                              ยังไม่มีรูปถ่าย
                            </span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2 z-20">
                          <Camera className="text-white w-8 h-8" />
                          <span className="text-white text-[11px] font-bold">
                            {avatarPreview ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                          </span>
                        </div>
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 1024 * 1024) {
                              toast.error("ขนาดไฟล์รูปภาพต้องไม่เกิน 1MB ครับ");
                              if (fileInputRef.current)
                                fileInputRef.current.value = "";
                              return;
                            }
                            handleInstantAvatarUpload(file);
                          }
                        }}
                      />
                    </div>
                    <div className="text-center mt-6">
                      <p className="text-[11px] text-muted-foreground font-medium">
                        แนะนำไฟล์ภาพขนาดไม่เกิน 1MB
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium mt-1">
                        และแนะนำให้เปลี่ยนรหัสผ่านทุกๆ 3 เดือน <br />
                        เพื่อความปลอดภัยสูงสุดของข้อมูลในระบบ
                      </p>
                    </div>
                  </div>

                  {/* 🔵 คอลัมน์ขวา: ฟอร์มข้อมูลส่วนตัว และลายเซ็น */}
                  <div className="lg:col-span-2 flex flex-col justify-between h-full">
                    <form
                      onSubmit={handleUpdateTextProfile}
                      className="space-y-8"
                    >
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4" /> ข้อมูลระบบ
                          (ไม่อนุญาตให้แก้ไข)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">
                              Username
                            </label>
                            <Input
                              disabled
                              value={userData.username || "-"}
                              className="rounded-xl h-12 bg-muted dark:bg-slate-900/50 border-border text-muted-foreground cursor-not-allowed font-medium"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">
                              อีเมล (Email)
                            </label>
                            <Input
                              disabled
                              value={userData.email || "-"}
                              className="rounded-xl h-12 bg-muted dark:bg-slate-900/50 border-border text-muted-foreground cursor-not-allowed font-medium"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">
                              แผนก (Department)
                            </label>
                            <Input
                              disabled
                              value={userData.department?.name || "-"}
                              className="rounded-xl h-12 bg-muted dark:bg-slate-900/50 border-border text-muted-foreground cursor-not-allowed font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-6 border-t dark:border-slate-800">
                        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                          <User className="w-4 h-4" /> ข้อมูลทั่วไป (แก้ไขได้)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">
                              ชื่อ-นามสกุล
                            </label>
                            <Input
                              required
                              name="name"
                              autoComplete="name"
                              value={userData.name}
                              onChange={(e) =>
                                setUserData({
                                  ...userData,
                                  name: e.target.value,
                                })
                              }
                              className="rounded-xl h-12 bg-white dark:bg-slate-950"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">
                              เบอร์โทรศัพท์ติดต่อ
                            </label>
                            <Input
                              name="phone"
                              autoComplete="tel"
                              value={userData.phone || ""}
                              onChange={(e) =>
                                setUserData({
                                  ...userData,
                                  phone: e.target.value,
                                })
                              }
                              className="rounded-xl h-12 bg-white dark:bg-slate-950"
                              placeholder="เช่น 081-XXX-XXXX"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 🖋️ [NEW] โซนอัปโหลดลายเซ็น */}
                      <div className="space-y-4 pt-6 border-t dark:border-slate-800">
                        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                          <PenTool className="w-4 h-4" /> ลายเซ็นดิจิทัล
                          (Digital Signature)
                        </h4>
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                          <div className="w-44 h-24 border-2 border-dashed border-border dark:border-slate-700 rounded-2xl flex items-center justify-center bg-muted/50 dark:bg-slate-900 overflow-hidden relative shadow-inner">
                            {signaturePreview ? (
                              <img
                                src={signaturePreview}
                                alt="Signature Preview"
                                className="max-w-full max-h-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground font-medium">
                                ยังไม่มีข้อมูลลายเซ็น
                              </span>
                            )}
                          </div>
                          <div className="flex-1 space-y-2 mt-1">
                            <input
                              type="file"
                              accept="image/png, image/jpeg"
                              id="profile-signature-upload"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  const file = e.target.files[0];
                                  if (file.size > 2 * 1024 * 1024) {
                                    return toast.error(
                                      "ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB ครับ",
                                    );
                                  }
                                  setSignatureFile(file);
                                  setSignaturePreview(
                                    URL.createObjectURL(file),
                                  );
                                }
                              }}
                            />
                            <label
                              htmlFor="profile-signature-upload"
                              className="h-10 px-4 bg-muted hover:bg-muted dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-border dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer inline-flex select-none"
                            >
                              เลือกไฟล์ภาพลายเซ็น
                            </label>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              * รูปภาพจะถูกบันทึกเมื่อคุณกดปุ่ม{" "}
                              <b>"บันทึกการเปลี่ยนแปลง"</b> ด้านล่าง <br />*
                              แนะนำให้ใช้ **รูปพื้นหลังโปร่งใส (Transparent
                              PNG)**
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full cursor-pointer p-4 sm:w-auto bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-10 gap-2 font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 text-white"
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}{" "}
                          บันทึกการเปลี่ยนแปลง
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className=" overflow-hidden border border-border dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none relative p-0">
            <div className="bg-muted text-foreground p-4 flex items-center gap-3 relative z-1">
              <ShieldCheck className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                ความปลอดภัยของบัญชี
              </h3>
            </div>

            <CardContent className="p-8 relative z-1">
              {!userData ? (
                <AppLoading text="กำลังโหลดข้อมูลส่วนตัว..." minHeight="py-20" />
              ) : (
                <div className="max-w-md mx-auto space-y-6">
                  <div className="text-center space-y-2 mb-10">
                    <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-200 dark:border-amber-800">
                      <ShieldCheck className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-xl font-black">เปลี่ยนรหัสผ่านใหม่</h3>
                    <p className="text-muted-foreground text-sm">
                      กรุณากรอกรหัสผ่านใหม่ที่มีความยาวอย่างน้อย 8 ตัวอักษร
                      เพื่อความปลอดภัย
                    </p>
                  </div>

                  <form
                    onSubmit={handleSavePassword}
                    className="space-y-6 relative z-1"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">
                        รหัสผ่านใหม่
                      </label>
                      <div className="relative">
                        <Input
                          type={showNewPwd ? "text" : "password"}
                          autoComplete="new-password"
                          value={pwdValues.newPwd}
                          onChange={(e) =>
                            setPwdValues({
                              ...pwdValues,
                              newPwd: e.target.value,
                            })
                          }
                          placeholder="••••••••"
                          required
                          className="rounded-xl h-12 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPwd(!showNewPwd)}
                          className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                        >
                          {showNewPwd ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">
                        ยืนยันรหัสผ่านใหม่
                      </label>
                      <div className="relative">
                        <Input
                          type={showConfirmPwd ? "text" : "password"}
                          autoComplete="new-password"
                          value={pwdValues.confirmPwd}
                          onChange={(e) =>
                            setPwdValues({
                              ...pwdValues,
                              confirmPwd: e.target.value,
                            })
                          }
                          placeholder="••••••••"
                          required
                          className={cn(
                            "rounded-xl h-12 pr-10",
                            pwdValues.confirmPwd &&
                              pwdValues.newPwd !== pwdValues.confirmPwd &&
                              "border-red-500 bg-red-50 focus-visible:ring-red-500 dark:bg-red-950/20",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                          className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                        >
                          {showConfirmPwd ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      {pwdValues.confirmPwd &&
                        pwdValues.newPwd !== pwdValues.confirmPwd && (
                          <p className="text-red-500 dark:text-red-400 text-xs font-bold mt-1.5 ml-1">
                            รหัสผ่านที่กรอกไม่ตรงกัน กรุณาตรวจสอบ
                          </p>
                        )}
                    </div>

                    <div className="pt-0 text-center">
                      <Button
                        type="submit"
                        disabled={isSavingPwd}
                        className="w-full cursor-pointer p-4 sm:w-auto bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-10 gap-2 font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 text-white"
                      >
                        {isSavingPwd ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>กำลังอัปเดตรหัสผ่านใหม่...</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <KeyRound className="w-4 h-4" />
                            <span>อัปเดตรหัสผ่านใหม่</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
