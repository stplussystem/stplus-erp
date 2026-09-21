"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AppLoadingProps = {
  text?: string;
  className?: string;
  minHeight?: string;
  // spinner = ไอคอนหมุน (ค่าเริ่มต้น) | bar = แถบหลอดโหลด — ใช้กับหน้าจอเต็มตอนตรวจสอบสิทธิ์หลังล็อกอิน
  variant?: "spinner" | "bar";
};

// 🆕 [2026-09-21] แถบหลอดโหลด: ไม่รู้ความคืบหน้าจริงของการตรวจสอบสิทธิ์ จึงวิ่งเร็วช่วงแรกแล้วค่อยๆ ชะลอเข้าใกล้ 94%
// (ไม่เต็ม 100% จนกว่าหน้าจริงจะมาแทนที่ component นี้) ให้เห็นว่ากำลังทำงานอยู่ ไม่ค้าง
function LoadingBar() {
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => p + (94 - p) * 0.07);
    }, 200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="h-2.5 w-64 max-w-[70vw] overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-blue-600 transition-[width] duration-300 ease-out",
          progress > 88 && "animate-pulse", // ใกล้เพดานแล้วแต่ยังโหลดอยู่ — กะพริบให้รู้ว่าไม่ได้ค้าง
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function AppLoading({
  text = "กำลังโหลดข้อมูล...",
  className,
  minHeight = "min-h-[300px]",
  variant = "spinner",
}: AppLoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        minHeight,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {variant === "bar" ? (
        <LoadingBar />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      )}

      <span className="text-sm font-medium">
        {text}
      </span>
    </div>
  );
}
