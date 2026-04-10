"use client";
import { useRouter } from "next/navigation";
import { Settings, Pencil, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { withToastPromise } from "@/lib/toast-helper";
import { useState } from "react";
import EditProductDialog from "@/components/products/EditProductDialog";

// รับข้อมูลสินค้า 1 แถวเข้ามาจากตาราง
export default function ProductActions({ product }: { product: any }) {
  const router = useRouter();
  // State ไว้ควบคุมการเปิด/ปิดหน้าต่างยืนยันการลบ
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  // State สำหรับเปิด/ปิดหน้าแก้ไข
  const [showEditDialog, setShowEditDialog] = useState(false);

  // ฟังก์ชันลบสินค้า
  const handleDelete = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    const deletePromise = fetch(`${apiUrl}/products/${product.id}`, {
      method: "DELETE",
    }).then(async (res) => {
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    });

    withToastPromise(deletePromise, {
      loading: "กำลังลบข้อมูล...",
      success: "ลบสินค้าเรียบร้อยแล้ว!",
      error: "เกิดข้อผิดพลาดในการลบสินค้า",
      onSuccessCallback: () => {
        router.refresh();
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* 1. เติมคำว่า group ลงไปใน className ของ Button ครับ */}
          <Button
            variant="ghost"
            className="group h-8 w-8 p-0 hover:bg-slate-100 cursor-pointer"
          >
            <span className="sr-only">เปิดเมนู</span>
            {/* 2. เปลี่ยนคำว่า hover:rotate-90 เป็น group-hover:rotate-90 ครับ */}
            <Settings className="h-5 w-5 text-slate-500 transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110" />
          </Button>
        </DropdownMenuTrigger>
        {/* เติม w-auto และ whitespace-nowrap เพื่อให้กล่องขยายตามข้อความและไม่ตกบรรทัดครับ */}
        <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
          <DropdownMenuLabel className="text-gray-900 text-[14px]">
            จัดการสินค้า
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => navigator.clipboard.writeText(product.sku)}
            className="cursor-pointer"
          >
            <Copy className="mr-2 h-4 w-4" /> คัดลอก รหัสสินค้า
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowEditDialog(true)}
            className="cursor-pointer"
          >
            <Pencil className="mr-2 h-4 w-4" /> แก้ไขข้อมูล
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* 2. เปลี่ยนให้ปุ่มลบ สั่งเปิดโชว์ Alert Dialog แทนการเรียกลบทันที */}
          <DropdownMenuItem
            onClick={() => setShowDeleteAlert(true)}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" /> ลบสินค้า
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Component EditProductDialog ไว้ตรงนี้ (มันจะซ่อนตัวอยู่จนกว่า showEditDialog = true) */}
      <EditProductDialog
        product={product}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      {/* หน้าต่างยืนยันการลบแบบ Modern (จะโผล่มาเมื่อโหมด showDeleteAlert เป็น true) */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบสินค้า?</AlertDialogTitle>
            <AlertDialogDescription>
              คุณกำลังจะลบสินค้า{" "}
              <b>
                {product.name} (รหัสสินค้า: {product.sku})
              </b>{" "}
              ออกจากระบบ การกระทำนี้ไม่สามารถย้อนกลับได้ คุณแน่ใจหรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* ปุ่มยกเลิก ระบบจะปิดหน้าต่างให้เองอัตโนมัติ */}
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            {/* ปุ่มยืนยันสีแดง ให้เรียกคำสั่ง handleDelete */}
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
