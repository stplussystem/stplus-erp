/* eslint-disable react-hooks/static-components */
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import Image from "next/image";
import {
  Package,
  PackagePlus,
  PackageMinus,
  Users,
  FileText,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  PackageOpen,
} from "lucide-react";
import {
  IconPackage,
  IconStockIn,
  IconStockOut,
} from "@/components/ui/app-icons";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"sidebar" | "topbar">("sidebar");
  const [isInventoryOpen, setIsInventoryOpen] = useState(true);
  const [isSalesOpen, setIsSalesOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedMode = localStorage.getItem("stplus_layout") as
      | "sidebar"
      | "topbar";
    if (savedMode) setLayoutMode(savedMode);
  }, []);

  // 💡 ป้องกันอาการจอขาว/ไอคอนหายตอนโหลดหน้าเว็บ
  if (!isMounted) return null;

  const toggleLayout = () => {
    const newMode = layoutMode === "sidebar" ? "topbar" : "sidebar";
    setLayoutMode(newMode);
    localStorage.setItem("stplus_layout", newMode);
  };

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  // 💡 ส่วนแสดงไอคอนธีม (ปรับขนาดให้พอดี 20px)
  const ThemeIcon = () => {
    if (theme === "light") return <Sun className="w-5 h-5 text-orange-500" />;
    if (theme === "dark") return <Moon className="w-5 h-5 text-blue-400" />;
    return <Monitor className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div
      className={`flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-sm ${layoutMode === "sidebar" ? "flex-row" : "flex-col"}`}
    >
      {/* ================= TOPBAR ================= */}
      {layoutMode === "topbar" && (
        <header className="w-full border-b bg-white dark:bg-slate-900 px-6 py-3 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex-shrink-0 cursor-pointer">
              <Link href="#">
                {/* รูปสำหรับ Light Mode: ซ่อนเมื่อเป็น Dark (dark:hidden) */}
                <Image
                  src="/logos/logo-web-b.svg"
                  alt="ST PLUS ERP"
                  width={150}
                  height={40}
                  className="dark:hidden block"
                  priority
                />
                {/* รูปสำหรับ Dark Mode: ซ่อนเมื่อเป็น Light (hidden) และโชว์เมื่อเป็น Dark (dark:block) */}
                <Image
                  src="/logos/logo-web-w.svg"
                  alt="ST PLUS ERP"
                  width={150}
                  height={40}
                  className="hidden dark:block"
                  priority
                />
              </Link>
            </div>

            <Menubar className="border-none shadow-none bg-transparent">
              <MenubarMenu>
                <MenubarTrigger className="cursor-pointer text-base font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600">
                  <Package className="w-4 h-4 mr-2" /> คลังสินค้า
                </MenubarTrigger>
                <MenubarContent
                  align="start"
                  className="w-50 dark:bg-slate-900 dark:border-slate-800"
                >
                  <MenubarItem asChild className="cursor-pointer py-2 hover:text-blue-600 hover:bg-gray-200">
                    <Link href="/products">
                      <PackageOpen className="w-5 h-5 mr-3" /> รายการสินค้า
                    </Link>
                  </MenubarItem>
                  <MenubarItem
                    asChild
                    className="cursor-pointer py-2 hover:text-blue-600 hover:bg-gray-200"
                  >
                    <Link href="/stock/in">
                      <PackagePlus className="w-5 h-5 mr-3" /> รับสินค้าเข้าคลัง
                    </Link>
                  </MenubarItem>
                  <MenubarItem asChild className="cursor-pointer py-2 hover:text-blue-600 hover:bg-gray-200">
                    <Link href="/stock/out">
                      <PackageMinus className="w-5 h-5 mr-3" /> เบิกสินค้าออก
                    </Link>
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={cycleTheme}
              className="p-2.5 border rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center min-w-[44px]"
            >
              <ThemeIcon />
            </button>
            <button
              onClick={toggleLayout}
              className="flex items-center px-4 py-2.5 border rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-900 shadow-sm"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" /> สลับรูปแบบเมนู
            </button>
          </div>
        </header>
      )}

      {/* ================= SIDEBAR ================= */}
      {layoutMode === "sidebar" && (
        <aside className="w-64 border-r bg-white dark:bg-slate-900 flex flex-col shadow-sm">
          <div className="p-4 border-b flex justify-center items-center">
            <div className="flex-shrink-0 cursor-pointer">
              <Link href="#">
                {/* รูปสำหรับ Light Mode: ซ่อนเมื่อเป็น Dark (dark:hidden) */}
                <Image
                  src="/logos/logo-web-b.svg"
                  alt="ST PLUS ERP"
                  width={180}
                  height={40}
                  className="dark:hidden block"
                  priority
                />
                {/* รูปสำหรับ Dark Mode: ซ่อนเมื่อเป็น Light (hidden) และโชว์เมื่อเป็น Dark (dark:block) */}
                <Image
                  src="/logos/logo-web-w.svg"
                  alt="ST PLUS ERP"
                  width={180}
                  height={40}
                  className="hidden dark:block"
                  priority
                />
              </Link>
            </div>
          </div>

          <nav className="flex-1 p-3 flex flex-col gap-2 overflow-y-auto">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                className="flex items-center justify-between px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md font-bold transition cursor-pointer w-full text-left"
              >
                <div className="flex items-center">
                  <Package className="w-5 h-5 mr-3 text-blue-600" />
                  คลังสินค้า
                </div>
                {isInventoryOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              {isInventoryOpen && (
                <div className="flex flex-col gap-1 pl-9 pr-2 pb-2">
                  <Link
                    href="/products"
                    className="flex items-center px-1 py-1.5 text-slate-600 hover:bg-gray-200 hover:text-blue-700 rounded-md font-medium transition cursor-pointer"
                  >
                    <PackageOpen className="w-4 h-4 mr-3 text-blue-600" />{" "}
                    รายการสินค้า
                  </Link>
                  <Link
                    href="/stock/in"
                    className="flex items-center px-1 py-1.5 text-slate-600 hover:bg-gray-200 hover:text-blue-700 rounded-md font-medium transition cursor-pointer"
                  >
                    <PackagePlus className="w-4 h-4 mr-3 text-blue-600" />{" "}
                    รับสินค้าเข้า
                  </Link>
                  <Link
                    href="/stock/out"
                    className="flex items-center px-1 py-1.5 text-slate-600 hover:bg-gray-200 hover:text-blue-700 rounded-md font-medium transition cursor-pointer"
                  >
                    <PackageMinus className="w-4 h-4 mr-3 text-blue-600" />{" "}
                    เบิกสินค้าออก
                  </Link>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <button
                onClick={() => setIsSalesOpen(!isSalesOpen)}
                className="flex items-center justify-between px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md font-bold transition cursor-pointer w-full text-left"
              >
                <div className="flex items-center">
                  <span className="mr-3 text-lg">👥</span> ลูกค้า & การขาย
                </div>
                {isSalesOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              {isSalesOpen && (
                <div className="flex flex-col gap-1 pl-9 pr-2 pb-2">
                  <Link
                    href="#"
                    className="py-2 text-slate-600 dark:text-slate-400 hover:text-orange-600 transition cursor-pointer"
                  >
                    จัดการลูกค้า
                  </Link>
                  <Link
                    href="#"
                    className="py-2 text-slate-600 dark:text-slate-400 hover:text-orange-600 transition cursor-pointer"
                  >
                    📄 ใบเสนอราคา
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* 💡 ส่วนล่างสุดของ Sidebar: ปรับปรุงให้เป็นระเบียบ */}
          <div className="p-4 border-t bg-slate-50 dark:bg-slate-800/30 flex flex-col gap-3">
            <button
              onClick={cycleTheme}
              className="flex items-center justify-center w-full p-2.5 border bg-white dark:bg-slate-900 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer font-bold text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <div className="mr-2 flex items-center justify-center w-6 h-6">
                <ThemeIcon />
              </div>
              {theme === "light"
                ? "โหมดสว่าง"
                : theme === "dark"
                  ? "โหมดมืด"
                  : "ตามระบบ"}
            </button>
            <button
              onClick={toggleLayout}
              className="flex items-center justify-center w-full p-2.5 border bg-white dark:bg-slate-900 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer font-bold text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" /> สลับรูปแบบเมนู
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
