"use client";
import React, { useState } from "react";
import {
  PackagePlus,
  Save,
  Plus,
  Trash2,
  ScanLine,
  Search,
} from "lucide-react";
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
import { SerialManager } from "./_components/SerialManager"; // 💡 Import คอมโพเนนต์แยก

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

  return (
    <div className="w-full max-w-full px-4 md:px-4 py-6 overflow-x-hidden">
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30 text-green-600">
            <PackagePlus className="w-6 h-6" strokeWidth={1.5} />
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
        <Button className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-blue-600/20">
          <Save className="w-4 h-4 mr-2" /> บันทึกทั้งหมด
        </Button>
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
                  <div className="relative max-w-sm">
                    <Search
                      className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"
                      strokeWidth={1.5}
                    />
                    <Input
                      placeholder="ค้นหาหรือสแกนสินค้า..."
                      className="pl-9 h-10 border-slate-200 dark:border-slate-800 cursor-pointer bg-white dark:bg-slate-900"
                    />
                    <p className="text-[10px] text-slate-400 mt-2 ml-1 italic">
                      * ค้นหาหรือกด Space เพื่อดูรายการ
                    </p>
                  </div>
                </TableCell>
                <TableCell className="py-5">
                  <Input
                    type="number"
                    value={item.qty}
                    onChange={(e) =>
                      updateItem(item.id, "qty", parseInt(e.target.value) || 1)
                    }
                    className="text-center font-bold h-10 border-slate-200 dark:border-slate-800"
                  />
                </TableCell>
                <TableCell className="py-5 text-center">
                  <Button
                    variant="outline"
                    onClick={() => updateItem(item.id, "isDialogOpen", true)}
                    className="cursor-pointer gap-2 border-slate-200 dark:border-slate-800 text-xs font-bold h-10 px-4 hover:border-blue-500 hover:text-blue-600 transition-all"
                  >
                    <ScanLine className="w-4 h-4" strokeWidth={1.5} />
                    ระบุ S/N ({item.serials.filter((s) => s !== "").length}/
                    {item.qty})
                  </Button>

                  {/* 💡 เรียกใช้คอมโพเนนต์แยก */}
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
                    className="text-slate-300 hover:text-red-500 cursor-pointer transition-colors mt-1"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="p-6 bg-slate-50/30 dark:bg-slate-900/10 border-t border-border">
          <Button
            variant="outline"
            onClick={addRow}
            className="w-full py-8 border-dashed border-2 text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all cursor-pointer rounded-2xl font-bold gap-2 bg-white dark:bg-slate-950"
          >
            <Plus className="w-4 h-4" strokeWidth={2} /> เพิ่มรายการสินค้าใหม่
          </Button>
        </div>
      </div>
    </div>
  );
}
