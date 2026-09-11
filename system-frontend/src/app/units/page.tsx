"use client";

import React, { useEffect, useState } from "react";
import { Scale, Plus, Edit, Trash2, Loader2, Save } from "lucide-react";
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

// 🚀 มิเรอร์ pattern เดียวกับ product-categories/page.tsx / warehouses/page.tsx เป๊ะ — เดิมหน่วยนับเพิ่มได้
// แค่ทาง combobox "+ เพิ่ม..." ในหน้าสร้างสินค้า ไม่มีหน้าจัดการ/แก้ไข/ลบเลย
export default function UnitsPage() {
  const canManage = usePermission("manage_units");
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({ name: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/units");
      setUnits(res || []);
    } catch (error) {
      toast.error("ไม่สามารถโหลดข้อมูลหน่วยนับได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({ name: "" });
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleEdit = (unit: any) => {
    setEditingId(unit.id);
    setFormData({ name: unit.name });
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleDelete = (unit: any) => {
    setDeleteTarget(unit);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/units/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("ลบหน่วยนับเรียบร้อยแล้ว");
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchUnits();
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrors({ name: "กรุณากรอกชื่อหน่วยนับ" });
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/units/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(formData),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("อัปเดตข้อมูลสำเร็จ");
      } else {
        await apiFetch("/units", {
          method: "POST",
          body: JSON.stringify(formData),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("สร้างหน่วยนับใหม่สำเร็จ");
      }
      setIsDialogOpen(false);
      fetchUnits();
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = Math.ceil(units.length / itemsPerPage);
  const currentUnits = units.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <Scale className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              จัดการหน่วยนับ
            </h1>
            <p className="text-muted-foreground text-[11px]">
              เพิ่ม แก้ไข และดูรายชื่อหน่วยนับทั้งหมด
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            onClick={handleAddNew}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            <Plus className="w-5 h-5 mr-1" /> เพิ่มหน่วยนับ
          </Button>
        )}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-1 shadow-sm border border-border dark:border-slate-800">
        <Table>
          <TableHeader className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px] font-bold text-center">
                รหัส
              </TableHead>
              <TableHead className="font-bold">ชื่อหน่วยนับ</TableHead>
              <TableHead className="text-right font-bold w-[150px]">
                จัดการ
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-40">
                  <AppLoading minHeight="min-h-0" />
                </TableCell>
              </TableRow>
            ) : units.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-40 text-center text-muted-foreground"
                >
                  ยังไม่มีข้อมูลหน่วยนับ กรุณากด "เพิ่มหน่วยนับ"
                </TableCell>
              </TableRow>
            ) : (
              currentUnits.map((unit) => (
                <TableRow
                  key={unit.id}
                  className="hover:bg-muted/50 dark:hover:bg-slate-800/50"
                >
                  <TableCell className="text-center font-medium text-muted-foreground">
                    UNIT-{unit.id.toString().padStart(3, "0")}
                  </TableCell>
                  <TableCell className="font-bold text-blue-700 dark:text-blue-400">
                    {unit.name}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(unit)}
                          className="text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(unit)}
                          className="text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
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
        total={units.length}
        perPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-6 rounded-3xl border-none shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground dark:text-slate-100">
              <Scale className="w-5 h-5 text-blue-600" />
              {editingId ? "แก้ไขข้อมูลหน่วยนับ" : "สร้างหน่วยนับใหม่"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="font-bold ml-1 text-foreground">
                ชื่อหน่วยนับ <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="เช่น ชิ้น, กล่อง, เมตร"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setErrors((prev) => ({ ...prev, name: "" }));
                }}
                className={cn(
                  "h-11 rounded-xl bg-muted/50 focus:bg-background",
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

            <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-slate-800">
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
        <DialogContent className="max-w-sm rounded-3xl p-8 text-center bg-card border-0 shadow-2xl [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-100/50">
              <Trash2 className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
              ยืนยันการลบหน่วยนับ?
            </DialogTitle>
            <p className="text-muted-foreground text-sm leading-relaxed px-4">
              คุณต้องการลบหน่วยนับ{" "}
              <span className="font-bold text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              ใช่หรือไม่? สินค้าที่เคยผูกหน่วยนับนี้จะกลายเป็น "ไม่ระบุหน่วยนับ" — เมื่อลบแล้วจะไม่สามารถกู้คืนได้
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
