"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
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
  ChevronRight
} from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // 💡 State ดักจับว่า Client โหลดเสร็จหรือยัง (แก้ปัญหา Hydration Error)
  const [isMounted, setIsMounted] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"sidebar" | "topbar">("sidebar");
  const [isInventoryOpen, setIsInventoryOpen] = useState(true);
  const [isSalesOpen, setIsSalesOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true); // ยืนยันว่าฝั่ง Client โหลดแล้ว
    const savedMode = localStorage.getItem("stplus_layout") as "sidebar" | "topbar";
    if (savedMode) setLayoutMode(savedMode);
  }, []);

  // 💡 ป้องกัน Hydration Error: ถ้ายังไม่ Mounted ให้โชว์หน้าจอพื้นหลังเปล่าๆ ไปก่อนเสี้ยววินาที
  if (!isMounted) {
    return <div className="flex h-screen w-full bg-slate-50"></div>;
  }

  const toggleLayout = () => {
    const newMode = layoutMode === "sidebar" ? "topbar" : "sidebar";
    setLayoutMode(newMode);
    localStorage.setItem("stplus_layout", newMode);
  };

  return (
    <div className={`flex h-screen w-full bg-slate-50 text-sm ${layoutMode === "sidebar" ? "flex-row" : "flex-col"}`}>
      
      {/* ================= โหมด TOPBAR ================= */}
      {layoutMode === "topbar" && (
        <header className="w-full border-b bg-white px-6 py-3 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex-shrink-0 cursor-pointer">
              <Link href="/">
                <Image src="/logos/logo-web-b.svg" alt="ST PLUS ERP" width={150} height={40} style={{ height: "auto" }} priority />
              </Link>
            </div>

            <Menubar className="border-none shadow-none bg-transparent">
              <MenubarMenu>
                <MenubarTrigger className="cursor-pointer text-base font-medium text-slate-700 hover:text-blue-600">
                  <Package className="w-4 h-4 mr-2" /> สินค้า & สต็อก
                </MenubarTrigger>
                <MenubarContent align="start" className="w-56">
                  {/* 💡 แก้ไขการใช้ Link กับ MenubarItem ให้ถูกต้องตามมาตรฐาน Shadcn */}
                  <MenubarItem asChild className="cursor-pointer font-medium">
                    <Link href="/products">
                      <Package className="w-4 h-4 mr-2 text-slate-500" /> รายการสินค้า (Master)
                    </Link>
                  </MenubarItem>
                  <MenubarItem asChild className="cursor-pointer text-green-700 font-medium mt-1">
                    <Link href="/stock/in">
                      <PackagePlus className="w-4 h-4 mr-2" /> รับสินค้าเข้าคลัง
                    </Link>
                  </MenubarItem>
                  <MenubarItem asChild className="cursor-pointer text-blue-700 font-medium mt-1">
                    <Link href="/stock/out">
                      <PackageMinus className="w-4 h-4 mr-2" /> เบิกสินค้าออก
                    </Link>
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>

              <MenubarMenu>
                <MenubarTrigger className="cursor-pointer text-base font-medium text-slate-700 hover:text-blue-600 ml-2">
                  <Users className="w-4 h-4 mr-2" /> ลูกค้า
                </MenubarTrigger>
                <MenubarContent align="start">
                  <MenubarItem asChild className="cursor-pointer">
                    <Link href="#">
                      <Users className="w-4 h-4 mr-2 text-slate-500" /> จัดการลูกค้า
                    </Link>
                  </MenubarItem>
                  <MenubarItem asChild className="cursor-pointer mt-1">
                    <Link href="#">
                      <FileText className="w-4 h-4 mr-2 text-slate-500" /> ใบเสนอราคา
                    </Link>
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </div>

          <div className="flex items-center">
            <button onClick={toggleLayout} className="flex items-center px-4 py-2 border border-slate-200 rounded-md hover:bg-slate-100 transition cursor-pointer text-slate-600 font-medium bg-white shadow-sm">
              <ArrowRightLeft className="w-4 h-4 mr-2" /> สลับรูปแบบเมนู
            </button>
          </div>
        </header>
      )}

      {/* ================= โหมด SIDEBAR ================= */}
      {layoutMode === "sidebar" && (
        <aside className="w-64 border-r bg-white flex flex-col shadow-sm">
          <div className="p-6 border-b flex justify-center items-center">
            <Link href="/" className="cursor-pointer">
              <Image src="/logos/logo-web-b.svg" alt="ST PLUS ERP" width={150} height={40} style={{ height: "auto" }} priority />
            </Link>
          </div>
          
          <nav className="flex-1 p-3 flex flex-col gap-2 overflow-y-auto">
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                className="flex items-center justify-between px-3 py-2.5 text-slate-700 hover:bg-slate-100 rounded-md font-bold transition cursor-pointer w-full"
              >
                <div className="flex items-center">
                  <Package className="w-5 h-5 mr-3 text-blue-600" />
                  คลังสินค้า
                </div>
                {isInventoryOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              
              {isInventoryOpen && (
                <div className="flex flex-col gap-1 pl-9 pr-2 pb-2">
                  <Link href="/products" className="flex items-center px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-blue-700 rounded-md font-medium transition cursor-pointer">
                    จัดการสินค้า (Master)
                  </Link>
                  <Link href="/stock/in" className="flex items-center px-3 py-2 text-slate-600 hover:bg-green-50 hover:text-green-700 rounded-md font-medium transition cursor-pointer">
                    รับสินค้าเข้าคลัง
                  </Link>
                  <Link href="/stock/out" className="flex items-center px-3 py-2 text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-md font-medium transition cursor-pointer">
                    เบิกสินค้าออก
                  </Link>
                </div>
              )}
            </div>

            <div className="h-px bg-slate-100 mx-3 my-1"></div>

            <div className="flex flex-col gap-1">
              <button 
                onClick={() => setIsSalesOpen(!isSalesOpen)}
                className="flex items-center justify-between px-3 py-2.5 text-slate-700 hover:bg-slate-100 rounded-md font-bold transition cursor-pointer w-full"
              >
                <div className="flex items-center">
                  <Users className="w-5 h-5 mr-3 text-orange-500" />
                  ลูกค้า & การขาย
                </div>
                {isSalesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>

              {isSalesOpen && (
                <div className="flex flex-col gap-1 pl-9 pr-2 pb-2">
                  <Link href="#" className="flex items-center px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-orange-600 rounded-md font-medium transition cursor-pointer">
                    จัดการลูกค้า
                  </Link>
                  <Link href="#" className="flex items-center px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-orange-600 rounded-md font-medium transition cursor-pointer">
                    ใบเสนอราคา
                  </Link>
                </div>
              )}
            </div>
          </nav>
          
          <div className="p-4 border-t bg-slate-50">
            <button onClick={toggleLayout} className="flex items-center justify-center w-full p-2.5 border border-slate-300 bg-white rounded-md hover:bg-slate-100 transition text-center cursor-pointer font-medium text-slate-700 shadow-sm">
              <ArrowRightLeft className="w-4 h-4 mr-2" /> สลับรูปแบบเมนู
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}