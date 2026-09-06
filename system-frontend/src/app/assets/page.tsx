"use client";

import React, { useEffect, useState } from "react";
import { Wrench, Plus, Edit, Trash2, Loader2, Save, User as UserIcon, BellRing } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/assets");
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
    fetchAssets();
    fetchUsers();
  }, []);

  const handleAddNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleEdit = (asset: any) => {
    setEditingId(asset.id);
    setFormData({
      name: asset.name,
      category: asset.category || "",
      serial_number: asset.serial_number || "",
      purchase_date: asset.purchase_date || "",
      responsible_user_id: asset.responsible_user_id ? String(asset.responsible_user_id) : "",
      status: asset.status || "active",
      next_maintenance_date: asset.next_maintenance_date || "",
      note: asset.note || "",
    });
    setErrors({});
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
      const payload = {
        ...formData,
        responsible_user_id: formData.responsible_user_id || null,
        purchase_date: formData.purchase_date || null,
        next_maintenance_date: formData.next_maintenance_date || null,
      };
      if (editingId) {
        await apiFetch(`/assets/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("อัปเดตข้อมูลสำเร็จ");
      } else {
        await apiFetch("/assets", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("เพิ่มสินทรัพย์ใหม่สำเร็จ");
      }
      setIsDialogOpen(false);
      fetchAssets();
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึก");
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

      <div className="bg-card rounded-3xl p-1 shadow-sm border border-border">
        <Table>
          <TableHeader className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold">ชื่อสินทรัพย์</TableHead>
              <TableHead className="font-bold">หมวดหมู่</TableHead>
              <TableHead className="font-bold">S/N</TableHead>
              <TableHead className="font-bold">ผู้รับผิดชอบ</TableHead>
              <TableHead className="font-bold">กำหนดบำรุงถัดไป</TableHead>
              <TableHead className="font-bold text-center">สถานะ</TableHead>
              <TableHead className="text-right font-bold w-[120px]">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40">
                  <AppLoading minHeight="min-h-0" />
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                  ยังไม่มีข้อมูลสินทรัพย์ กรุณากด &quot;เพิ่มสินทรัพย์&quot;
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id} className="hover:bg-muted/50">
                  <TableCell className="font-bold text-foreground">{asset.name}</TableCell>
                  <TableCell className="text-muted-foreground">{asset.category || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{asset.serial_number || "-"}</TableCell>
                  <TableCell>
                    {asset.responsible_user?.name ? (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <UserIcon className="w-3.5 h-3.5 text-muted-foreground" /> {asset.responsible_user.name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">- ไม่ระบุ -</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {asset.next_maintenance_date
                      ? new Date(asset.next_maintenance_date).toLocaleDateString("th-TH")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold border",
                        STATUS_LABEL[asset.status]?.className || "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {STATUS_LABEL[asset.status]?.label || asset.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
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
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
                <Input
                  placeholder="เช่น ยานพาหนะ, เครื่องมือช่าง"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="h-11 rounded-xl bg-muted/50 focus:bg-background"
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
