"use client";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Image, ImageOff } from "lucide-react";

export default function ProductImageDialog({
  imageUrl,
  productName,
}: {
  imageUrl: string | null;
  productName: string;
}) {
  // ถ้าสินค้าไม่มีรูปภาพ ให้แสดงไอคอน "ไม่มีรูป" สีเทาๆ
  if (!imageUrl) {
    return (
      <span className="text-slate-300 flex justify-center">
        <ImageOff className="w-5 h-5" />
      </span>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <span
          role="button" // บอกให้ระบบรู้ว่าคลิกได้
          className="flex justify-center items-center cursor-pointer text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors hover:scale-110"
        >
          <Image className="w-5 h-5" />
        </span>
      </DialogTrigger>
      {/* ตั้งค่า Pop-up ให้กว้างพอดีรูป และไม่ตัดคำตามที่พี่แม็คต้องการ */}
      <DialogContent className="sm:max-w-md flex flex-col items-center justify-center p-6 whitespace-nowrap">
        <DialogTitle className="text-lg font-bold mb-2">
          {productName}
        </DialogTitle>
        <div className="relative w-full flex justify-center bg-slate-50 rounded-md p-4 border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={productName}
            className="max-w-full h-auto max-h-[60vh] object-contain rounded-md shadow-sm"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
