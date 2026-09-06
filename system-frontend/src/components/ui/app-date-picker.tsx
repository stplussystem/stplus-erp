"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type AppDatePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function AppDatePicker({
  value,
  onChange,
  placeholder = "เลือกวันที่",
  disabled = false,
  className,
}: AppDatePickerProps) {
  // 🛡️ value อาจมาจาก field ที่ backend cast เป็น 'date' ซึ่ง serialize เป็น ISO datetime เต็ม
  // (เช่น "2026-08-01T00:00:00.000000Z") ไม่ใช่แค่ "YYYY-MM-DD" — ตัดเอาแค่ 10 ตัวแรกกันพัง
  // แล้วเช็คซ้ำว่า parse ได้จริงก่อนส่งเข้า format() กัน RangeError "Invalid time value" ทำหน้าล่มทั้งหน้า
  const parsedDate = value ? new Date(`${value.slice(0, 10)}T00:00:00`) : undefined;
  const selectedDate =
    parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-10 px-4 rounded-xl",
            "justify-start text-left font-normal",
            "border border-slate-200 bg-white",
            "hover:bg-slate-50 hover:border-slate-300",
            "focus-visible:border-blue-500",
            "focus-visible:ring-2 focus-visible:ring-blue-100",
            "cursor-pointer",
            !value && "text-slate-400",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />

          {selectedDate ? (
            format(selectedDate, "dd/MM/yyyy")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
          }}
          initialFocus
          className="p-3 [--cell-size:2.5rem]"
        />
      </PopoverContent>
    </Popover>
  );
}
