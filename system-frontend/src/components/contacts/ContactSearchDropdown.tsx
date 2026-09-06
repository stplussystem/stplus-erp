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
import { ChevronsUpDown, Check, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";

interface ContactSearchDropdownProps {
  value: string;
  selectedName?: string;
  selectedCode?: string;
  onChange: (contactId: string, contactData: any) => void;
  disabled?: boolean;
  hasError?: boolean;
}

export function ContactSearchDropdown({
  value,
  selectedName,
  selectedCode,
  onChange,
  disabled = false,
  hasError = false,
}: ContactSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // 🚀 ฟังก์ชันยิงไปดึงข้อมูลจากหลังบ้าน (จะส่ง query search ไปด้วย)
  const fetchContacts = useCallback(async (query: string) => {

    // 🛑 [เพิ่มใหม่] ถ้าช่องค้นหาว่างเปล่า ให้ล้างข้อมูลทิ้งและหยุดยิง API ทันที!
    if (!query || query.trim() === "") {
      setContacts([]);
      return;
    }
    
    setIsFetching(true);
    try {
      const token = getToken();
      // กำหนดให้ดึงมาแค่ 20 รายการ เพื่อให้เบาที่สุด
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contacts?search=${query}&per_page=20`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (res.ok) {
        const json = await res.json();
        setContacts(json.data?.data || json.data || json || []);
      }
    } catch (error) {
      console.error("ดึงข้อมูลผู้ติดต่อไม่สำเร็จ", error);
    } finally {
      setIsFetching(false);
    }
  }, []);

  // 🚀 ทำ Debounce 300ms: ให้ผู้ใช้พิมพ์เสร็จก่อนค่อยยิง API
  useEffect(() => {
    if (!open) return; // ถ้าไม่ได้เปิด Dropdown อยู่ ไม่ต้องยิง

    const timer = setTimeout(() => {
      fetchContacts(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, open, fetchContacts]);

  return (
    <Popover
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) setSearch(""); // เคลียร์คำค้นหาเมื่อปิด
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
          {value && selectedName ? (
            <div className="flex items-center gap-2 truncate">
              {selectedCode && (
                <span className="font-bold text-muted-foreground">
                  [{selectedCode}]
                </span>
              )}
              <span className="truncate text-foreground font-medium">
                {selectedName}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              -- ค้นหาและระบุผู้จำหน่าย/ร้านค้า --
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
            placeholder="พิมพ์ชื่อร้าน, รหัสบริษัท, หรือเลขภาษี..."
            value={search}
            onValueChange={setSearch}
            className="h-11 text-sm"
          />
          <CommandList>
            {isFetching && (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />{" "}
                กำลังค้นหาข้อมูลจากเซิร์ฟเวอร์...
              </div>
            )}

            {!isFetching && contacts.length === 0 && (
              <CommandEmpty>ไม่พบข้อมูลผู้จำหน่าย</CommandEmpty>
            )}

            <CommandGroup>
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id.toString()}
                  className="cursor-pointer py-3"
                  onSelect={() => {
                    onChange(c.id.toString(), c);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <Check
                        className={cn(
                          "h-4 w-4 text-blue-600",
                          value === c.id.toString()
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground text-sm">
                          {c.business_name || c.contact_name}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" />
                          รหัส: {c.contact_code || "-"} | เลขภาษี:{" "}
                          {c.tax_id || "-"}
                        </span>
                      </div>
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
