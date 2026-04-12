"use client";
import React, { useState } from "react";
import { PackagePlus, Save, Plus, Trash2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SerialManager } from "./_components/SerialManager";
import { ProductSelector } from "@/components/products/ProductSelector";
// 💡 เพิ่ม Import สำหรับ Toast แจ้งเตือน
import { toast } from "sonner";
import { withToastPromise } from "@/lib/toast-helper";

export default function MultiStockInPage() {
  const [items, setItems] = useState([
    { id: 1, productId: "", qty: 1, serials: [""], isDialogOpen: false },
  ]);

  const addRow = () =>
    setItems([
      ...items,
      {
        id: Date.now(),
        productId: "",
        qty: 1,
        serials: [""],
        isDialogOpen: false,
      },
    ]);

  const updateItem = (id: number, field: string, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          if (field === "qty") {
            const safeQty = Math.max(1, value);
            const newSerials = Array.from(
              { length: safeQty },
              (_, i) => item.serials[i] || "",
            );
            return { ...item, qty: safeQty, serials: newSerials };
          }
          return { ...item, [field]: value };
        }
        return item;
      }),
    );
  };

  // 💡 พระเอกของงาน: ระบบบันทึกข้อมูลแบบหลายรายการ
  const handleSubmit = async () => {
    // 1. กรองเอาเฉพาะแถวที่มีการเลือกสินค้าแล้ว
    const validItems = items.filter((item) => item.productId !== "");

    if (validItems.length === 0) {
      toast.error("กรุณาเลือกสินค้าอย่างน้อย 1 รายการครับ");
      return;
    }

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    // 2. สร้างชุดคำสั่ง (Promises) เพื่อส่งข้อมูลทีละแถวไปหา Backend API ตัวเดิมที่เราทำไว้
    const promises = validItems.map((item) => {
      // กรองเอาเฉพาะ S/N ที่กรอกข้อมูลจริง (เผื่อช่องว่างไว้)
      const cleanSerials = item.serials.filter((s) => s.trim() !== "");

      return fetch(`${apiUrl}/stock-movements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          product_id: item.productId,
          type: "in",
          quantity: item.qty,
          reference_number: "", // อนาคตสามารถเพิ่มช่องเลขที่เอกสารแบบ Bulk ได้
          note: "รับเข้าแบบหลายรายการ (Bulk Mode)",
          serials: cleanSerials.length > 0 ? cleanSerials : [],
        }),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "เกิดข้อผิดพลาด");
        return json;
      });
    });

    // 3. ยิงข้อมูลทั้งหมดพร้อมกัน และแสดง Toast สวยๆ
    withToastPromise(Promise.all(promises), {
      loading: "กำลังบันทึกข้อมูลทั้งหมดเข้าคลัง...",
      success: "บันทึกรับเข้าคลังหลายรายการสำเร็จแล้ว! 🎉",
      error: (err) => `พบข้อผิดพลาด: ${err.message}`,
      onSuccessCallback: () => {
        // ล้างข้อมูลทั้งหมด กลับไปเป็น 1 แถวว่างๆ เหมือนตอนเริ่มต้น
        setItems([
          {
            id: Date.now(),
            productId: "",
            qty: 1,
            serials: [""],
            isDialogOpen: false,
          },
        ]);
      },
    });
  };

  return (
    <div className="max-w-4xl bg-white dark:bg-slate-900 border border-border rounded-2xl p-6 shadow-sm">
      <div className="max-w-4xl px-4 md:px-4 py-6 overflow-x-hidden">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30 text-green-600">
              <PackagePlus className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                รับเข้าสินค้าหลายรายการ
              </h1>
              <Badge
                variant="secondary"
                className="mt-1 text-[10px] bg-green-100 text-green-700 dark:bg-green-900/40 font-bold border-none"
              >
                BULK MODE
              </Badge>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-border rounded-2xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30">
              <TableRow className="border-border">
                <TableHead className="font-bold">
                  สินค้า (Product Selection)
                </TableHead>
                <TableHead className="w-[120px] text-center font-bold">
                  จำนวน
                </TableHead>
                <TableHead className="w-[200px] text-center font-bold">
                  Serial Numbers
                </TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-border align-top">
                  <TableCell className="py-5">
                    <div className="max-w-sm">
                      <ProductSelector
                        value={item.productId}
                        onChange={(val) =>
                          updateItem(item.id, "productId", val)
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <Input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "qty",
                          parseInt(e.target.value) || 1,
                        )
                      }
                      className="text-center font-bold h-10 border-slate-200 dark:border-slate-800"
                    />
                  </TableCell>
                  <TableCell className="py-5 text-center">
                    {/* 💡 ปรับปุ่มระบุ S/N ให้เป็น rounded-full */}
                    <Button
                      variant="outline"
                      onClick={() => updateItem(item.id, "isDialogOpen", true)}
                      className="cursor-pointer rounded-full gap-2 border-slate-200 dark:border-slate-800 text-xs font-bold h-10 px-4 hover:border-blue-500 hover:text-blue-600 transition-all"
                    >
                      <ScanLine className="w-4 h-4" strokeWidth={1.5} />
                      ระบุ S/N ({item.serials.filter((s) => s !== "").length}/
                      {item.qty})
                    </Button>

                    <SerialManager
                      isOpen={item.isDialogOpen}
                      onOpenChange={(open: boolean) =>
                        updateItem(item.id, "isDialogOpen", open)
                      }
                      qty={item.qty}
                      serials={item.serials}
                      onSerialChange={(idx: number, val: string) => {
                        const newSerials = [...item.serials];
                        newSerials[idx] = val;
                        updateItem(item.id, "serials", newSerials);
                      }}
                    />
                  </TableCell>
                  <TableCell className="py-5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setItems(items.filter((i) => i.id !== item.id))
                      }
                      className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full cursor-pointer transition-colors mt-1"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="p-6 bg-slate-50/30 dark:bg-slate-900/10 border-t border-border">
            {/* 💡 ปรับปุ่มเพิ่มรายการ ให้เป็น rounded-full */}
            <Button
              variant="outline"
              onClick={addRow}
              className="w-full py-8 border-dashed border-2 text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all cursor-pointer rounded-full font-bold gap-2 bg-white dark:bg-slate-950"
            >
              <Plus className="w-5 h-5" strokeWidth={2} /> เพิ่มรายการสินค้าใหม่
            </Button>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 h-12 rounded-full shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            <Save className="w-4 h-4 mr-2" /> บันทึกทั้งหมด
          </Button>
        </div>
      </div>
    </div>
  );
}
