"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface GroupComboboxFieldProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  locked?: boolean; // true = ล็อกค่าไว้ ไม่ให้แก้ (เช่นกดสร้างจากปุ่ม + บนการ์ดกลุ่ม)
  error?: boolean;
  accentColor?: "blue" | "amber"; // blue=Add dialog, amber=Edit dialog (ตาม section 6 สีปุ่มแก้ไข)
}

// 🔀 combobox "เลือกของเดิม หรือพิมพ์สร้างใหม่" — ต้นแบบเดียวกับ Popover+Command ของ
// หมวดหมู่/ยี่ห้อ/หน่วยสินค้าใน products/create/page.tsx แต่ไม่ต้องยิง API สร้าง master data
// ก่อน เพราะ group/sub_group เป็นแค่ string column ตรงบนตาราง permissions เอง
export function GroupComboboxField({
  value,
  onChange,
  options,
  placeholder,
  locked,
  error,
  accentColor = "blue",
}: GroupComboboxFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ring = accentColor === "amber" ? "focus:ring-amber-500" : "focus:ring-blue-500";

  if (locked) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        className="w-full justify-between h-12 px-4 rounded-xl font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-inner"
      >
        {value}
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            "w-full justify-between h-12 px-4 rounded-xl font-medium bg-slate-50 dark:bg-slate-900",
            ring,
            error && "border-red-500 ring-2 ring-red-100",
          )}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl border-slate-200">
        <Command>
          <CommandInput
            placeholder="ค้นหาหรือพิมพ์ชื่อใหม่..."
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="p-4 text-center">
              <p className="text-sm text-slate-500 mb-3">ไม่พบ "{search}"</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full text-blue-600 font-bold rounded-lg cursor-pointer"
                onClick={() => {
                  onChange(search);
                  setOpen(false);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> ใช้ชื่อนี้: "{search}"
              </Button>
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
