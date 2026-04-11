/* eslint-disable react-hooks/static-components */
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
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
  LayoutDashboard,
  History,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // 💡 เพิ่มฟังก์ชันนี้ไว้นอกตัว AppLayout (บนสุดหรือล่างสุดของไฟล์)
  const SidebarItem = ({
    icon,
    title,
    children,
    isOpen,
    onToggle,
    active,
  }: any) => (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors",
          active
            ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
        )}
      >
        <div className="flex items-center gap-3">
          {React.cloneElement(icon, { strokeWidth: 1.5, className: "w-5 h-5" })}
          <span className="font-medium text-sm">{title}</span>
        </div>
        {children &&
          (isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          ))}
      </button>
      {isOpen && children && (
        <div className="ml-5 border-l-2 border-slate-100 dark:border-slate-800 pl-3.5 space-y-1 animate-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"sidebar" | "topbar">("sidebar");

  // 💡 State สำหรับการกางเมนูใน Sidebar
  const [isInventoryOpen, setIsInventoryOpen] = useState(true);
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedMode = localStorage.getItem("stplus_layout") as
      | "sidebar"
      | "topbar";
    if (savedMode) setLayoutMode(savedMode);
  }, []);

  if (!isMounted) return null;

  const toggleLayout = () => {
    const newMode = layoutMode === "sidebar" ? "topbar" : "sidebar";
    setLayoutMode(newMode);
    localStorage.setItem("stplus_layout", newMode);
  };

  const ThemeIcon = () => {
    if (theme === "light")
      return <Sun className="w-5 h-5 text-amber-500" strokeWidth={1.5} />;
    if (theme === "dark")
      return <Moon className="w-5 h-5 text-blue-400" strokeWidth={1.5} />;
    return <Monitor className="w-5 h-5 text-slate-500" strokeWidth={1.5} />;
  };

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const isActive = (path: string) => pathname === path;

  // 💡 Shared Theme Button (ใช้ทั้ง Sidebar และ Topbar)
  const ThemeSwitcher = () => (
    <button
      onClick={cycleTheme}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer"
    >
      <ThemeIcon />
      <span className="text-xs font-medium hidden sm:inline-block">
        {theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System"}
      </span>
    </button>
  );

  return (
    <div
      className={cn(
        "min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300",
        layoutMode === "topbar" ? "flex flex-col" : "flex",
      )}
    >
      {/* --- SIDEBAR MODE --- */}
      {layoutMode === "sidebar" && (
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col sticky top-0 h-screen shadow-sm z-20">
          <div className="p-5 border-b dark:border-slate-800 flex items-center gap-3">
            <div className="flex-shrink-0 cursor-pointer justify-center items-center">
              <Link href="#">
                {/* รูปสำหรับ Light Mode: ซ่อนเมื่อเป็น Dark (dark:hidden) */}
                <Image
                  src="/logos/logo-web-b.svg"
                  alt="ST PLUS ERP"
                  width={160}
                  height={31}
                  className="dark:hidden block"
                  priority
                />
                {/* รูปสำหรับ Dark Mode: ซ่อนเมื่อเป็น Light (hidden) และโชว์เมื่อเป็น Dark (dark:block) */}
                <Image
                  src="/logos/logo-web-w.svg"
                  alt="ST PLUS ERP"
                  width={160}
                  height={31}
                  className="hidden dark:block"
                  priority
                />
              </Link>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar text-sm">
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer group",
                isActive("/dashboard")
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
            >
              <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} />
              <span className="font-medium">Dashboard</span>
            </Link>

            {/* --- ก้อนเมนู: คลังสินค้า (Nested) --- */}
            <div className="space-y-1">
              <button
                onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                className="w-full flex items-center justify-between p-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5" strokeWidth={1.5} />
                  <span className="font-medium">คลังสินค้า</span>
                </div>
                {isInventoryOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {isInventoryOpen && (
                // 💡 ใช้ border-l-2 เพื่อให้เส้นดูเด่น และ pl-3.5 เพื่อเว้นช่องไฟให้โปร่ง
                <div className="ml-5 border-l-2 border-slate-200 dark:border-slate-800 pl-3.5 space-y-0.5 text-[13px]">
                  <Link
                    href="/products"
                    className={cn(
                      "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer",
                      isActive("/products")
                        ? "text-blue-600 font-semibold"
                        : "text-slate-500 hover:text-blue-500",
                    )}
                  >
                    <PackageOpen className="w-4 h-4" strokeWidth={1.5} />{" "}
                    รายการสินค้า
                  </Link>

                  {/* ซ้อนชั้นที่ 2: รับเข้า */}
                  <button
                    onClick={() => setIsStockInOpen(!isStockInOpen)}
                    className="w-full flex items-center justify-between p-2 text-slate-500 hover:text-blue-500 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <PackagePlus className="w-4 h-4" strokeWidth={1.5} />{" "}
                      รับสินค้าเข้าคลัง
                    </div>
                    {isStockInOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                  {isStockInOpen && (
                    <div className="ml-4 space-y-1 text-xs border-l border-slate-200 dark:border-slate-800 pl-0">
                      <Link
                        href="/stock/in/single"
                        className="block p-1.5 rounded text-slate-400 hover:text-blue-400 cursor-pointer"
                      >
                        - รับเข้าทีละรายการ
                      </Link>
                      <Link
                        href="/stock/in/multi"
                        className="block p-1.5 rounded text-slate-400 hover:text-blue-400 cursor-pointer"
                      >
                        - รับเข้าหลายรายการ
                      </Link>
                      <Link
                        href="/stock/in/po"
                        className="block p-1.5 rounded text-slate-400 hover:text-blue-400 cursor-pointer"
                      >
                        - รับจากใบสั่งซื้อ (PO)
                      </Link>
                    </div>
                  )}

                  {/* ซ้อนชั้นที่ 2: เบิกออก */}
                  <button
                    onClick={() => setIsStockOutOpen(!isStockOutOpen)}
                    className="w-full flex items-center justify-between p-2 text-slate-500 hover:text-blue-500 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <PackageMinus className="w-4 h-4" strokeWidth={1.5} />{" "}
                      เบิกสินค้าออก
                    </div>
                    {isStockOutOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                  {isStockOutOpen && (
                    <div className="ml-4 space-y-1 text-xs border-l border-slate-200 dark:border-slate-800 pl-0">
                      <Link
                        href="/stock/out/single"
                        className="block p-1.5 rounded text-slate-400 hover:text-blue-400 cursor-pointer"
                      >
                        - เบิกออกทีละรายการ
                      </Link>
                      <Link
                        href="/stock/out/multi"
                        className="block p-1.5 rounded text-slate-400 hover:text-blue-400 cursor-pointer"
                      >
                        - เบิกออกหลายรายการ
                      </Link>
                      <Link
                        href="/stock/out/po"
                        className="block p-1.5 rounded text-slate-400 hover:text-blue-400 cursor-pointer"
                      >
                        - เบิกออกจากใบสั่งซื้อ (PO)
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/customers"
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer group",
                isActive("/customers")
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
            >
              <Users className="w-5 h-5" strokeWidth={1.5} />
              <span className="font-medium">จัดการลูกค้า</span>
            </Link>
          </nav>

          <div className="p-4 border-t dark:border-slate-800 space-y-2 text-sm bg-slate-50/50 dark:bg-slate-800/20">
            <ThemeSwitcher />
            <button
              onClick={toggleLayout}
              className="w-full flex items-center justify-center gap-2 p-2 border rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" strokeWidth={1.5} />{" "}
              สลับเป็นเมนูด้านบน
            </button>
          </div>
        </aside>
      )}

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 flex flex-col min-w-0">
        {layoutMode === "topbar" && (
          <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 cursor-pointer justify-center items-center">
                  <Link href="#">
                    {/* รูปสำหรับ Light Mode: ซ่อนเมื่อเป็น Dark (dark:hidden) */}
                    <Image
                      src="/logos/logo-web-b.svg"
                      alt="ST PLUS ERP"
                      width={160}
                      height={31}
                      className="dark:hidden block"
                      priority
                    />
                    {/* รูปสำหรับ Dark Mode: ซ่อนเมื่อเป็น Light (hidden) และโชว์เมื่อเป็น Dark (dark:block) */}
                    <Image
                      src="/logos/logo-web-w.svg"
                      alt="ST PLUS ERP"
                      width={160}
                      height={31}
                      className="hidden dark:block"
                      priority
                    />
                  </Link>
                </div>
              </div>

              {/* Topbar Menubar (Nested) */}
              <Menubar className="border-none shadow-none bg-transparent">
                <MenubarMenu>
                  <MenubarTrigger className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600">
                    <Package className="w-4 h-4 mr-2" strokeWidth={1.5} />{" "}
                    คลังสินค้า
                  </MenubarTrigger>
                  <MenubarContent
                    align="start"
                    className="w-56 dark:bg-slate-900 dark:border-slate-800 text-sm space-y-2"
                  >
                    <MenubarItem
                      asChild
                      className="cursor-pointer py-2 hover:text-blue-600"
                    >
                      <Link href="/products">
                        <PackageOpen
                          className="w-4 h-4 mr-3"
                          strokeWidth={1.5}
                        />{" "}
                        รายการสินค้า
                      </Link>
                    </MenubarItem>

                    <MenubarSub>
                      <MenubarSubTrigger className="py-2 cursor-pointer">
                        <PackagePlus
                          className="w-4 h-4 mr-3"
                          strokeWidth={1.5}
                        />{" "}
                        รับสินค้าเข้าคลัง
                      </MenubarSubTrigger>
                      <MenubarSubContent className="dark:bg-slate-900 text-sm ml-1 space-y-2">
                        <MenubarItem asChild className="cursor-pointer">
                          <Link href="/stock/in/single">
                            • รับเข้าทีละรายการ
                          </Link>
                        </MenubarItem>
                        <MenubarItem asChild className="cursor-pointer">
                          <Link href="/stock/in/multi">
                            • รับเข้าหลายรายการ
                          </Link>
                        </MenubarItem>
                        <MenubarItem asChild className="cursor-pointer">
                          <Link href="/stock/in/po">
                            • รับจากใบสั่งซื้อ (PO)
                          </Link>
                        </MenubarItem>
                      </MenubarSubContent>
                    </MenubarSub>

                    <MenubarSub>
                      <MenubarSubTrigger className="py-2 cursor-pointer">
                        <PackageMinus
                          className="w-4 h-4 mr-3"
                          strokeWidth={1.5}
                        />{" "}
                        เบิกสินค้าออก
                      </MenubarSubTrigger>
                      <MenubarSubContent className="dark:bg-slate-900 text-sm ml-1 space-y-2">
                        <MenubarItem asChild className="cursor-pointer">
                          <Link href="/stock/out/single">
                            • เบิกออกทีละรายการ
                          </Link>
                        </MenubarItem>
                        <MenubarItem asChild className="cursor-pointer">
                          <Link href="/stock/out/multi">
                            • เบิกออกหลายรายการ
                          </Link>
                        </MenubarItem>
                        <MenubarItem asChild className="cursor-pointer">
                          <Link href="/stock/out/po">
                            • เบิกออกจากใบสั่งซื้อ (PO)
                          </Link>
                        </MenubarItem>
                      </MenubarSubContent>
                    </MenubarSub>
                  </MenubarContent>
                </MenubarMenu>
              </Menubar>
            </div>

            <div className="flex items-center gap-3">
              <ThemeSwitcher />
              <button
                onClick={toggleLayout}
                className="flex items-center text-sm justify-center w-full p-2.5 border bg-white dark:bg-slate-900 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-700 dark:text-slate-200 shadow-sm"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" /> สลับเมนู
              </button>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          {children}
        </main>
      </div>
    </div>
  );
}
