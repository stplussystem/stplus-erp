"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductSelectorProps = {
  value: string | number;
  // 💡 อัปเดต: ส่ง Object ของสินค้ากลับไปให้หน้า Form ด้วย เพื่อจะได้รู้ว่าต้องใช้ S/N ไหม
  onChange: (value: string | number, productData?: any) => void;
};

export function ProductSelector({ value, onChange }: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [selectedData, setSelectedData] = useState<any>(null);

  const fetchProducts = useCallback(async (query: string) => {
    setIsFetching(true);
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    try {
      const res = await fetch(`${apiUrl}/products?search=${query}&per_page=20`);
      if (res.ok) {
        const json = await res.json();
        setProducts(
          json.data.filter((p: any) => p.product_type === "inventory"),
        );
      }
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchProducts]);

  useEffect(() => {
    if (value) {
      const found = products.find((p) => p.id === value);
      if (found) setSelectedData(found);
    } else {
      setSelectedData(null);
    }
  }, [value, products]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal bg-white dark:bg-slate-950"
        >
          <span className="truncate">
            {selectedData
              ? `${selectedData.sku} - ${selectedData.name}`
              : "เลือกสินค้า..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="พิมพ์ค้นหา SKU หรือชื่อสินค้า..."
            value={searchQuery}
            onValueChange={setSearchQuery}
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
                  value={`${p.sku} ${p.name}`}
                  onSelect={() => {
                    // 💡 ส่งข้อมูลสินค้ากลับไปให้หน้า Form เช็คสถานะ S/N
                    onChange(p.id, p);
                    setSelectedData(p);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === p.id ? "opacity-100" : "opacity-0",
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
  );
}
