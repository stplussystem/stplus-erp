"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

// ✅ import JSON
import bankData from "@/data/banks.json";

// ✅ ดึงข้อมูลไทย
const thBanks = bankData.th;

// ✅ ธนาคารพาณิชย์ของไทย
const popularKeys = [
  "kbank",
  "scb",
  "bbl",
  "ktb",
  "bay",
  "ttb",
  "gsb",
  "kkp",
  "ghb",
  "baac",
  "uob",
  "cimb",
  "tisco",
  "ib",
  "lhb",
  "exim",
  "tcrb",
];

// ✅ แปลง JSON → ใช้งาน
const allBanks = Object.entries(thBanks).map(([key, bank]) => ({
  value: key,
  label: bank.nice_name,
  logo: `/banks/th/${key}.svg`,
  color: bank.color,
}));

// ✅ แยกกลุ่ม
const groupedBanks = [
  {
    group: "ธนาคารของไทย",
    items: allBanks.filter((b) => popularKeys.includes(b.value)),
  },
  {
    group: "ธนาคารต่างประเทศในไทย",
    items: allBanks.filter((b) => !popularKeys.includes(b.value)),
  },
];

export function BankSelect({ value, onChange }: any) {
  const [open, setOpen] = React.useState(false);

  const selected = allBanks.find((b) => b.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-10 cursor-pointer">
          {selected ? (
            <div className="flex items-center gap-2">
              {/* 🚀 แก้ไข: สลับชั้นให้สีอยู่หลัง รูปอยู่หน้า */}
              <div className="w-5 h-5 relative flex items-center justify-center">
                <div
                  className="w-full h-full rounded-sm absolute top-0 left-0"
                  style={{ backgroundColor: selected.color }}
                />
                <img
                  src={selected.logo}
                  className="w-full h-full object-contain relative z-10 rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>

              {selected.label}
            </div>
          ) : (
            "เลือกธนาคาร"
          )}

          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="ค้นหาธนาคาร..." />
          <CommandList className="max-h-[350px] overflow-y-auto custom-scrollbar">
            <CommandEmpty>ไม่พบธนาคาร</CommandEmpty>

            {groupedBanks.map((group) => (
              <CommandGroup key={group.group} heading={group.group}>
                {group.items.map((bank) => (
                  <CommandItem
                    key={bank.value}
                    value={bank.label}
                    onSelect={() => {
                      onChange(bank.value);
                      setOpen(false);
                    }}
                  >
                    {/* 🚀 แก้ไข: สลับชั้นให้สีอยู่หลัง รูปอยู่หน้า */}
                    <div className="w-5 h-5 mr-2 relative flex items-center justify-center">
                      <div
                        className="w-full h-full rounded-[20%] absolute top-0 left-0"
                        style={{ backgroundColor: bank.color }}
                      />
                      <img
                        src={bank.logo}
                        className="w-full h-full object-contain relative z-10"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>

                    {bank.label}

                    <Check
                      className={cn(
                        "ml-auto",
                        value === bank.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
