"use client";
import { useState } from "react";
import {
  PackagePlus,
  Save,
  Plus,
  Trash2,
  ScanLine,
  Loader2,
  PackageMinus,
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
import { ProductSelector } from "@/components/products/ProductSelector";
import { toast } from "sonner";
import { withToastPromise } from "@/lib/toast-helper";
import { cn } from "@/lib/utils";
import { SerialManager } from "@/app/stock/in/multi/_components/SerialManager";

type MultiStockFormProps = {
  mode?: "in" | "out";
};

export default function MultiStockMovementForm({
  mode = "in",
}: MultiStockFormProps) {
  const [items, setItems] = useState([
    {
      id: 1,
      productId: "",
      qty: 1,
      serials: [""],
      isDialogOpen: false,
      hasSerialNumber: true,
    },
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
        hasSerialNumber: true,
      },
    ]);

  const updateItem = (
    id: number,
    field: string,
    value: any,
    extraData?: any,
  ) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          if (field === "productId") {
            const needsSn = extraData?.has_serial_number ?? true;
            return {
              ...item,
              productId: value,
              hasSerialNumber: needsSn,
              serials: [""],
            };
          }
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

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const validItems = items.filter((item) => item.productId !== "");

    if (validItems.length === 0) {
      toast.error("กรุณาเลือกสินค้าอย่างน้อย 1 รายการครับ");
      return;
    }

    const incompleteItems = validItems.filter((item) => {
      if (!item.hasSerialNumber) return false;
      const validSnCount = item.serials.filter((s) => s.trim() !== "").length;
      return validSnCount !== item.qty;
    });

    if (incompleteItems.length > 0) {
      toast.error(
        "กรุณาระบุ Serial Number ให้ครบก่อนบันทึกครับ (ปุ่มต้องเป็นสีเขียว)",
      );
      return;
    }

    // 💡 สั่งให้เริ่มหมุนโหลดตรงนี้ครับ
    setLoading(true);

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    const promises = validItems.map((item) => {
      const cleanSerials = item.serials.filter((s) => s.trim() !== "");
      return fetch(`${apiUrl}/stock-movements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          product_id: item.productId,
          type: mode,
          quantity: item.qty,
          reference_number: "",
          note:
            mode === "in"
              ? "รับเข้าแบบหลายรายการ (Bulk Mode)"
              : "เบิกออกแบบหลายรายการ (Bulk Mode)",
          serials:
            item.hasSerialNumber && cleanSerials.length > 0 ? cleanSerials : [],
        }),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "เกิดข้อผิดพลาด");
        return json;
      });
    });

    withToastPromise(Promise.all(promises), {
      loading: "กำลังบันทึกข้อมูลทั้งหมด...",
      success: "บันทึกข้อมูลหลายรายการสำเร็จแล้ว!",
      error: (err) => {
        setLoading(false); // 💡 หยุดโหลดถ้ามี Error
        return `พบข้อผิดพลาด: ${err.message}`;
      },
      onSuccessCallback: () => {
        setLoading(false); // 💡 หยุดโหลดเมื่อสำเร็จ
        setItems([
          {
            id: Date.now(),
            productId: "",
            qty: 1,
            serials: [""],
            isDialogOpen: false,
            hasSerialNumber: true,
          },
        ]);
      },
    });
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          {/* 💡 Icon Container: สลับสีพื้นหลังและขอบตาม mode */}
          <div
            className={cn(
              "p-2.5 rounded-xl border transition-colors",
              mode === "in"
                ? "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30 text-green-600"
                : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600",
            )}
          >
            {/* 💡 สลับไอคอนตาม mode */}
            {mode === "in" ? (
              <PackagePlus className="w-8 h-8" strokeWidth={1.5} />
            ) : (
              <PackageMinus className="w-8 h-8" strokeWidth={1.5} />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "in"
                ? "รับเข้าสินค้าหลายรายการ"
                : "เบิกออกสินค้าหลายรายการ"}
            </h1>

            {/* 💡 Badge: สลับสีตาม mode */}
            <Badge
              variant="secondary"
              className={cn(
                "mt-1 text-[10px] font-bold border-none transition-colors",
                mode === "in"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40",
              )}
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
            {items.map((item) => {
              const validSnCount = item.serials.filter(
                (s) => s.trim() !== "",
              ).length;
              const isSnComplete = validSnCount === item.qty;

              return (
                <TableRow key={item.id} className="border-border align-top">
                  <TableCell className="py-5">
                    <div className="max-w-sm">
                      <ProductSelector
                        value={item.productId}
                        onChange={(val, extraData) =>
                          updateItem(item.id, "productId", val, extraData)
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
                      className="text-center font-bold h-10"
                    />
                  </TableCell>
                  <TableCell className="py-5 text-center">
                    {!item.productId ? (
                      <span className="text-slate-400 text-xs font-medium">
                        กรุณาเลือกสินค้า
                      </span>
                    ) : !item.hasSerialNumber ? (
                      <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-500 hover:bg-slate-100 shadow-none border-none"
                      >
                        ไม่ต้องระบุ S/N
                      </Badge>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() =>
                            updateItem(item.id, "isDialogOpen", true)
                          }
                          className={cn(
                            "cursor-pointer rounded-full gap-2 text-xs font-bold h-10 px-4 transition-all border-2",
                            isSnComplete
                              ? "border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 bg-green-50/50"
                              : "border-red-400 text-red-500 hover:bg-red-50 hover:text-red-600 bg-red-50/50",
                          )}
                        >
                          <ScanLine className="w-4 h-4" />
                          ระบุ S/N ({validSnCount}/{item.qty})
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
                      </>
                    )}
                  </TableCell>
                  <TableCell className="py-5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setItems(items.filter((i) => i.id !== item.id))
                      }
                      className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full cursor-pointer mt-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="p-6 bg-slate-50/30 border-t border-border">
          <Button
            variant="outline"
            onClick={addRow}
            className="w-full py-8 border-dashed border-2 text-slate-400 hover:text-blue-600 hover:border-blue-600 cursor-pointer rounded-full font-bold gap-2"
          >
            <Plus className="w-5 h-5" /> เพิ่มรายการสินค้าใหม่
          </Button>
        </div>
      </div>

      {/* 💡 พระเอกของเราอยู่ตรงนี้ครับ ปุ่ม Save แบบสวยๆ */}
      <div className="flex justify-end pt-6">
        <Button
          onClick={handleSubmit}
          className={cn(
            "min-w-[180px] px-8 h-12 rounded-full shadow-lg cursor-pointer transition-all text-white font-bold flex items-center justify-center gap-2",
            mode === "in"
              ? "bg-green-600 hover:bg-green-700 shadow-green-600/20 active:scale-95"
              : "bg-red-600 hover:bg-red-700 shadow-red-600/20 active:scale-95",
          )}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}

          {loading
            ? "กำลังบันทึก..."
            : mode === "in"
              ? "บันทึกรับเข้าคลังทั้งหมด"
              : "บันทึกเบิกออกทั้งหมด"}
        </Button>
      </div>
    </div>
  );
}
