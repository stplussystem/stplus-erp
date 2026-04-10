"use client";
import { useState, useEffect, useRef } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronsUpDown,
  Check,
  Trash2,
  Barcode,
  Save,
  PackagePlus,
  PackageMinus,
  Search,
  ClipboardPaste,
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

  const isStockIn = mode === "in";

  // State สำหรับดึงข้อมูลสินค้าทั้งหมดมาไว้ในเครื่อง
  const [products, setProducts] = useState<any[]>([]);

  // State สำหรับค้นหาสินค้า (Manual & Quick Scan)
  const [openProduct, setOpenProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchProduct, setSearchProduct] = useState("");
  const [quickScanInput, setQuickScanInput] = useState("");

  // State สำหรับฟอร์มหลัก
  const [quantity, setQuantity] = useState(1);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  // State สำหรับ S/N (Single Scan & Bulk Paste)
  const [serials, setSerials] = useState<string[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      try {
        const res = await fetch(`${apiUrl}/products?per_page=100`);
        if (res.ok) {
          const json = await res.json();
          const inventoryProducts = json.data.filter(
            (p: any) => p.product_type === "inventory",
          );
          setProducts(inventoryProducts);
        }
      } catch (error) {
        console.error("ดึงข้อมูลสินค้าไม่สำเร็จ", error);
      }
    };
    fetchProducts();
  }, []);

  // 💡 1. ฟังก์ชัน: สแกนเลือกสินค้าด่วน (Auto-Select Product)
  const handleQuickScanProduct = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const term = quickScanInput.trim();
      if (!term) return;

      // ค้นหาสินค้าที่ SKU หรือ บาร์โค้ด ตรงกับที่สแกน
      const foundProduct = products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === term.toLowerCase()) ||
          p.sku.toLowerCase() === term.toLowerCase(),
      );

      if (foundProduct) {
        setSelectedProduct(foundProduct);
        setSerials([]); // ล้าง S/N เก่าทิ้ง
        setQuickScanInput(""); // ล้างช่องเตรียมสแกนตัวถัดไป
        toast.success(`ค้นพบและเลือก: ${foundProduct.name}`);
      } else {
        toast.error(`ไม่พบสินค้าที่มี SKU หรือบาร์โค้ด: ${term}`);
      }
    }
  };

  // 💡 2. ฟังก์ชัน: สแกน S/N ทีละตัว (Single Scan)
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const newSn = barcodeInput.trim();

      if (!newSn) return;

      if (serials.includes(newSn)) {
        toast.error(`เลข S/N: ${newSn} ถูกสแกนไปแล้วครับ!`);
        setBarcodeInput("");
        return;
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

  // 💡 3. ฟังก์ชัน: นำเข้า S/N แบบกลุ่ม (Bulk Insert)
  const handleBulkSubmit = () => {
    if (!bulkInput.trim()) {
      toast.error("กรุณาระบุเลข S/N ก่อนครับ");
      return;
    }

    // แยกบรรทัด, ลบช่องว่างหน้าหลัง, และกรองบรรทัดที่ว่างเปล่าออก
    const rawSns = bulkInput
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s !== "");

    // ตัดตัวซ้ำที่อยู่ในกล่อง Textarea เดียวกันออก (เผื่อก๊อปมาซ้ำ)
    const uniqueNewSns = Array.from(new Set(rawSns));

    // คัดเฉพาะตัวที่ "ยังไม่เคยอยู่ในรายการสแกนด้านล่าง"
    const validSnsToAdd = uniqueNewSns.filter((sn) => !serials.includes(sn));

    if (validSnsToAdd.length === 0) {
      toast.warning(
        "ไม่มี S/N ใหม่ให้เพิ่ม (อาจจะซ้ำกับรายการที่มีอยู่แล้วทั้งหมด)",
      );
      return;
    }

    // ตรวจสอบว่าจำนวนที่เพิ่มเข้าไปใหม่ จะเกินโควต้า "จำนวนชิ้น" ที่ตั้งไว้ไหม?
    const availableSlots = quantity - serials.length;
    if (validSnsToAdd.length > availableSlots) {
      toast.error(
        `ใส่ได้อีกแค่ ${availableSlots} รายการ แต่คุณพยายามเพิ่ม ${validSnsToAdd.length} รายการ กรุณาเพิ่ม "จำนวนชิ้น" ก่อนครับ`,
      );
      return;
    }

    // นำเข้าสำเร็จ
    setSerials([...serials, ...validSnsToAdd]);
    toast.success(`นำเข้า S/N สำเร็จ ${validSnsToAdd.length} รายการ!`);
    setBulkInput("");
    setIsBulkOpen(false);
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
        setQuickScanInput("");
        router.refresh();
      },
    });
  };

  return (
    // 💡 เปลี่ยน bg-white เป็น bg-card และแก้สีเส้นขอบเป็น border-border
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* ส่วนที่ 1: ข้อมูลหลัก */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-border pb-6">
          <div className="grid gap-2 md:col-span-2">
            {/* 💡 เปลี่ยน text-slate เป็น text-foreground */}
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
                <Command className="dark:bg-slate-900">
                  <CommandInput
                    placeholder="พิมพ์ค้นหา SKU หรือชื่อสินค้า..."
                    onValueChange={setSearchProduct}
                    className="dark:text-slate-200"
                  />
                  <CommandList>
                    <CommandEmpty>ไม่พบสินค้าที่ค้นหา</CommandEmpty>
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

        {/* ส่วนที่ 2: ระบบยิงบาร์โค้ด */}
        {selectedProduct && selectedProduct.has_serial_number && (
          <div
            className={cn(
              "p-6 rounded-lg border",
              isStockIn
                ? "bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30"
                : "bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2 mb-4 font-medium",
                isStockIn
                  ? "text-green-800 dark:text-green-400"
                  : "text-blue-800 dark:text-blue-400",
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
                        : "text-blue-600 dark:text-blue-400",
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
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
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

        {/* ปุ่ม Submit */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            className={cn(
              "min-w-[150px] text-white font-bold shadow-md cursor-pointer transition-all",
              isStockIn
                ? "bg-green-600 hover:bg-green-700 active:scale-95"
                : "bg-blue-600 hover:bg-blue-700 active:scale-95",
            )}
            disabled={loading}
          >
            {loading
              ? "กำลังบันทึก..."
              : isStockIn
                ? "บันทึกรับเข้าคลัง"
                : "บันทึกเบิกออก"}
          </Button>
        </div>
      </form>
    </div>
  );
}
