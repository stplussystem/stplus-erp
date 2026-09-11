"use client";
import { useState, useCallback, useEffect } from "react";
import {
  Truck,
  Save,
  ScanLine,
  Loader2,
  ArrowRight,
  Warehouse as WarehouseIcon,
  Check,
  ChevronsUpDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { withToastPromise } from "@/lib/toast-helper";
import { cn } from "@/lib/utils";
import { SerialManager } from "@/components/stock/SerialManager";
import { apiFetch } from "@/lib/api";

// 🚀 มิเรอร์ InternalProductSelector จาก MultiStockMovementForm.tsx เป๊ะ (พิมพ์ชื่อ/สแกนบาร์โค้ดค้นหาสินค้า)
function ProductSelector({
  onSelect,
  placeholder = "พิมพ์ชื่อสินค้า หรือ ยิงบาร์โค้ด...",
}: {
  onSelect: (p: any) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const fetchData = useCallback(async (query: string) => {
    if (!query) return;
    setIsFetching(true);
    try {
      const json = await apiFetch(`/products?search=${query}&per_page=10`);
      if (json && json.data) {
        setProducts(json.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchData]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal border-border h-11 rounded-xl"
        >
          {selected ? (
            <span className="truncate">
              <Badge variant="outline" className="mr-2 text-[10px]">
                {selected.sku}
              </Badge>
              {selected.name}
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="ค้นหาด้วยชื่อ, SKU หรือ บาร์โค้ด..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isFetching && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                กำลังค้นหา...
              </div>
            )}
            {!isFetching && products.length === 0 && (
              <CommandEmpty>ไม่พบสินค้า</CommandEmpty>
            )}
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => {
                    setSelected(p);
                    onSelect(p);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected?.id === p.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-bold">
                      {p.sku} - {p.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Barcode: {p.barcode || "-"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function StockTransferForm() {
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const [fromProduct, setFromProduct] = useState<any>(null);
  const [fromWarehouseId, setFromWarehouseId] = useState<string>("");
  const [toWarehouseId, setToWarehouseId] = useState<string>("");

  const [crossSku, setCrossSku] = useState(false);
  const [toProduct, setToProduct] = useState<any>(null);
  const [ackCrossSku, setAckCrossSku] = useState(false);

  const [qty, setQty] = useState(1);
  const [serials, setSerials] = useState<string[]>([""]);
  const [isSerialDialogOpen, setIsSerialDialogOpen] = useState(false);

  const [note, setNote] = useState("");

  useEffect(() => {
    apiFetch("/warehouses")
      .then((list: any[]) => {
        if (!list) return;
        setWarehouses(list);
      })
      .catch((error) => console.error("ดึงรายการคลังสินค้าไม่สำเร็จ", error));
  }, []);

  const effectiveToProduct = crossSku ? toProduct : fromProduct;
  const hasSerialNumber = !!fromProduct?.has_serial_number;

  const resetForm = () => {
    setFromProduct(null);
    setToWarehouseId("");
    setCrossSku(false);
    setToProduct(null);
    setAckCrossSku(false);
    setQty(1);
    setSerials([""]);
    setNote("");
  };

  const handleSubmit = async () => {
    if (!fromProduct) {
      toast.error("กรุณาเลือกสินค้าต้นทางก่อนครับ");
      return;
    }
    if (!fromWarehouseId) {
      toast.error("กรุณาเลือกคลังต้นทางก่อนครับ");
      return;
    }
    if (!toWarehouseId) {
      toast.error("กรุณาเลือกคลังปลายทางก่อนครับ");
      return;
    }
    if (crossSku && !effectiveToProduct) {
      toast.error("กรุณาเลือกสินค้าปลายทางก่อนครับ");
      return;
    }
    if (crossSku && !ackCrossSku) {
      toast.error("กรุณาติ๊กยืนยันว่าเข้าใจผลของการโอนย้ายข้าม SKU ก่อนครับ");
      return;
    }
    if (!crossSku && fromWarehouseId === toWarehouseId) {
      toast.error("คลังต้นทางและปลายทางต้องไม่ใช่คลังเดียวกันครับ");
      return;
    }

    let cleanSerials: string[] = [];
    if (hasSerialNumber) {
      cleanSerials = serials.filter((s) => s.trim() !== "");
      if (cleanSerials.length !== qty) {
        toast.error("กรุณาสแกน/กรอก S/N ให้ครบตามจำนวนก่อนครับ");
        return;
      }
    }

    setLoading(true);
    const payload = {
      from_product_id: fromProduct.id,
      to_product_id: crossSku ? effectiveToProduct.id : undefined,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      quantity: hasSerialNumber ? undefined : qty,
      serials: hasSerialNumber ? cleanSerials : undefined,
      note: note || undefined,
    };

    const submitPromise = apiFetch("/stock-movements/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    withToastPromise(submitPromise, {
      loading: "กำลังโอนย้ายสินค้า...",
      success: (res: any) => res?.message || "โอนย้ายสินค้าสำเร็จ",
      error: (err) => err.message || "เกิดข้อผิดพลาดในการโอนย้าย",
      onSuccessCallback: () => {
        resetForm();
        window.dispatchEvent(new Event("refreshProducts"));
      },
    });
    setLoading(false);
  };

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl border bg-orange-50 text-orange-600 border-orange-100">
          <Truck className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            โอนย้ายคลังสินค้า
          </h1>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            ย้ายสินค้าจากคลังหนึ่งไปอีกคลังหนึ่ง (รองรับย้ายไปเป็นสินค้าคนละ SKU ได้)
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-sm p-6 space-y-6">
        {/* ต้นทาง */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label className="font-bold flex items-center gap-2">
              สินค้าต้นทาง <span className="text-red-500">*</span>
            </Label>
            <ProductSelector
              onSelect={(p) => {
                setFromProduct(p);
                setSerials([""]);
                setQty(1);
                if (!crossSku) setToProduct(null);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label className="font-bold flex items-center gap-2">
              <WarehouseIcon className="w-4 h-4 text-blue-500" /> คลังต้นทาง{" "}
              <span className="text-red-500">*</span>
            </Label>
            <AppSelect
              value={fromWarehouseId}
              onValueChange={setFromWarehouseId}
              placeholder="เลือกคลังต้นทาง"
              triggerClassName="h-11 w-full"
              options={warehouses.map((w) => ({
                value: String(w.id),
                label: `${w.name}${w.is_default ? " (ค่าเริ่มต้น)" : ""}`,
              }))}
            />
          </div>
        </div>

        <div className="flex justify-center text-muted-foreground">
          <ArrowRight className="w-5 h-5" />
        </div>

        {/* ปลายทาง */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label className="font-bold flex items-center gap-2">
              สินค้าปลายทาง
            </Label>
            {crossSku ? (
              <ProductSelector
                onSelect={(p) => setToProduct(p)}
                placeholder="เลือกสินค้าปลายทาง (คนละ SKU)..."
              />
            ) : (
              <div className="h-11 rounded-xl bg-muted/50 border border-border flex items-center px-3 text-sm text-muted-foreground">
                {fromProduct
                  ? `${fromProduct.sku} - ${fromProduct.name} (SKU เดียวกับต้นทาง)`
                  : "เลือกสินค้าต้นทางก่อน"}
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label className="font-bold flex items-center gap-2">
              <WarehouseIcon className="w-4 h-4 text-emerald-500" />{" "}
              คลังปลายทาง <span className="text-red-500">*</span>
            </Label>
            <AppSelect
              value={toWarehouseId}
              onValueChange={setToWarehouseId}
              placeholder="เลือกคลังปลายทาง"
              triggerClassName="h-11 w-full"
              options={warehouses.map((w) => ({
                value: String(w.id),
                label: `${w.name}${w.is_default ? " (ค่าเริ่มต้น)" : ""}`,
              }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="cross-sku"
            checked={crossSku}
            onCheckedChange={(v) => {
              setCrossSku(!!v);
              setToProduct(null);
              setAckCrossSku(false);
            }}
          />
          <Label
            htmlFor="cross-sku"
            className="text-sm font-medium cursor-pointer"
          >
            โอนไปเป็นสินค้าคนละ SKU (เช่น สินค้าตัวเดียวกันแต่แยก SKU ขาย/เช่า)
          </Label>
        </div>

        {crossSku && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-amber-800 dark:text-amber-300">
              <p className="font-bold mb-1">ข้อควรระวัง: โอนย้ายข้าม SKU</p>
              <p className="text-xs leading-relaxed">
                ประวัติเก่า (ใบซ่อม/ใบติดตั้ง) ของ S/N ที่เคยผูกกับ SKU ต้นทาง จะ<b>ไม่ถูกแก้ตาม</b>{" "}
                หลังโอนย้าย — รายงานย้อนหลังของ SKU เดิมอาจไม่สอดคล้องกับสถานะปัจจุบันของหน่วยนี้
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Checkbox
                  id="ack-cross-sku"
                  checked={ackCrossSku}
                  onCheckedChange={(v) => setAckCrossSku(!!v)}
                />
                <Label
                  htmlFor="ack-cross-sku"
                  className="text-xs font-bold cursor-pointer"
                >
                  เข้าใจแล้ว ยืนยันดำเนินการ
                </Label>
              </div>
            </div>
          </div>
        )}

        {/* จำนวน / S/N */}
        <div className="grid gap-2">
          <Label className="font-bold">
            {hasSerialNumber ? "Serial Number ที่จะโอนย้าย" : "จำนวนที่จะโอนย้าย"}{" "}
            <span className="text-red-500">*</span>
          </Label>
          {hasSerialNumber ? (
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                className="w-28 text-center font-bold h-11"
                value={qty}
                onChange={(e) => {
                  setQty(Number(e.target.value));
                  setSerials([""]);
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSerialDialogOpen(true)}
                disabled={!fromProduct}
                className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-full px-4 h-10"
              >
                <ScanLine className="w-3.5 h-3.5" /> สแกน (
                {serials.filter((s) => s !== "").length}/{qty})
              </Button>
              <SerialManager
                isOpen={isSerialDialogOpen}
                onClose={() => setIsSerialDialogOpen(false)}
                qty={qty}
                serials={serials}
                mode="out"
                productId={fromProduct?.id}
                onSerialsChange={(newSerials: string[]) =>
                  setSerials(newSerials)
                }
              />
            </div>
          ) : (
            <Input
              type="number"
              min="1"
              className="w-32 text-center font-bold h-11"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          )}
        </div>

        <div className="grid gap-2">
          <Label className="font-bold text-muted-foreground">
            หมายเหตุ (ถ้ามี)
          </Label>
          <Input
            placeholder="เช่น เหตุผลของการโอนย้าย..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <Button
          onClick={handleSubmit}
          className="min-w-[200px] h-12 rounded-full shadow-lg font-bold flex items-center gap-2 transition-all active:scale-95 text-white bg-orange-600 hover:bg-orange-700 shadow-orange-600/20"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {loading ? "กำลังโอนย้าย..." : "โอนย้ายสินค้า"}
        </Button>
      </div>
    </div>
  );
}
