"use client";
import React, { useMemo, useState } from "react";
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
import { ChevronsUpDown, Check, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type VendorOption = { id: number; business_name?: string; contact_person_name?: string; contact_code?: string };

interface VendorSearchDropdownProps {
  value: string;
  vendors: VendorOption[];
  onChange: (vendorId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  allowAll?: boolean; // 🆕 ใช้เป็นตัวกรองในหน้ารายการ — เพิ่มตัวเลือก "ผู้จำหน่ายทั้งหมด" ที่หัวรายการ
}

// 🆕 กรองรายชื่อผู้จำหน่ายด้วยการพิมพ์ค้นหา (client-side — รายชื่อผู้จำหน่ายทั้งหมดโหลดมาอยู่ในมือแล้วจากหน้าเรียก
// ใช้ ไม่ต้องยิง API ซ้ำเหมือน ContactSearchDropdown) แทน AppSelect ธรรมดาที่ต้องไล่สายตาหาทีละแถวเวลามีผู้จำหน่าย
// เยอะๆ — ใช้แทน AppSelect ทุกจุดที่เลือกผู้จำหน่ายในโมดูล Price List (ตัวกรองหน้ารายการ, ก่อน export/import,
// ฟอร์มเพิ่ม/แก้ไขรายการด้วยมือ)
export function VendorSearchDropdown({
  value,
  vendors,
  onChange,
  placeholder = "-- เลือกผู้จำหน่าย --",
  disabled = false,
  hasError = false,
  allowAll = false,
}: VendorSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = vendors.find((v) => String(v.id) === value);
  const selectedLabel = selected ? selected.business_name || selected.contact_person_name : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      (v.business_name || "").toLowerCase().includes(q) ||
      (v.contact_person_name || "").toLowerCase().includes(q) ||
      (v.contact_code || "").toLowerCase().includes(q),
    );
  }, [vendors, search]);

  return (
    <Popover
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) setSearch("");
      }}
    >
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
          {value === "all" && allowAll ? (
            <span className="text-foreground">ผู้จำหน่ายทั้งหมด</span>
          ) : selectedLabel ? (
            <span className="truncate text-foreground font-medium">{selectedLabel}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[350px] p-0 shadow-xl rounded-xl border border-border" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="พิมพ์ชื่อผู้จำหน่ายเพื่อค้นหา..."
            value={search}
            onValueChange={setSearch}
            className="h-11 text-sm"
          />
          <CommandList>
            {filtered.length === 0 && <CommandEmpty>ไม่พบผู้จำหน่าย</CommandEmpty>}
            <CommandGroup>
              {allowAll && (
                <CommandItem
                  value="all"
                  className="cursor-pointer py-2.5"
                  onSelect={() => {
                    onChange("all");
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 text-blue-600", value === "all" ? "opacity-100" : "opacity-0")} />
                  ผู้จำหน่ายทั้งหมด
                </CommandItem>
              )}
              {filtered.map((v) => (
                <CommandItem
                  key={v.id}
                  value={String(v.id)}
                  className="cursor-pointer py-2.5"
                  onSelect={() => {
                    onChange(String(v.id));
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Check className={cn("h-4 w-4 text-blue-600 shrink-0", value === String(v.id) ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground text-sm">
                        {v.business_name || v.contact_person_name}
                      </span>
                      {v.contact_code && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {v.contact_code}
                        </span>
                      )}
                    </div>
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
