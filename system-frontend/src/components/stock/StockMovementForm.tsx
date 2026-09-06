"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppSelect } from "@/components/ui/app-select";
import {
  ChevronsUpDown,
  Check,
  Trash2,
  Barcode,
  Save,
  Loader2,
  PackagePlus,
  PackageMinus,
  Search,
  AlertCircle,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { withToastPromise } from "@/lib/toast-helper";
import SubmitButton from "../ui/SubmitButton";
import { getToken } from "@/lib/auth-storage";

type StockMovementFormProps = {
  mode: "in" | "out";
};

export default function StockMovementForm({ mode }: StockMovementFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const isStockIn = mode === "in";

  const [products, setProducts] = useState<any[]>([]);
  const [openProduct, setOpenProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchProduct, setSearchProduct] = useState("");

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  const [quantity, setQuantity] = useState(1);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const [serials, setSerials] = useState<string[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");

  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const fetchProducts = useCallback(
    async (query: string) => {
      if (!query) return;
      setIsFetching(true);
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const token =
        getToken();

      try {
        const res = await fetch(
          `${apiUrl}/products?search=${query}&per_page=20`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (res.ok) {
          const json = await res.json();
          const inventoryProducts = json.data.filter(
            (p: any) =>
              p.product_type === "inventory" || p.product_type === "rental",
          );
          setProducts(inventoryProducts);

          const exactMatch = inventoryProducts.find(
            (p: any) => p.barcode === query || p.sku === query,
          );
          if (exactMatch && !selectedProduct) {
            setSelectedProduct(exactMatch);
            setSerials([]);
            setOpenProduct(false);
            setSearchProduct("");
            toast.success(`เลือกสินค้า: ${exactMatch.name} อัตโนมัติ`);
          }
        }
      } catch (error) {
        console.error("ดึงข้อมูลสินค้าไม่สำเร็จ", error);
      } finally {
        setIsFetching(false);
      }
    },
    [selectedProduct],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(searchProduct);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchProduct, fetchProducts]);

  useEffect(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const token =
      getToken();

    fetch(`${apiUrl}/warehouses`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((list) => {
        setWarehouses(list);
        const def = list.find((w: any) => w.is_default) || list[0];
        if (def) setSelectedWarehouseId(String(def.id));
      })
      .catch((error) => console.error("ดึงรายการคลังสินค้าไม่สำเร็จ", error));
  }, []);

  const handleBarcodeKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setBarcodeError(null);

      const newSn = barcodeInput.trim();
      if (!newSn) return;

      if (serials.includes(newSn)) {
        setBarcodeError(`เลข S/N: ${newSn} อยู่ในรายการสแกนแล้ว`);
        setBarcodeInput("");
        return;
      }

      if (serials.length >= quantity) {
        setBarcodeError(`สแกนครบตามจำนวน ${quantity} ชิ้นที่ระบุไว้แล้วครับ`);
        setBarcodeInput("");
        return;
      }

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const token =
        getToken();

      try {
        // [เพิ่มใหม่] พ่วงรหัสสินค้า (product_id) ส่งไปให้ API ตรวจสอบด้วย
        const res = await fetch(
          `${apiUrl}/product-serials/check?sn=${newSn}&product_id=${selectedProduct.id}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (res.ok) {
          const data = await res.json();

          if (isStockIn) {
            if (data.exists) {
              setBarcodeError(
                `ไม่สามารถรับเข้าได้: S/N ${newSn} มีอยู่ในระบบแล้ว!`,
              );
              setBarcodeInput("");
              return;
            }
          } else {
            if (!data.exists) {
              setBarcodeError(
                `เบิกออกไม่ได้: ไม่พบ S/N ${newSn} ในระบบคลังสินค้า!`,
              );
              setBarcodeInput("");
              return;
            }
            if (data.status !== "available") {
              setBarcodeError(
                `เบิกออกไม่ได้: S/N ${newSn} ถูกเบิกไปแล้ว หรือไม่พร้อมใช้งาน`,
              );
              setBarcodeInput("");
              return;
            }
            // [เพิ่มใหม่] ดักเช็คจาก API ว่าถ้ามี product_id ตอบกลับมา ต้องเป็นของสินค้าที่กำลังเลือกอยู่เท่านั้น!
            if (data.product_id && data.product_id !== selectedProduct.id) {
              setBarcodeError(
                `เบิกออกไม่ได้: S/N นี้เป็นของสินค้าอื่น ไม่ใช่ของ "${selectedProduct.name}"`,
              );
              setBarcodeInput("");
              return;
            }
          }
        }
      } catch (err) {
        console.error("เช็ค S/N ไม่สำเร็จ", err);
        setBarcodeError("ระบบขัดข้อง ไม่สามารถตรวจสอบ S/N กับฐานข้อมูลได้");
        return;
      }

      setSerials([...serials, newSn]);
      setBarcodeInput("");
    }
  };

  const removeSerial = (snToRemove: string) => {
    setSerials(serials.filter((sn) => sn !== snToRemove));
    setBarcodeError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBarcodeError(null);

    if (!selectedProduct) {
      toast.error("กรุณาเลือกสินค้าก่อนครับ");
      return;
    }

    if (selectedProduct.has_serial_number && serials.length !== quantity) {
      toast.error(
        `ต้องสแกน S/N ให้ครบ ${quantity} รายการ (ตอนนี้มี ${serials.length} รายการ)`,
      );
      return;
    }

    if (!selectedWarehouseId) {
      toast.error("กรุณาเลือกคลังสินค้าก่อนครับ");
      return;
    }

    setLoading(true);
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    const token =
      getToken();

    const submitPromise = fetch(`${apiUrl}/stock-movements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        product_id: selectedProduct.id,
        type: mode,
        quantity: quantity,
        reference_number: reference,
        note: note,
        serials: selectedProduct.has_serial_number ? serials : [],
        warehouse_id: selectedWarehouseId,
      }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok)
          throw new Error(json.message || "เกิดข้อผิดพลาดในการบันทึก");
        return json;
      })
      .finally(() => setLoading(false));

    withToastPromise(submitPromise, {
      loading: "กำลังบันทึกรายการสต็อก...",
      success: "บันทึกรายการสต็อกเรียบร้อยแล้ว!",
      error: (err) => err.message,
      onSuccessCallback: () => {
        setSelectedProduct(null);
        setQuantity(1);
        setReference("");
        setNote("");
        setSerials([]);
        setSearchProduct("");
        router.refresh();
      },
    });
  };

  return (
    <div className="w-full max-w-7xl">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2.5 rounded-xl border transition-colors",
              isStockIn
                ? "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30 text-green-600"
                : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600",
            )}
          >
            {isStockIn ? (
              <PackagePlus className="w-6 h-6" strokeWidth={1.5} />
            ) : (
              <PackageMinus className="w-6 h-6" strokeWidth={1.5} />
            )}
          </div>
          <div className="flex">
            <h1 className="text-lg font-bold tracking-tight mr-4">
              {isStockIn
                ? "รับเข้าสินค้าทีละรายการ (Stock In)"
                : "เบิกออกสินค้าทีละรายการ (Stock Out)"}
            </h1>
            <Badge
              variant="secondary"
              className={cn(
                "mt-1 text-[8px] font-bold border-none transition-colors",
                isStockIn
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40",
              )}
            >
              SINGLE MODE
            </Badge>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
            <div className="grid gap-2 md:col-span-2 pt-2">
              <Label className="text-foreground font-bold flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-500" /> ค้นหาสินค้า /
                ยิงบาร์โค้ด <span className="text-red-500">*</span>
              </Label>
              <Popover open={openProduct} onOpenChange={setOpenProduct}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-12 font-medium cursor-pointer border-border bg-background text-foreground hover:bg-slate-50 transition-all rounded-xl"
                  >
                    {selectedProduct ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-600 border-blue-100"
                        >
                          {selectedProduct.sku}
                        </Badge>
                        <span>{selectedProduct.name}</span>
                      </div>
                    ) : (
                      "พิมพ์ชื่อสินค้า หรือ สแกนบาร์โค้ดสินค้าที่นี่..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[400px] md:w-[600px] p-0 dark:bg-slate-900 dark:border-slate-800 shadow-2xl rounded-2xl"
                  align="start"
                >
                  <Command shouldFilter={false} className="dark:bg-slate-900">
                    <CommandInput
                      placeholder="สแกนบาร์โค้ด หรือ พิมพ์ SKU/ชื่อสินค้า..."
                      value={searchProduct}
                      onValueChange={setSearchProduct}
                      className="h-12"
                    />
                    <CommandList>
                      {isFetching && (
                        <div className="p-4 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />{" "}
                          กำลังค้นหาข้อมูล...
                        </div>
                      )}
                      {!isFetching && products.length === 0 && (
                        <CommandEmpty>
                          ไม่พบสินค้าที่ค้นหา (ลองสแกนบาร์โค้ดใหม่)
                        </CommandEmpty>
                      )}
                      <CommandGroup heading="รายการสินค้าที่พบ">
                        {products.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.sku} ${p.name} ${p.barcode}`}
                            className="cursor-pointer py-3"
                            onSelect={() => {
                              setSelectedProduct(p);
                              setSerials([]);
                              setOpenProduct(false);
                              setSearchProduct("");
                            }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 text-blue-600",
                                    selectedProduct?.id === p.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold">
                                    {p.sku} - {p.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Barcode className="w-3 h-3" /> Barcode:{" "}
                                    {p.barcode || "ไม่มี"}
                                  </span>
                                </div>
                              </div>
                              {p.has_serial_number && (
                                <Badge className="bg-amber-100 text-amber-700 border-none text-[10px]">
                                  ต้องระบุ S/N
                                </Badge>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quantity" className="text-foreground">
                จำนวนชิ้น <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                className="h-11 rounded-xl"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-foreground font-bold flex items-center gap-2">
                <WarehouseIcon className="w-4 h-4 text-blue-500" /> คลังสินค้า{" "}
                <span className="text-red-500">*</span>
              </Label>
              <AppSelect
                value={selectedWarehouseId}
                onValueChange={setSelectedWarehouseId}
                placeholder="เลือกคลังสินค้า"
                triggerClassName="h-11 w-full"
                options={warehouses.map((w) => ({
                  value: String(w.id),
                  label: `${w.name}${w.is_default ? " (ค่าเริ่มต้น)" : ""}`,
                }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reference" className="text-foreground">
                เลขที่เอกสารอ้างอิง
              </Label>
              <Input
                id="reference"
                className="h-11 rounded-xl"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={
                  isStockIn ? "เช่น PO-2026-001" : "เช่น INV-2026-001"
                }
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="note" className="text-foreground">
                หมายเหตุ
              </Label>
              <Textarea
                id="note"
                className="rounded-xl min-h-[80px]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isStockIn
                    ? "ระบุเหตุผลการรับเข้า..."
                    : "ระบุเหตุผลการเบิกออก..."
                }
              />
            </div>
          </div>

          {selectedProduct && selectedProduct.has_serial_number && (
            <div
              className={cn(
                "p-6 rounded-2xl border transition-colors",
                isStockIn
                  ? "bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30"
                  : "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 mb-4 font-bold",
                  isStockIn ? "text-green-700" : "text-red-700",
                )}
              >
                <Barcode className="w-5 h-5" /> ระบบบันทึก Serial Number (S/N)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  <Label>สแกนบาร์โค้ด S/N ที่นี่</Label>
                  <Input
                    value={barcodeInput}
                    className={cn(
                      "h-11 bg-white rounded-xl transition-all",
                      barcodeError
                        ? "border-red-500 focus-visible:ring-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]"
                        : "border-slate-300",
                    )}
                    onChange={(e) => {
                      setBarcodeInput(e.target.value);
                      if (barcodeError) setBarcodeError(null);
                    }}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder="สแกนหรือพิมพ์แล้ว Enter..."
                  />

                  {barcodeError && (
                    <div className="flex items-center gap-1.5 text-red-500 text-sm mt-1 animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">{barcodeError}</span>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground font-medium mt-1">
                    สแกนแล้ว:{" "}
                    <span
                      className={cn(
                        "font-bold text-lg",
                        isStockIn ? "text-green-600" : "text-red-600",
                      )}
                    >
                      {serials.length}
                    </span>{" "}
                    / {quantity} ชิ้น
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 min-h-[150px] max-h-[250px] overflow-y-auto shadow-inner">
                  <Label className="text-muted-foreground mb-2 block border-b border-border pb-2 text-xs uppercase tracking-wider font-bold">
                    รายการที่สแกนแล้ว
                  </Label>
                  {serials.length === 0 ? (
                    <div className="text-center text-slate-400 py-10 text-sm italic">
                      รอการสแกน S/N...
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {serials.map((sn, index) => (
                        <li
                          key={index}
                          className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-sm animate-in fade-in slide-in-from-left-2"
                        >
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {index + 1}. {sn}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeSerial(sn)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <SubmitButton
              type="submit"
              isLoading={loading}
              text={isStockIn ? "บันทึกรับเข้าคลัง" : "บันทึกเบิกออก"}
              icon={<Save className="w-4 h-4" />}
              colorClass={
                isStockIn
                  ? "bg-green-600 hover:bg-green-700 shadow-green-600/20"
                  : "bg-red-600 hover:bg-red-700 shadow-red-600/20"
              }
            />
          </div>
        </form>
    </div>
  );
}
