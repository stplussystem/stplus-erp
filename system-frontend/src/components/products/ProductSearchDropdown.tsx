"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, Barcode, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";

interface ProductSearchDropdownProps {
  value: string; // รับค่า ID สินค้าที่เลือก
  selectedSku?: string; // รหัส SKU ไว้โชว์ตอนพับหน้าจอ
  selectedName?: string; // ชื่อสินค้า ไว้โชว์ตอนพับหน้าจอ
  onChange: (productId: string, productData: any) => void; // ส่งค่ากลับไปให้ Parent
  disabled?: boolean;
  hasError?: boolean;
  // 🎪 จำกัดประเภทสินค้าที่ค้นเจอ เช่น "rent,install" ให้เห็นเฉพาะสินค้าเช่า/งานติดตั้ง (ใช้ในหน้าใบเบิกสินค้างานเช่า)
  // ไม่ใส่ = ค้นทุกประเภทเหมือนเดิม (ไม่กระทบจุดที่เรียกใช้อยู่เดิม)
  typeFilter?: string;
}

export function ProductSearchDropdown({
  value,
  selectedSku,
  selectedName,
  onChange,
  disabled = false,
  hasError = false,
  typeFilter,
}: ProductSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // 🚀 ลอจิกดึงข้อมูลจาก API (แบบเดียวกับ StockMovementForm)
  const fetchProducts = useCallback(async (query: string) => {
    if (!query) {
      setProducts([]); // ถ้าไม่ได้พิมพ์อะไร ไม่ต้องโหลด
      return;
    }
    setIsFetching(true);
    try {
      const token =
        getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/products?search=${query}&per_page=20${typeFilter ? `&type=${typeFilter}` : ""}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (res.ok) {
        const json = await res.json();
        // กรองเอาเฉพาะสินค้าประเภทที่ต้องใช้ (สามารถปรับได้ตามต้องการ)
        const inventoryProducts = json.data?.data || json.data || [];
        setProducts(inventoryProducts);
      }
    } catch (error) {
      console.error("ดึงข้อมูลสินค้าไม่สำเร็จ", error);
    } finally {
      setIsFetching(false);
    }
  }, [typeFilter]);

  // 🚀 หน่วงเวลาพิมพ์ (Debounce) 300ms เพื่อไม่ให้ยิง API รัวเกินไป
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchProducts]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-10 px-4 font-normal bg-background border-border hover:border-blue-500 hover:bg-background rounded-xl text-sm",
            hasError && "border-red-500 hover:border-red-500",
          )}
        >
          {value && selectedName ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-blue-600">[{selectedSku}]</span>
              <span className="truncate text-foreground">{selectedName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              -- ค้นหาหรือยิงบาร์โค้ดสินค้า --
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0 shadow-xl rounded-xl border border-border"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="สแกนบาร์โค้ด หรือ พิมพ์ SKU/ชื่อสินค้า..."
            value={search}
            onValueChange={setSearch}
            className="h-11 text-sm"
          />
          <CommandList>
            {isFetching && (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />{" "}
                กำลังค้นหา...
              </div>
            )}
            {!isFetching && search && products.length === 0 && (
              <CommandEmpty>ไม่พบสินค้า (ลองสแกนบาร์โค้ดใหม่)</CommandEmpty>
            )}
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id.toString()}
                  className="cursor-pointer py-2.5"
                  onSelect={() => {
                    onChange(p.id.toString(), p); // ส่งข้อมูลทั้งก้อนกลับไป
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 text-blue-600",
                          value === p.id.toString()
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground text-sm">
                          {p.sku} - {p.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Barcode className="w-3 h-3" /> {p.barcode || "-"}
                        </span>
                      </div>
                    </div>
                    {p.has_serial_number && (
                      <Badge className="bg-blue-50 text-blue-600 border-none text-[10px]">
                        คุม S/N
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
  );
}
