import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 🚀 มาตรฐาน input ของโปรเจกต์ (ดู CLAUDE.md หมวด "UI / Input, Select, Dropdown")
        "h-10 w-full min-w-0 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-100",
        className
      )}
      {...props}
    />
  )
}

export { Input }
