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
import { Badge } from "@/components/ui/badge"; // 💡 เพิ่ม Import Badge
import {
  ChevronsUpDown,
  Check,
  Trash2,
  Barcode,
  Save,
  Loader2,
  PackagePlus,  // 💡 เพิ่ม Import Icon
  PackageMinus, // 💡 เพิ่ม Import Icon
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { withToastPromise } from "@/lib/toast-helper";

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
  const [quickScanInput, setQuickScanInput] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const [serials, setSerials] = useState<string[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");

  const fetchProducts = useCallback(async (query: string) => {
    setIsFetching(true);
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    try {
      const res = await fetch(`${apiUrl}/products?search=${query}&per_page=20`);
      if (res.ok) {
        const json = await res.json();
        const inventoryProducts = json.data.filter(
          (p: any) => p.product_type === "inventory",
        );
        setProducts(inventoryProducts);
      }
    } catch (error) {
      console.error("ดึงข้อมูลสินค้าไม่สำเร็จ", error);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(searchProduct);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchProduct, fetchProducts]);

  const handleBarcodeKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const newSn = barcodeInput.trim();
      if (!newSn) return;

      if (serials.includes(newSn)) {
        toast.error(`เลข S/N: ${newSn} อยู่ในรายการสแกนแล้วครับ!`);
        setBarcodeInput("");
        return;
      }

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      try {
        const res = await fetch(`${apiUrl}/product-serials/check?sn=${newSn}`);
        if (res.ok) {
          const data = await res.json();
          if (isStockIn && data.exists && data.status === "available") {
            toast.error(`ไม่สามารถรับเข้าได้: S/N ${newSn} มีอยู่ในระบบแล้ว!`);
            setBarcodeInput("");
            return;
          }
        }
      } catch (err) {
        console.error("เช็ค S/N ไม่สำเร็จ", err);
      }

      if (serials.length >= quantity) {
        toast.warning("สแกนครบตามจำนวนที่ระบุไว้แล้วครับ!");
        setBarcodeInput("");
        return;
      }

      setSerials([...serials, newSn]);
      setBarcodeInput("");
    }
  };

  const removeSerial = (snToRemove: string) => {
    setSerials(serials.filter((sn) => sn !== snToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    setLoading(true);
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    const submitPromise = fetch(`${apiUrl}/stock-movements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        product_id: selectedProduct.id,
        type: mode,
        quantity: quantity,
        reference_number: reference,
        note: note,
        serials: selectedProduct.has_serial_number ? serials : [],
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
    <div className="w-full">
      {/* 💡 พระเอกของเรา: Header สไตล์ Multi (สลับสี In/Out) */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2.5 rounded-xl border transition-colors",
              isStockIn
                ? "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30 text-green-600"
                : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600"
            )}
          >
            {isStockIn ? (
              <PackagePlus className="w-8 h-8" strokeWidth={1.5} />
            ) : (
              <PackageMinus className="w-8 h-8" strokeWidth={1.5} />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isStockIn ? "รับเข้าสินค้าทีละรายการ (Stock In)" : "เบิกออกสินค้าทีละรายการ (Stock Out)"}
            </h1>
            <Badge
              variant="secondary"
              className={cn(
                "mt-1 text-[10px] font-bold border-none transition-colors",
                isStockIn
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40"
              )}
            >
              SINGLE MODE
            </Badge>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-border p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-border pb-6">
            <div className="grid gap-2 md:col-span-2">
              <Label className="text-foreground">
                ค้นหา / เลือกสินค้า <span className="text-red-500">*</span>
              </Label>
              <Popover open={openProduct} onOpenChange={setOpenProduct}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal cursor-pointer border-border bg-background text-foreground"
                  >
                    {selectedProduct
                      ? `${selectedProduct.sku} - ${selectedProduct.name}`
                      : "เลือกสินค้า..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[400px] md:w-[600px] p-0 dark:bg-slate-900 dark:border-slate-800"
                  align="start"
                >
                  <Command shouldFilter={false} className="dark:bg-slate-900">
                    <CommandInput
                      placeholder="พิมพ์ค้นหา SKU หรือชื่อสินค้า..."
                      value={searchProduct}
                      onValueChange={setSearchProduct}
                      className="dark:text-slate-200"
                    />
                    <CommandList>
                      {isFetching && (
                        <div className="p-4 text-center text-sm text-slate-500">
                          กำลังค้นหา...
                        </div>
                      )}
                      {!isFetching && products.length === 0 && (
                        <CommandEmpty>ไม่พบสินค้าที่ค้นหา</CommandEmpty>
                      )}
                      <CommandGroup>
                        {products.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.sku} ${p.name}`}
                            className="cursor-pointer dark:text-slate-300 dark:hover:bg-slate-800"
                            onSelect={() => {
                              setSelectedProduct(p);
                              setSerials([]);
                              setOpenProduct(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProduct?.id === p.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {p.sku} - {p.name}
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
                className="bg-background border-border text-foreground"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reference" className="text-foreground">
                เลขที่เอกสารอ้างอิง
              </Label>
              <Input
                id="reference"
                className="bg-background border-border text-foreground"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={isStockIn ? "เช่น PO-2026-001" : "เช่น INV-2026-001"}
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="note" className="text-foreground">
                หมายเหตุ
              </Label>
              <Textarea
                id="note"
                className="bg-background border-border text-foreground"
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
                <Barcode className="w-5 h-5" />
                ระบบบันทึก Serial Number (S/N)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  <Label className="text-foreground">
                    สแกนบาร์โค้ด S/N ที่นี่
                  </Label>
                  <Input
                    className="bg-background border-border text-foreground focus-visible:ring-offset-0"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder="สแกนหรือพิมพ์แล้ว Enter..."
                  />
                  <p className="text-sm text-muted-foreground">
                    สแกนแล้ว:{" "}
                    <span
                      className={cn(
                        "font-bold",
                        isStockIn
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {serials.length}
                    </span>{" "}
                    / {quantity} ชิ้น
                  </p>
                </div>

                <div className="bg-background border border-border rounded-md p-4 min-h-[150px] max-h-[250px] overflow-y-auto">
                  <Label className="text-muted-foreground mb-2 block border-b border-border pb-2 text-xs uppercase tracking-wider">
                    รายการที่บันทึกแล้ว
                  </Label>
                  {serials.length === 0 ? (
                    <div className="text-center text-muted-foreground py-6 text-sm italic">
                      ยังไม่มีรายการสแกน
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {serials.map((sn, index) => (
                        <li
                          key={index}
                          className="flex justify-between items-center bg-muted/50 p-2 rounded border border-border text-sm text-foreground"
                        >
                          <span className="font-medium">
                            {index + 1}. {sn}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
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
            <Button
              type="submit"
              className={cn(
                "min-w-[150px] px-8 h-12 rounded-full shadow-lg cursor-pointer transition-all text-white font-bold flex items-center justify-center gap-2",
                isStockIn
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
                : isStockIn
                  ? "บันทึกรับเข้าคลัง"
                  : "บันทึกเบิกออก"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}