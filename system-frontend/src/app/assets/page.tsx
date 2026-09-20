"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Wrench,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Save,
  User as UserIcon,
  BellRing,
  Search,
  RefreshCw,
  Coins,
  Boxes,
  Camera,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AppLoading } from "@/components/ui/app-loading";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { usePermission } from "@/hooks/usePermission";
import { GroupComboboxField } from "@/components/permissions/GroupComboboxField";

const MAX_PHOTOS = 4;
const MAX_PHOTO_SIZE = 1024 * 1024; // 1MB

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "ใช้งานปกติ", className: "bg-green-50 text-green-600 border-green-200" },
  maintenance: { label: "กำลังซ่อมบำรุง", className: "bg-amber-50 text-amber-600 border-amber-200" },
  retired: { label: "เลิกใช้งาน", className: "bg-muted/50 text-muted-foreground border-border" },
};

const emptyForm = {
  name: "",
  category: "",
  serial_number: "",
  purchase_date: "",
  price: "",
  responsible_user_id: "",
  status: "active",
  next_maintenance_date: "",
  note: "",
};

export default function AssetsPage() {
  const canManage = usePermission("manage_assets");
  const [assets, setAssets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔍 searchInput = ข้อความที่พิมพ์ในช่อง (ยังไม่ค้นหา), search = คำค้นที่กด Enter แล้วจริง (ใช้ยิง API)
  // แยกกันกันไม่ให้ยิง request ทุกครั้งที่พิมพ์ — เหมือน reports/inventory-valuation
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // 🏷️ หมวดหมู่เป็น string ตรงบนตาราง assets — ตัวเลือกมาจากหมวดที่เคยใช้กับสินทรัพย์ทั้งหมด + หมวดที่เพิ่งพิมพ์เพิ่มในฟอร์ม
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [existingPhotos, setExistingPhotos] = useState<{ id: number; photo_url: string }[]>([]);
  const [removePhotoIds, setRemovePhotoIds] = useState<number[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch("/assets");
      const names = new Set<string>();
      (res || []).forEach((a: any) => a.category && names.add(a.category));
      setCategoryOptions(Array.from(names).sort((a, b) => a.localeCompare(b, "th")));
    } catch (error) {
      // ไม่ critical — combobox ยังพิมพ์หมวดใหม่ได้ตามปกติ
    }
  };

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiFetch(`/assets?${params}`);
      setAssets(res || []);
    } catch (error) {
      toast.error("ไม่สามารถโหลดข้อมูลสินทรัพย์ได้");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch("/users");
      setUsers(res?.data || res || []);
    } catch (error) {
      // ไม่ critical — ถ้าไม่มีสิทธิ์ดูรายชื่อผู้ใช้ ให้ dropdown ว่างไว้เฉยๆ
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
  };

  const totalValue = assets.reduce((sum, a) => sum + Number(a.price || 0), 0);

  const resetPhotoState = () => {
    setExistingPhotos([]);
    setRemovePhotoIds([]);
    setPhotoFiles([]);
    setPhotoPreviews([]);
  };

  const totalPhotoCount = existingPhotos.length - removePhotoIds.length + photoFiles.length;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const accepted: File[] = [];
    for (const file of files) {
      if (totalPhotoCount + accepted.length >= MAX_PHOTOS) {
        toast.error(`แนบรูปได้สูงสุด ${MAX_PHOTOS} รูป`);
        break;
      }
      if (file.size > MAX_PHOTO_SIZE) {
        toast.error(`ไฟล์ "${file.name}" มีขนาดใหญ่เกินไป`, {
          description: "กรุณาอัปโหลดไฟล์ขนาดไม่เกิน 1MB ครับ",
        });
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) {
      setPhotoFiles((prev) => [...prev, ...accepted]);
      setPhotoPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
    }
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removeNewPhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setErrors({});
    resetPhotoState();
    setIsDialogOpen(true);
  };

  const handleEdit = (asset: any) => {
    setEditingId(asset.id);
    setFormData({
      name: asset.name,
      category: asset.category || "",
      serial_number: asset.serial_number || "",
      purchase_date: asset.purchase_date || "",
      price: asset.price != null ? String(asset.price) : "",
      responsible_user_id: asset.responsible_user_id ? String(asset.responsible_user_id) : "",
      status: asset.status || "active",
      next_maintenance_date: asset.next_maintenance_date || "",
      note: asset.note || "",
    });
    setErrors({});
    resetPhotoState();
    setExistingPhotos(asset.photos || []);
    setIsDialogOpen(true);
  };

  const handleDelete = (asset: any) => {
    setDeleteTarget(asset);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/assets/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("ลบสินทรัพย์เรียบร้อยแล้ว");
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchAssets();
      fetchCategories();
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrors({ name: "กรุณากรอกชื่อสินทรัพย์" });
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", formData.name);
      fd.append("category", formData.category);
      fd.append("serial_number", formData.serial_number);
      fd.append("purchase_date", formData.purchase_date);
      fd.append("price", formData.price);
      fd.append("responsible_user_id", formData.responsible_user_id);
      fd.append("status", formData.status);
      fd.append("next_maintenance_date", formData.next_maintenance_date);
      fd.append("note", formData.note);
      photoFiles.forEach((file) => fd.append("photos[]", file));
      removePhotoIds.forEach((id) => fd.append("remove_photo_ids[]", String(id)));

      // ส่งเป็น multipart (มีไฟล์รูป) — Laravel อ่าน PUT+multipart ไม่ได้ จึงใช้ POST + _method=PUT
      if (editingId) {
        fd.append("_method", "PUT");
        await apiFetch(`/assets/${editingId}`, { method: "POST", body: fd });
        toast.success("อัปเดตข้อมูลสำเร็จ");
      } else {
        await apiFetch("/assets", { method: "POST", body: fd });
        toast.success("เพิ่มสินทรัพย์ใหม่สำเร็จ");
      }
      setIsDialogOpen(false);
      fetchAssets();
      fetchCategories();
    } catch (error: any) {
      const firstError = error?.errors ? (Object.values(error.errors)[0] as string[])?.[0] : null;
      toast.error(firstError || error.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">ทะเบียนสินทรัพย์ถาวร</h1>
            <p className="text-muted-foreground text-[11px]">
              รายการทรัพย์สินของบริษัท (เครื่องมือ/อุปกรณ์/ยานพาหนะ) พร้อมกำหนดบำรุงรักษา
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Link
            href="/reports/asset-maintenance-due"
            className="flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
          >
            <BellRing className="w-4 h-4" /> ใกล้ครบกำหนดบำรุง
          </Link>
          {canManage && (
            <Button
              onClick={handleAddNew}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
            >
              <Plus className="w-5 h-5 mr-1" /> เพิ่มสินทรัพย์
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-72">
              <label className="block text-xs font-medium text-muted-foreground mb-1">ค้นหาสินทรัพย์</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ชื่อสินทรัพย์, S/N, ผู้รับผิดชอบ..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
                  className="pl-9 h-10 bg-background border-border rounded-xl text-sm"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">สถานะ</label>
              <AppSelect
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={[
                  { value: "all", label: "สถานะทั้งหมด" },
                  { value: "active", label: "ใช้งานปกติ" },
                  { value: "maintenance", label: "กำลังซ่อมบำรุง" },
                  { value: "retired", label: "เลิกใช้งาน" },
                ]}
              />
            </div>
            <button
              onClick={clearFilters}
              className="h-10 px-4 flex items-center justify-center gap-2 text-foreground bg-background border border-border hover:bg-muted rounded-xl text-sm font-medium transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
            </button>
          </div>

          {!loading && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-lg">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground leading-none">จำนวนสินทรัพย์</div>
                  <div className="text-base font-black text-foreground leading-tight">
                    {assets.length.toLocaleString()} รายการ
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-lg">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground leading-none">มูลค่าสินทรัพย์รวม</div>
                  <div className="text-base font-black text-foreground leading-tight">
                    ฿{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <AppLoading />
        ) : (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">ชื่อสินทรัพย์</th>
                  <th className="px-6 py-4 font-bold">หมวดหมู่</th>
                  <th className="px-6 py-4 font-bold">S/N</th>
                  <th className="px-6 py-4 font-bold">ผู้รับผิดชอบ</th>
                  <th className="px-6 py-4 font-bold text-right">มูลค่า/ราคา</th>
                  <th className="px-6 py-4 font-bold">กำหนดบำรุงถัดไป</th>
                  <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                  {canManage && <th className="px-6 py-4 font-bold text-right w-[120px]">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 7} className="py-16 text-center text-muted-foreground">
                      {search || statusFilter !== "all"
                        ? "ไม่พบสินทรัพย์ตามเงื่อนไขที่เลือก"
                        : "ยังไม่มีข้อมูลสินทรัพย์ กรุณากด \"เพิ่มสินทรัพย์\""}
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">
                        <div className="flex items-center gap-3">
                          {asset.photos?.length > 0 && (
                            <a
                              href={asset.photos[0].photo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative shrink-0"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={asset.photos[0].photo_url}
                                alt={asset.name}
                                className="w-10 h-10 rounded-lg object-cover border border-border"
                              />
                              {asset.photos.length > 1 && (
                                <span className="absolute -bottom-1 -right-1 bg-black/70 text-white text-[9px] font-bold rounded-full px-1.5">
                                  +{asset.photos.length - 1}
                                </span>
                              )}
                            </a>
                          )}
                          {asset.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{asset.category || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{asset.serial_number || "-"}</td>
                      <td className="px-6 py-4">
                        {asset.responsible_user?.name ? (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <UserIcon className="w-3.5 h-3.5 text-muted-foreground" /> {asset.responsible_user.name}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">- ไม่ระบุ -</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        {asset.price != null
                          ? `฿${Number(asset.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {asset.next_maintenance_date
                          ? new Date(asset.next_maintenance_date).toLocaleDateString("th-TH")
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            STATUS_LABEL[asset.status]?.className || "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {STATUS_LABEL[asset.status]?.label || asset.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <AppTooltip label="แก้ไข">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(asset)}
                                className="text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-xl cursor-pointer"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </AppTooltip>
                            <AppTooltip label="ลบ">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(asset)}
                                className="text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AppTooltip>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-6 rounded-3xl border-none shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Wrench className="w-5 h-5 text-blue-600" />
              {editingId ? "แก้ไขข้อมูลสินทรัพย์" : "เพิ่มสินทรัพย์ใหม่"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="font-bold ml-1 text-foreground">
                ชื่อสินทรัพย์ <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="เช่น รถกระบะขนของ, สว่านไฟฟ้า"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setErrors((prev) => ({ ...prev, name: "" }));
                }}
                className={cn(
                  "h-11 rounded-xl bg-muted/50 focus:bg-background",
                  errors.name && "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100",
                )}
              />
              {errors.name && <p className="text-red-500 text-xs font-medium mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold ml-1 text-foreground">หมวดหมู่</Label>
                <GroupComboboxField
                  value={formData.category}
                  onChange={(v) => {
                    setFormData({ ...formData, category: v });
                    setCategoryOptions((prev) => (v && !prev.includes(v) ? [...prev, v] : prev));
                  }}
                  options={categoryOptions}
                  placeholder="เลือก/พิมพ์หมวดหมู่ใหม่"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold ml-1 text-foreground">เลข Serial / ทะเบียน</Label>
                <Input
                  placeholder="เช่น กข-1234, SN-00123"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  className="h-11 rounded-xl bg-muted/50 focus:bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold ml-1 text-foreground">วันที่ซื้อ</Label>
                <AppDatePicker
                  value={formData.purchase_date}
                  onChange={(v) => setFormData({ ...formData, purchase_date: v })}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold ml-1 text-foreground">กำหนดบำรุงถัดไป</Label>
                <AppDatePicker
                  value={formData.next_maintenance_date}
                  onChange={(v) => setFormData({ ...formData, next_maintenance_date: v })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold ml-1 text-foreground">มูลค่า/ราคาสินทรัพย์ (บาท)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="h-11 rounded-xl bg-muted/50 focus:bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold ml-1 text-foreground">ผู้รับผิดชอบ</Label>
                <AppSelect
                  value={formData.responsible_user_id || "none"}
                  onValueChange={(v) => setFormData({ ...formData, responsible_user_id: v === "none" ? "" : v })}
                  options={[
                    { value: "none", label: "- ไม่ระบุ -" },
                    ...users.map((u: any) => ({ value: String(u.id), label: u.name })),
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold ml-1 text-foreground">สถานะ</Label>
                <AppSelect
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                  options={[
                    { value: "active", label: "ใช้งานปกติ" },
                    { value: "maintenance", label: "กำลังซ่อมบำรุง" },
                    { value: "retired", label: "เลิกใช้งาน" },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold ml-1 text-foreground">หมายเหตุ</Label>
              <Input
                placeholder="หมายเหตุเพิ่มเติม"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="h-11 rounded-xl bg-muted/50 focus:bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-bold ml-1 text-foreground">
                รูปภาพ (สูงสุด {MAX_PHOTOS} รูป ไม่เกิน 1MB/รูป)
              </Label>
              <div className="flex flex-wrap gap-3">
                {existingPhotos
                  .filter((p) => !removePhotoIds.includes(p.id))
                  .map((p) => (
                    <div key={p.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.photo_url} alt="รูปสินทรัพย์" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setRemovePhotoIds((prev) => [...prev, p.id])}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-black/80"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                {photoPreviews.map((src, i) => (
                  <div key={src} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`รูปใหม่ ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewPhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-black/80"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {totalPhotoCount < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-blue-500 transition-all cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px]">เพิ่มรูป</span>
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                multiple
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                onClick={() => setIsDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-2" />}
                บันทึกข้อมูล
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-8 text-center bg-card border-0 shadow-2xl [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-100/50">
              <Trash2 className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">ยืนยันการลบสินทรัพย์?</DialogTitle>
            <p className="text-muted-foreground text-sm leading-relaxed px-4">
              คุณต้องการลบสินทรัพย์{" "}
              <span className="font-bold text-foreground">{deleteTarget?.name}</span> ใช่หรือไม่?
              เมื่อลบแล้วจะไม่สามารถกู้คืนได้
            </p>
            <div className="flex justify-center gap-3 w-full mt-6 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeleteTarget(null);
                }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-800 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                onClick={confirmDelete}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "ยืนยันการลบ"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
