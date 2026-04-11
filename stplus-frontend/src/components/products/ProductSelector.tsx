"use client";
import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
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

// 💡 สมมติข้อมูลสินค้า (เดี๋ยวพี่ค่อยเชื่อมกับ API จริงนะครับ)
const products = [
  { value: "bs-1030b", label: "BS-1030B - ลำโพง TOA BS-1030B" },
  { value: "er0001", label: "ER0001 - ลำโพง" },
  { value: "ry001258", label: "RY001258 - BOSE" },
  { value: "it-0001", label: "IT-0001 - คอมพิวเตอร์พกพา (Laptop)" },
];

export function ProductSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal border-slate-200 dark:border-slate-800 h-10 bg-white dark:bg-slate-900 cursor-pointer"
        >
          {value
            ? products.find((p) => p.value === value)?.label
            : "เลือกสินค้า..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 dark:border-slate-800">
        <Command className="dark:bg-slate-900">
          <CommandInput placeholder="พิมพ์ค้นหา SKU หรือชื่อสินค้า..." className="h-9" />
          <CommandList className="max-h-[300px] custom-scrollbar">
            <CommandEmpty>ไม่พบข้อมูลสินค้า</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.value}
                  value={product.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  className="cursor-pointer py-2"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === product.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {product.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}