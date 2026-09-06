"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function ProductFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("search") || "";
  const currentPerPage = searchParams.get("per_page") || "10";

  // สร้าง State ไว้เก็บข้อความที่กำลังพิมพ์แบบ Real-time
  const [inputValue, setInputValue] = useState(currentSearch);

  // ฟังก์ชันสำหรับอัปเดต URL เมื่อมีการค้นหา หรือเปลี่ยนจำนวนแสดงผล
  const updateQuery = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);

    params.set("page", "1"); // ถ่าค้นหาใหม่ ให้กลับไปหน้า 1 เสมอ
    router.push(`${pathname}?${params.toString()}`);
  };

  // "Debounce" (หน่วงเวลาค้นหา)
  useEffect(() => {
    // ตั้งเวลาหน่วง 500 มิลลิวินาที (0.5 วินาที)
    const timer = setTimeout(() => {
      // ถ้าคำที่พิมพ์ ไม่ตรงกับใน URL ปัจจุบัน ค่อยสั่งอัปเดต URL เพื่อยิง API ค้นหา
      if (inputValue !== currentSearch) {
        updateQuery("search", inputValue);
      }
    }, 500);

    // ถ้ามีการพิมพ์ต่อก่อนครบ 0.5 วินาที ให้ยกเลิกการนับเวลาเก่าทิ้งไป (ไม่ยิง API พร่ำเพรื่อ)
    return () => clearTimeout(timer);
  }, [inputValue, currentSearch]); // ระบบจะทำงานทุกครั้งที่ค่าช่อง Input เปลี่ยน

  // 💡 4. ฟังก์ชันสำหรับปุ่ม X (เคลียร์ค่าทั้งหมด)
  const handleClear = () => {
    setInputValue("");
    updateQuery("search", "");
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center w-full">
      <div className="relative w-full sm:w-[350px]">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="ค้นหา SKU, ชื่อ, รุ่น..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="h-10 pl-9 pr-9"
          // ค้นหาเมื่อกด Enter หรือเมื่อคลิกออกนอกกล่อง
          // onKeyDown={(e) =>
          //   e.key === "Enter" && updateQuery("search", e.currentTarget.value)
          // }
          // onBlur={(e) => updateQuery("search", e.target.value)}
        />

        {/* ปุ่ม X เคลียร์คำค้นหา จะโผล่มาเฉพาะตอนมีข้อความเท่านั้น */}
        {inputValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1.5 h-6 w-6 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-sm text-slate-500 whitespace-nowrap">
          แสดงหน้าละ:
        </span>
        <AppSelect
          value={currentPerPage}
          onValueChange={(val) => updateQuery("per_page", val)}
          triggerClassName="w-[80px]"
          options={[
            { value: "10", label: "10" },
            { value: "20", label: "20" },
            { value: "50", label: "50" },
            { value: "100", label: "100" },
          ]}
        />
      </div>
    </div>
  );
}
