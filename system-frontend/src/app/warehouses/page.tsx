"use client";

import React, { useEffect, useState } from "react";
import { Store, Plus, MapPin, Edit, Trash2, Loader2, Save } from "lucide-react";
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
import { AppPagination } from "@/components/ui/app-pagination";
import { usePermission } from "@/hooks/usePermission";

export default function WarehousesPage() {
  const canManage = usePermission("manage_warehouses");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 🚀 เพิ่ม State สำหรับเก็บรายการชั้น (Floor) ที่เคยสร้างไว้
  const [existingFloors, setExistingFloors] = useState<string[]>([]);

  // State สำหรับควบคุม Popup Add/Edit
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // State สำหรับควบคุม Popup ยืนยันการลบ
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ข้อมูลฟอร์ม
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    floor: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/warehouses");
      const data = res || [];
      setWarehouses(data);

      // 🚀 สกัดเอาเฉพาะ "ชั้น" ที่ไม่ซ้ำกัน มาทำเป็นตัวเลือกให้ User
      const floors = data
        .map((wh: any) => wh.floor)
        .filter((f: any) => f && f.trim() !== "");
      setExistingFloors([...new Set(floors)] as string[]);
    } catch (error) {
      toast.error("ไม่สามารถโหลดข้อมูลคลังสินค้าได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  // เปิด Popup สำหรับสร้างใหม่
  const handleAddNew = () => {
    setEditingId(null);
    setFormData({ name: "", location: "", floor: "" });
    setErrors({});
    setIsDialogOpen(true);
  };

  // เปิด Popup สำหรับแก้ไข
  const handleEdit = (warehouse: any) => {
    setEditingId(warehouse.id);
    setFormData({
      name: warehouse.name,
      location: warehouse.location || "",
      floor: warehouse.floor || "", // ดึงชั้นมาโชว์ด้วย
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  // เปิด Popup ยืนยันการลบ
  const handleDelete = (warehouse: any) => {
    setDeleteTarget(warehouse);
    setIsDeleteDialogOpen(true);
  };

  // ลบข้อมูล
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/warehouses/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("ลบคลังสินค้าเรียบร้อยแล้ว");
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchWarehouses();
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setIsDeleting(false);
    }
  };

  // บันทึกฟอร์ม (Add & Edit)
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 🛡️ เดิมใช้แค่ HTML `required` ไม่ตาม pattern error state มาตรฐานของโปรเจกต์ (แดงกรอบ + ข้อความใต้ช่อง)
    if (!formData.name.trim()) {
      setErrors({ name: "กรุณากรอกชื่อคลังสินค้า" });
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      if (editingId) {
        // อัปเดต
        await apiFetch(`/warehouses/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(formData),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("อัปเดตข้อมูลสำเร็จ");
      } else {
        // สร้างใหม่
        await apiFetch("/warehouses", {
          method: "POST",
          body: JSON.stringify(formData),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("สร้างคลังสินค้าใหม่สำเร็จ");
      }
      setIsDialogOpen(false);
      fetchWarehouses();
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = Math.ceil(warehouses.length / itemsPerPage);
  const currentWarehouses = warehouses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <Store className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              จัดการคลังสินค้า
            </h1>
            <p className="text-slate-500 text-[11px]">
              เพิ่ม แก้ไข และดูรายชื่อคลังเก็บสินค้าทั้งหมด
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            onClick={handleAddNew}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            <Plus className="w-5 h-5 mr-1" /> เพิ่มคลังสินค้า
          </Button>
        )}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
        <Table>
          <TableHeader className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px] font-bold text-center">
                รหัส
              </TableHead>
              <TableHead className="font-bold">ชื่อคลังสินค้า</TableHead>
              <TableHead className="font-bold">ชั้น</TableHead>
              <TableHead className="font-bold">สถานที่ตั้ง / โซน</TableHead>
              <TableHead className="text-right font-bold w-[150px]">
                จัดการ
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40">
                  <AppLoading minHeight="min-h-0" />
                </TableCell>
              </TableRow>
            ) : warehouses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-40 text-center text-slate-500"
                >
                  ยังไม่มีข้อมูลคลังสินค้า กรุณากด "เพิ่มคลังสินค้า"
                </TableCell>
              </TableRow>
            ) : (
              currentWarehouses.map((wh) => (
                <TableRow
                  key={wh.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <TableCell className="text-center font-medium text-slate-500">
                    WH-{wh.id.toString().padStart(3, "0")}
                  </TableCell>
                  <TableCell className="font-bold text-blue-700 dark:text-blue-400">
                    {wh.name}
                  </TableCell>
                  <TableCell>
                    {wh.floor && (
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-300">
                        {wh.floor}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {wh.location ? (
                      <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />{" "}
                        {wh.location}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">
                        - ไม่ระบุสถานที่ -
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(wh)}
                          className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(wh)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AppPagination
        currentPage={currentPage}
        lastPage={totalPages || 1}
        total={warehouses.length}
        perPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-6 rounded-3xl border-none shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Store className="w-5 h-5 text-blue-600" />
              {editingId ? "แก้ไขข้อมูลคลังสินค้า" : "สร้างคลังสินค้าใหม่"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="font-bold ml-1 text-slate-700 dark:text-slate-300">
                ชื่อคลังสินค้า <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="เช่น คลังสินค้าหลัก, โกดัง A"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setErrors((prev) => ({ ...prev, name: "" }));
                }}
                className={cn(
                  "h-11 rounded-xl bg-slate-50/50 focus:bg-white",
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

            {/* 🚀 ระบบระบุชั้นแบบใหม่ พิมพ์เองได้ หรือกดเลือกจากประวัติได้! */}
            <div className="space-y-2">
              <Label className="font-bold ml-1 text-slate-700 dark:text-slate-300">
                ชั้น (Floor)
              </Label>
              <div className="flex flex-col gap-2">
                <Input
                  placeholder="เช่น ชั้น 1, Floor 2, ลานจอดรถ (พิมพ์อิสระ)"
                  value={formData.floor}
                  onChange={(e) =>
                    setFormData({ ...formData, floor: e.target.value })
                  }
                  className="h-11 rounded-xl bg-slate-50/50 focus:bg-white"
                />

                {/* ปุ่มลัด (Quick Select) ดึงมาจากข้อมูลที่มีอยู่แล้วในฐานข้อมูล */}
                {existingFloors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {existingFloors.map((floorName) => (
                      <button
                        key={floorName}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, floor: floorName })
                        }
                        className={cn(
                          "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer",
                          formData.floor === floorName
                            ? "bg-blue-200 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800",
                        )}
                      >
                        {floorName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold ml-1 text-slate-700 dark:text-slate-300">
                สถานที่ตั้ง / โซน
              </Label>
              <Input
                placeholder="เช่น ชั้น 2 ตึก B, เชียงใหม่"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="h-11 rounded-xl bg-slate-50/50 focus:bg-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                onClick={() => setIsDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                บันทึกข้อมูล
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-8 text-center bg-white border-0 shadow-2xl [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-100/50">
              <Trash2 className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-800 tracking-tight">
              ยืนยันการลบคลังสินค้า?
            </DialogTitle>
            <p className="text-slate-500 text-sm leading-relaxed px-4">
              คุณต้องการลบคลังสินค้า{" "}
              <span className="font-bold text-slate-800">
                {deleteTarget?.name}
              </span>{" "}
              ใช่หรือไม่? เมื่อลบแล้วจะไม่สามารถกู้คืนได้
            </p>
            <div className="flex justify-center gap-3 w-full mt-6 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
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
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "ยืนยันการลบ"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
