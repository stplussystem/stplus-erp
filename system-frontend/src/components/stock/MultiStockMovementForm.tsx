"use client";
import { useState, useCallback, useEffect } from "react";
import {
  PackagePlus,
  Save,
  Plus,
  Trash2,
  ScanLine,
  Loader2,
  PackageMinus,
  Search,
  Check,
  ChevronsUpDown,
  Barcode,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function InternalProductSelector({ onSelect }: { onSelect: (p: any) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const fetchData = useCallback(
    async (query: string) => {
      if (!query) return;
      setIsFetching(true);

      try {
        const json = await apiFetch(`/products?search=${query}&per_page=10`);
        if (json && json.data) {
          const filtered = json.data.filter(
            (p: any) =>
              p.product_type === "inventory" || p.product_type === "rental",
          );
          setProducts(filtered);

          const exactMatch = filtered.find(
            (p: any) => p.barcode === query || p.sku === query,
          );
          if (exactMatch) {
            setSelected(exactMatch);
            onSelect(exactMatch);
            setOpen(false);
            setSearch("");
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetching(false);
      }
    },
    [onSelect],
  );

  useEffect(() => {
    const timer = setTimeout(() => fetchData(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchData]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal border-slate-200 h-10 rounded-lg"
        >
          {selected ? (
            <span className="truncate">
              <Badge variant="outline" className="mr-2 text-[10px]">
                {selected.sku}
              </Badge>
              {selected.name}
            </span>
          ) : (
            "พิมพ์ชื่อสินค้า หรือ ยิงบาร์โค้ด..."
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
              <div className="p-4 text-center text-sm text-slate-500">
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
                    <span className="text-[10px] text-slate-400">
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

type MultiStockFormProps = {
  mode?: "in" | "out";
};

export default function MultiStockMovementForm({
  mode = "in",
}: MultiStockFormProps) {
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  useEffect(() => {
    apiFetch("/warehouses")
      .then((list: any[]) => {
        if (!list) return;
        setWarehouses(list);
        const def = list.find((w: any) => w.is_default) || list[0];
        if (def) setSelectedWarehouseId(String(def.id));
      })
      .catch((error) => console.error("ดึงรายการคลังสินค้าไม่สำเร็จ", error));
  }, []);

  const [items, setItems] = useState([
    {
      id: 1,
      productId: "",
      qty: 1,
      serials: [""],
      isDialogOpen: false,
      hasSerialNumber: false,
      sku: "",
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
        hasSerialNumber: false,
        sku: "",
      },
    ]);

  const removeRow = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const updateMultipleFields = (id: number, fields: any) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, ...fields } : item)),
    );
  };

  const handleSubmit = async () => {
    const validItems = items.filter((item) => item.productId !== "");
    if (validItems.length === 0) {
      toast.error("กรุณาเลือกสินค้าอย่างน้อย 1 รายการครับ");
      return;
    }

    if (!selectedWarehouseId) {
      toast.error("กรุณาเลือกคลังสินค้าก่อนครับ");
      return;
    }

    for (const item of validItems) {
      if (item.hasSerialNumber) {
        const cleanSerials = item.serials.filter((s) => s.trim() !== "");
        if (cleanSerials.length !== item.qty) {
          toast.error(`สินค้า SKU: ${item.sku} ยังสแกน S/N ไม่ครบตามจำนวนครับ`);
          return;
        }
      }
    }

    setLoading(true);

    const payloadItems = validItems.map((item) => {
      const cleanSerials = item.serials.filter((s) => s.trim() !== "");
      return {
        product_id: item.productId,
        quantity: item.qty,
        serials: item.hasSerialNumber ? cleanSerials : [],
      };
    });

    const payload = {
      type: mode,
      reference_number: `BULK-${new Date().getTime()}`,
      note:
        mode === "in"
          ? "รับเข้าแบบหลายรายการ (Bulk)"
          : "เบิกออกแบบหลายรายการ (Bulk)",
      items: payloadItems,
      warehouse_id: selectedWarehouseId,
    };

    const submitPromise = apiFetch(`/stock-movements/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    withToastPromise(submitPromise, {
      loading: "กำลังบันทึกรายการทั้งหมด...",
      success: "บันทึกสต็อกทุกรายการเรียบร้อยแล้ว!",
      error: (err) => err.message || "เกิดข้อผิดพลาดในการบันทึก",
      onSuccessCallback: () => {
        setItems([
          {
            id: 1,
            productId: "",
            qty: 1,
            serials: [""],
            isDialogOpen: false,
            hasSerialNumber: false,
            sku: "",
          },
        ]);
      },
    });
    setLoading(false);
  };

  return (
    <div className="w-full max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2.5 rounded-xl border transition-colors",
              mode === "in"
                ? "bg-green-50 text-green-600 border-green-100"
                : "bg-red-50 text-red-600 border-red-100",
            )}
          >
            {mode === "in" ? (
              <PackagePlus className="w-6 h-6" strokeWidth={1.5} />
            ) : (
              <PackageMinus className="w-6 h-6" strokeWidth={1.5} />
            )}
          </div>
          <div className="flex">
            <h1 className="text-xl font-bold tracking-tight mr-4">
              {mode === "in"
                ? "รับสินค้าเข้าคลัง (Bulk)"
                : "เบิกสินค้าออก (Bulk)"}
            </h1>
            <Badge
              variant="secondary"
              className={cn(
                "mt-1 text-[10px] font-bold border-none transition-colors",
                mode === "in"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40",
              )}
            >
              MULTIPLE ITEMS
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-2 mb-4 max-w-xs">
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

      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-border">
              <TableHead className="w-[50px] text-center font-bold text-slate-500">
                #
              </TableHead>
              <TableHead className="min-w-[250px] font-bold text-slate-500">
                พิมพ์ชื่อสินค้า หรือ สแกนบาร์โค้ด
              </TableHead>
              <TableHead className="w-[120px] text-center font-bold text-slate-500">
                จำนวน
              </TableHead>
              <TableHead className="w-[300px] text-center font-bold text-slate-500">
                สถานะ S/N
              </TableHead>
              <TableHead className="w-[80px] text-center font-bold text-slate-500"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={item.id}
                className="border-border hover:bg-slate-50/30"
              >
                <TableCell className="text-center font-medium text-slate-400">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <InternalProductSelector
                    onSelect={(p) => {
                      updateMultipleFields(item.id, {
                        productId: p.id,
                        sku: p.sku,
                        hasSerialNumber: !!p.has_serial_number,
                        serials: [""],
                      });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="1"
                    className="text-center font-bold h-10"
                    value={item.qty}
                    onChange={(e) =>
                      updateItem(item.id, "qty", Number(e.target.value))
                    }
                  />
                </TableCell>
                <TableCell className="text-center">
                  {item.hasSerialNumber ? (
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateItem(item.id, "isDialogOpen", true)
                        }
                        className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-full px-4 h-8 transition-all"
                      >
                        <ScanLine className="w-3.5 h-3.5" /> สแกน (
                        {item.serials.filter((s) => s !== "").length}/{item.qty}
                        )
                      </Button>
                      <SerialManager
                        isOpen={item.isDialogOpen}
                        onClose={() =>
                          updateItem(item.id, "isDialogOpen", false)
                        }
                        qty={item.qty}
                        serials={item.serials}
                        mode={mode}
                        productId={item.productId} // 🚨 3. ส่ง productId เข้าไปในป๊อปอัป
                        onSerialsChange={(newSerials: string[]) =>
                          updateItem(item.id, "serials", newSerials)
                        }
                      />
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">
                      ไม่ต้องระบุ
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full"
                    onClick={() => removeRow(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="p-4 bg-slate-50/30 border-t border-border">
          <Button
            variant="outline"
            onClick={addRow}
            className="w-full py-6 border-dashed border-2 text-slate-400 hover:text-blue-600 hover:border-blue-600 rounded-xl font-bold gap-2 transition-all"
          >
            <Plus className="w-4 h-4" /> เพิ่มสินค้าอีก 1 รายการ
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <Button
          onClick={handleSubmit}
          className={cn(
            "min-w-[200px] h-12 rounded-full shadow-lg font-bold flex items-center gap-2 transition-all active:scale-95 text-white",
            mode === "in"
              ? "bg-green-600 hover:bg-green-700 shadow-green-600/20"
              : "bg-red-600 hover:bg-red-700 shadow-red-600/20",
          )}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {loading ? "กำลังบันทึกข้อมูล..." : "บันทึกรายการทั้งหมด"}
        </Button>
      </div>
    </div>
  );
}
