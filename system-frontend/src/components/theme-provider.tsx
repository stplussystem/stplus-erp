"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // 💡 ตรวจสอบให้แน่ใจว่าใช้ attribute="class"
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}