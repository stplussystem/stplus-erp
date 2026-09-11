"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  AlertTriangle,
  Loader2,
  Settings,
  Copy,
  Pencil,
  Ellipsis,
} from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { usePermission } from "@/hooks/usePermission";

export default function ProductActions({ product }: { product: any }) {
  const router = useRouter();
  const canManage = usePermission("manage_products");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const proceedDelete = async () => {
    setIsDeleting(true);
    try {
      const token =
        getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const res = await fetch(`${apiUrl}/products/${product.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        toast.success("ลบสินค้าเรียบร้อยแล้ว");
        setIsDeleteOpen(false);
        // 🚀 สั่งให้ตารางในหน้าหลักรีเฟรชตัวเองอัตโนมัติ
        window.dispatchEvent(new Event("refreshProducts"));
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete product");
      }
    } catch (error: any) {
      console.error("Error deleting product:", error);
      toast.error(`ลบสินค้าไม่สำเร็จ: ${error.message || error}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
          >
            <span className="sr-only">เปิดเมนู</span>
            <Ellipsis className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[180px] whitespace-nowrap">
          <DropdownMenuLabel className="flex text-gray-900 text-xs">
            <Settings className="mr-2 h-4 w-4" /> จัดการสินค้า
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => navigator.clipboard.writeText(product.sku)}
            className="cursor-pointer"
          >
            <Copy className="mr-2 h-4 w-4" /> คัดลอก รหัสสินค้า
          </DropdownMenuItem>
          {canManage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link
                  href={`/products/${product.id}/edit`}
                  className="w-full flex items-center"
                >
                  <Pencil className="mr-2 h-4 w-4" /> แก้ไขข้อมูล
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsDeleteOpen(true)}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" /> ลบสินค้า
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 🚀 Dialog ลบสินค้า แบบ Clean White สไตล์ SaaS */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900 [&>button.absolute]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>ยืนยันการลบสินค้า</DialogTitle>
            <DialogDescription>
              สินค้าจะถูกลบออกจากระบบอย่างถาวรและไม่สามารถกู้คืนได้
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 flex flex-col items-center text-center space-y-5">
            <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-2 border-4 border-red-100 dark:border-red-900/30">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              ยืนยันการลบ?
            </h3>
            <p className="text-slate-500">
              ลบสินค้า{" "}
              <strong className="text-slate-800 dark:text-slate-200 text-lg">
                "{product.name}"
              </strong>{" "}
              ออกจากระบบ <br /> ข้อมูลนี้จะถูกลบถาวรและไม่สามารถกู้คืนได้
            </p>
          </div>
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-3 justify-center">
            <Button
              variant="outline"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeleting}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              onClick={proceedDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังลบ...</span>
                </div>
              ) : (
                "ยืนยันการลบ"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
