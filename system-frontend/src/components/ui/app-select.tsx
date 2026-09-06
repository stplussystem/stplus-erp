import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type AppSelectProps = {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];

  placeholder?: string;
  disabled?: boolean;
  error?: boolean;

  triggerClassName?: string;
  contentClassName?: string;
};

export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder = "กรุณาเลือก",
  disabled = false,
  error = false,
  triggerClassName,
  contentClassName,
}: AppSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          // UI มาตรฐานที่ใช้เหมือนกันทุกหน้า
          "h-10 w-full rounded-xl border border-slate-200",
          "bg-white px-4 text-sm text-slate-700",
          "cursor-pointer outline-none",
          "focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
          "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60",

          // Error
          error && "border-red-500 focus:border-red-500 focus:ring-red-100",

          // สำหรับกรณีพิเศษของบางหน้า
          triggerClassName,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent
        position="popper"
        side="bottom"
        sideOffset={6}
        align="start"
        className={cn(
          "w-[var(--radix-select-trigger-width)] rounded-xl p-1", //แก้ขนาดข้อความตัวเลือก
          contentClassName,
        )}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="rounded-lg px-3 py-2 text-sm"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
