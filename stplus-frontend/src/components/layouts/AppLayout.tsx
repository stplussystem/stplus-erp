/* eslint-disable react-hooks/static-components */
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

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
  Package, PackagePlus, PackageMinus, Users, ArrowRightLeft, 
  ChevronDown, ChevronRight, Sun, Moon, Monitor, PackageOpen, 
  LayoutDashboard, Bell, CheckCheck, LogOut, ShieldCheck, Settings,
  History, X
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  
  const [isMounted, setIsMounted] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"sidebar" | "topbar">("sidebar");

  // 💡 State สำหรับควบคุมการเปิด-ปิดเมนู
  const [isInventoryOpen, setIsInventoryOpen] = useState(true);
  const [isStockInOpen, setIsStockInOpen] = useState(true); 
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // 💡 ฟังก์ชันจัดการการเปิดเมนู (เปิดอันใหม่ ปิดอันเก่า)
  const toggleInventory = () => {
    setIsInventoryOpen(!isInventoryOpen);
    // ถ้าเมนูหลักอื่นมีเพิ่มในอนาคต ให้สั่งปิดที่นี่ครับ
  };

  const toggleStockIn = () => {
    if (!isStockInOpen) {
      setIsStockOutOpen(false); // ปิดเบิกออก ถ้าจะเปิดรับเข้า
    }
    setIsStockInOpen(!isStockInOpen);
  };

  const toggleStockOut = () => {
    if (!isStockOutOpen) {
      setIsStockInOpen(false); // ปิดรับเข้า ถ้าจะเปิดเบิกออก
    }
    setIsStockOutOpen(!isStockOutOpen);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("stplus_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      if (token) {
        await fetch(`${apiUrl}/logout`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("stplus_token");
      localStorage.removeItem("stplus_user");
      document.cookie = "stplus_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
      toast.success("ออกจากระบบเรียบร้อยแล้ว");
      router.push("/login");
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("stplus_token");
      if (!token) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/notifications/unread`, {
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const savedMode = localStorage.getItem("stplus_layout") as "sidebar" | "topbar";
    if (savedMode) setLayoutMode(savedMode);
    
    if (pathname !== "/login") {
      fetchNotifications();
      const intervalId = setInterval(fetchNotifications, 10000);
      return () => clearInterval(intervalId);
    }
  }, [pathname]);

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("stplus_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      await fetch(`${apiUrl}/notifications/mark-read`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
      });
      setNotifications([]);
      setIsNotifOpen(false);
      toast.success("อ่านทั้งหมดแล้ว");
    } catch (error) {
      console.error(error);
    }
  };

  if (!isMounted) return null;
  if (pathname === "/login") return <div className="font-sans antialiased">{children}</div>;

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

  const ThemeIcon = () => {
    if (theme === "light") return <Sun className="w-5 h-5 text-amber-500" strokeWidth={1.5} />;
    if (theme === "dark") return <Moon className="w-5 h-5 text-blue-400" strokeWidth={1.5} />;
    return <Monitor className="w-5 h-5 text-slate-500" strokeWidth={1.5} />;
  };

  const isActive = (path: string) => pathname === path;

  // 💡 Notification Modal กลางจอ (คงเดิม 100%)
  const NotificationBell = () => (
    <>
      <button 
        onClick={() => setIsNotifOpen(true)} 
        className="relative p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shadow-sm"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" strokeWidth={1.5} />
        {notifications.length > 0 && (
          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        )}
      </button>

      {isNotifOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-lg text-foreground">รายการแจ้งเตือน</span>
              </div>
              <button onClick={() => setIsNotifOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-foreground">
                 <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500">ไม่มีการแจ้งเตือนใหม่</div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <p className="text-sm font-semibold text-foreground">{notif.data.message}</p>
                    <p className="text-[11px] text-slate-400 mt-2">ผู้แจ้ง: {notif.data.user}</p>
                  </div>
                ))
              )}
            </div>
            {notifications.length > 0 && (
              <div className="p-4 border-t dark:border-slate-700">
                <button onClick={markAllAsRead} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                  <CheckCheck className="w-5 h-5" /> อ่านทั้งหมดแล้ว
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={cn("min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased", layoutMode === "topbar" ? "flex flex-col" : "flex")}>
      
      {/* 🟢 SIDEBAR MODE (โครงสร้างเดิม 100% เพิ่ม Logic หุบเมนูอัตโนมัติ) */}
      {layoutMode === "sidebar" && (
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col sticky top-0 h-screen shadow-sm z-20">
          <div className="p-5 border-b dark:border-slate-800">
            <Link href="/dashboard">
              <Image src="/logos/logo-web-b.svg" alt="ST PLUS ERP" width={160} height={31} className="dark:hidden block" priority />
              <Image src="/logos/logo-web-w.svg" alt="ST PLUS ERP" width={160} height={31} className="hidden dark:block" priority />
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar text-sm">
            <Link href="/dashboard" className={cn("flex items-center gap-3 p-2.5 rounded-xl transition-all", isActive("/dashboard") ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}>
              <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} />
              <span className="font-medium">Dashboard</span>
            </Link>
            
            <div className="space-y-1">
              {/* เลเวล 1: คลังสินค้า */}
              <button onClick={toggleInventory} className="w-full flex items-center justify-between p-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-3"><Package className="w-5 h-5" strokeWidth={1.5} /><span className="font-medium">คลังสินค้า</span></div>
                  {isInventoryOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {isInventoryOpen && (
                <div className="ml-4 border-l-2 border-slate-200 dark:border-slate-800 pl-2 space-y-1">
                  <Link href="/products" className={cn("flex items-center gap-2.5 p-2 rounded-lg transition-colors", isActive("/products") ? "bg-blue-50 text-blue-600 font-bold dark:bg-blue-900/20" : "text-slate-500 hover:text-blue-600 dark:text-slate-400")}>
                    <PackageOpen className="w-4 h-4" strokeWidth={1.5} /> รายการสินค้า
                  </Link>

                  {/* เลเวล 2: รับสินค้าเข้าคลัง */}
                  <div className="space-y-1">
                    <button onClick={toggleStockIn} className="w-full flex items-center justify-between p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 rounded-lg transition-colors">
                      <div className="flex items-center gap-2.5"><PackagePlus className="w-4 h-4" /> <span>รับสินค้าเข้าคลัง</span></div>
                      {isStockInOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    {isStockInOpen && (
                      <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-3 space-y-1">
                        <Link href="/stock/in/single" className={cn("block py-1.5 text-xs transition-all", isActive("/stock/in/single") ? "text-blue-600 font-bold" : "text-slate-400 hover:text-blue-600")}>- รับเข้าทีละรายการ</Link>
                        <Link href="/stock/in/multi" className={cn("block py-1.5 text-xs transition-all", isActive("/stock/in/multi") ? "text-blue-600 font-bold" : "text-slate-400 hover:text-blue-600")}>- รับเข้าหลายรายการ</Link>
                        <Link href="/stock/in/po" className={cn("block py-1.5 text-xs transition-all", isActive("/stock/in/po") ? "text-blue-600 font-bold" : "text-slate-400 hover:text-blue-600")}>- รับจากใบสั่งซื้อ (PO)</Link>
                      </div>
                    )}
                  </div>

                  {/* เลเวล 2: เบิกสินค้าออก */}
                  <div className="space-y-1">
                    <button onClick={toggleStockOut} className="w-full flex items-center justify-between p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 rounded-lg transition-colors">
                      <div className="flex items-center gap-2.5"><PackageMinus className="w-4 h-4" /> <span>เบิกสินค้าออก</span></div>
                      {isStockOutOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    {isStockOutOpen && (
                      <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-3 space-y-1">
                        <Link href="/stock/out/single" className={cn("block py-1.5 text-xs transition-all", isActive("/stock/out/single") ? "text-blue-600 font-bold" : "text-slate-400 hover:text-blue-600")}>- เบิกทีละรายการ</Link>
                        <Link href="/stock/out/multi" className={cn("block py-1.5 text-xs transition-all", isActive("/stock/out/multi") ? "text-blue-600 font-bold" : "text-slate-400 hover:text-blue-600")}>- เบิกหลายรายการ</Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link href="/history" className={cn("flex items-center gap-3 p-2.5 rounded-xl transition-all", isActive("/history") ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800")}>
              <History className="w-5 h-5" strokeWidth={1.5} />
              <span className="font-medium">ประวัติรายการ</span>
            </Link>

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">System Management</p>
              <Link href="/users" className={cn("flex items-center gap-3 p-2.5 rounded-xl transition-all", isActive("/users") ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}>
                <Users className="w-5 h-5" strokeWidth={1.5} /> <span>จัดการผู้ใช้งาน</span>
              </Link>
              <Link href="/permissions" className={cn("flex items-center gap-3 p-2.5 rounded-xl mt-1 transition-all", isActive("/permissions") ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}>
                <ShieldCheck className="w-5 h-5" strokeWidth={1.5} /> <span>สิทธิ์การใช้งาน</span>
              </Link>
              <Link href="/settings" className={cn("flex items-center gap-3 p-2.5 rounded-xl mt-1 transition-all", isActive("/settings") ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}>
                <Settings className="w-5 h-5" strokeWidth={1.5} /> <span>ตั้งค่าระบบ</span>
              </Link>
            </div>
          </nav>

          <div className="p-4 border-t dark:border-slate-800 space-y-4 text-sm bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex justify-center gap-4">
              {/* 1. ปุ่มกระดิ่งแจ้งเตือน */}
              <NotificationBell />
              
              {/* 2. ปุ่มเปลี่ยน Theme */}
              <button onClick={cycleTheme} className="p-2.5 flex items-center justify-center border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer text-foreground">
                <ThemeIcon />
              </button>

              {/* 3. ปุ่มสลับเมนู Layout */}
              <button onClick={toggleLayout} className="p-2.5 flex items-center justify-center border rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer">
                <ArrowRightLeft className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* ปุ่มออกจากระบบ (คงเดิม) */}
            <button onClick={handleLogout} className="w-full h-10 flex items-center justify-center gap-2 border rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold border-red-100 dark:border-red-900/30 hover:bg-red-100 transition shadow-sm cursor-pointer">
              <LogOut className="w-4 h-4" /> <span className="text-xs">ออกจากระบบ</span>
            </button>
          </div>
        </aside>
      )}

      {/* 🔵 TOPBAR MODE */}
      <div className="flex-1 flex flex-col min-w-0">
        {layoutMode === "topbar" && (
          <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-6">
              <Link href="/dashboard">
                <Image src="/logos/logo-web-b.svg" alt="ST PLUS ERP" width={160} height={31} className="dark:hidden block" priority />
                <Image src="/logos/logo-web-w.svg" alt="ST PLUS ERP" width={160} height={31} className="hidden dark:block" priority />
              </Link>
              <Menubar className="border-none shadow-none bg-transparent">
                <MenubarMenu>
                  <MenubarTrigger className="cursor-pointer text-sm font-medium hover:text-blue-600">คลังสินค้า</MenubarTrigger>
                  <MenubarContent align="start" className="p-2 w-56">
                    <MenubarItem asChild><Link href="/products" className="flex items-center py-2"><PackageOpen className="w-4 h-4 mr-3"/> รายการสินค้า</Link></MenubarItem>
                    <MenubarSub>
                      <MenubarSubTrigger className="py-2"><PackagePlus className="w-4 h-4 mr-3"/> รับสินค้าเข้าคลัง</MenubarSubTrigger>
                      <MenubarSubContent className="p-2 w-48">
                        <MenubarItem asChild><Link href="/stock/in/single">รับเข้าทีละรายการ</Link></MenubarItem>
                        <MenubarItem asChild><Link href="/stock/in/multi">รับเข้าหลายรายการ</Link></MenubarItem>
                      </MenubarSubContent>
                    </MenubarSub>
                  </MenubarContent>
                </MenubarMenu>
                
                <MenubarMenu>
                  <MenubarTrigger className="cursor-pointer text-sm font-medium hover:text-blue-600">จัดการระบบ</MenubarTrigger>
                  <MenubarContent align="start" className="p-2 w-56">
                    <MenubarItem asChild><Link href="/users" className="flex items-center py-2"><Users className="w-4 h-4 mr-3"/> จัดการผู้ใช้งาน</Link></MenubarItem>
                    <MenubarItem asChild><Link href="/permissions" className="flex items-center py-2"><ShieldCheck className="w-4 h-4 mr-3"/> สิทธิ์การใช้งาน</Link></MenubarItem>
                    <MenubarItem asChild><Link href="/settings" className="flex items-center py-2"><Settings className="w-4 h-4 mr-3"/> ตั้งค่าระบบ</Link></MenubarItem>
                  </MenubarContent>
                </MenubarMenu>
              </Menubar>
            </div>

            <div className="flex items-center gap-3 text-foreground">
              <NotificationBell />
              <button onClick={cycleTheme} className="p-2.5 border bg-white dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm border-slate-200 dark:border-slate-700 cursor-pointer"><ThemeIcon /></button>
              <button onClick={toggleLayout} className="p-2.5 border bg-white dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm border-slate-200 dark:border-slate-700 cursor-pointer"><ArrowRightLeft className="w-4 h-4" /></button>
              <button onClick={handleLogout} className="p-2.5 border bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition shadow-sm border-red-100 cursor-pointer"><LogOut className="w-4 h-4" /></button>
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