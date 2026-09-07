"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from "@/components/ui/menubar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AppLoading } from "@/components/ui/app-loading";
import {
  FolderKey,
  CheckCircle2,
  Bell,
  Sun,
  Moon,
  Monitor,
  LogOut,
  ShieldCheck,
  User,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  Building2,
  ChevronLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dayjs from "dayjs";
import {
  getToken,
  getUserRaw,
  setSession,
  clearSession,
  getLayoutPref,
  setLayoutPref,
  getMiniSidebarPref,
  setMiniSidebarPref,
} from "@/lib/auth-storage";
import { switchCompany } from "@/lib/company-switch";
import { MENU_ICON_MAP as ICON_MAP } from "@/lib/menu-icons";

// 🚀 icon เล็กหน้าชื่อเมนู "รายการ" (leaf item) — แสดงเฉพาะเมื่อ permission ตัวนั้นมีการเลือก icon ไว้จริง
// (ผ่าน AddPermissionDialog/EditPermissionDialog) ไม่มีก็ไม่ต้องมี placeholder ใดๆ
function ItemIcon({ icon, className = "w-3.5 h-3.5 shrink-0" }: { icon?: string | null; className?: string }) {
  if (!icon) return null;
  const IconComp = ICON_MAP[icon];
  if (!IconComp) return null;
  return <IconComp className={className} strokeWidth={1.5} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // ==========================================
  // STATE
  // ==========================================
  const [isMounted, setIsMounted] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [layoutMode, setLayoutMode] = useState<"sidebar" | "topbar">("sidebar");
  const [isMiniSidebar, setIsMiniSidebar] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // 🚀 เมนูชั้นที่ 3 (เช่น "รายงาน" → ขาย/จัดซื้อ/... — ดู sub_groups จาก UserSessionFormatter::format())
  // key เป็น `${group}::${subGroupName}` กันชนกับกลุ่มอื่นที่บังเอิญตั้งชื่อ sub_group ซ้ำกัน
  const [openSubGroups, setOpenSubGroups] = useState<Record<string, boolean>>({});

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [userData, setUserData] = useState<any>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // ⏱️ กันรีเฟรชสิทธิ์ถี่เกินไปเวลา interval กับ visibilitychange ยิงชนกันพอดี
  const lastUserRefreshRef = useRef<number>(0);

  // ==========================================
  // 🚀 1. ฟังก์ชันเช็ค Auth & โหลดข้อมูล
  // ==========================================
  // แยกฟังก์ชันดึง /api/me + /api/company ออกมาให้เรียกซ้ำได้ (เดิมฝังอยู่ใน initApp เท่านั้น เรียกได้แค่ตอน mount ครั้งแรก)
  // ใช้ทั้งตอนเปิดแอปครั้งแรก และตอนรีเฟรชสิทธิ์เป็นระยะ/ตอนกลับมาที่แท็บ (ดู Effect 4 ด้านล่าง)
  const fetchAndApplyUserData = async (token: string) => {
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const userRes = await fetch(`${apiUrl}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (userRes.status === 401) {
        // token ถูกเพิกถอนจริง (เช่น admin สั่ง revoke หรือ logout จากอุปกรณ์นี้เอง) — เตะออกไปหน้า login
        handleLogout();
        return false;
      }

      if (!userRes.ok) return false;

      const data = await userRes.json();
      setUserData(data);
      setSession(token, data);

      const companyRes = await fetch(`${apiUrl}/company`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);

      if (companyRes && companyRes.ok) {
        const compData = await companyRes.json();
        const actualData = Array.isArray(compData)
          ? compData[0]
          : compData.data || compData;
        if (actualData?.logo) setCompanyLogo(actualData.logo);
        if (actualData?.name) setCompanyName(actualData.name);
        else if (actualData?.company_name)
          setCompanyName(actualData.company_name);
      }
      return true;
    } catch (e) {
      console.error("Fetch user data failed:", e);
      return false;
    }
  };

  useEffect(() => {
    const initApp = async () => {
      const token =
        getToken();

      if (!token) {
        setIsCheckingAuth(false);
        if (pathname !== "/login" && pathname !== "/register-company") {
          router.push("/login");
        }
        return;
      }

      // 💡 FIX 1: ถ้ามีข้อมูล userData แล้ว แปลว่าโหลดเมนูมาแล้ว ไม่ต้องโหลดซ้ำให้เว็บช้า
      // (การรีเฟรชสิทธิ์เป็นระยะทำแยกอยู่ที่ Effect 4 ด้านล่างแล้ว ไม่ต้องพึ่ง path นี้)
      if (userData) {
        setIsCheckingAuth(false);
        return;
      }

      setIsCheckingAuth(true);
      const ok = await fetchAndApplyUserData(token);
      lastUserRefreshRef.current = Date.now();
      if (ok && pathname === "/login") router.push("/dashboard");
      setIsCheckingAuth(false);
    };

    initApp();
  }, [pathname]); // 🚀 FIX 2: ใส่ pathname ลงไป เพื่อให้ระบบดึงเมนูทันทีเมื่อเด้งออกจากหน้า Login

  // ==========================================
  // 🚀 2. อัปเดตสถานะเมนู & ธีม เมื่อกดเปลี่ยนหน้า
  // ==========================================
  useEffect(() => {
    setIsMounted(true);
    const savedMode = getLayoutPref();
    const savedMini = getMiniSidebarPref();
    if (savedMode) setLayoutMode(savedMode);
    if (savedMini) setIsMiniSidebar(savedMini);

    // อัปเดตแถบเมนูว่ากำลังอยู่หมวดไหน (แบบ accordion — เปิดแค่กลุ่มที่ตรงกับหน้าปัจจุบัน กลุ่มอื่นหุบอัตโนมัติ)
    if (userData?.user?.menus) {
      const currentStates: Record<string, boolean> = {};
      const currentSubStates: Record<string, boolean> = {};
      userData.user.menus.forEach((group: any) => {
        // 🚀 กลุ่มที่มีเมนูชั้นที่ 3 (sub_groups) ต้องเช็ค path ของ item ข้างในทุก sub_group ด้วย
        // ไม่ใช่แค่ items แบนตรงๆ เพราะกลุ่มแบบนี้ (เช่น "รายงาน") ไม่มี item แบนเหลือเลย
        const flatMatch = group.items.some((item: any) =>
          pathname.startsWith(item.path),
        );
        let subMatch = false;
        (group.sub_groups || []).forEach((sub: any) => {
          const isActiveSub = sub.items.some((item: any) =>
            pathname.startsWith(item.path),
          );
          if (isActiveSub) subMatch = true;
          currentSubStates[`${group.group}::${sub.name}`] = isActiveSub;
        });
        currentStates[group.group] = flatMatch || subMatch;
      });
      setOpenGroups(currentStates);
      setOpenSubGroups(currentSubStates);
    }
  }, [pathname, userData]); // 👈 ให้ทำงานแค่การเปิด/ปิดเมนู ไม่ต้องโหลด API ใหม่!

  // ==========================================
  // 🚀 3. แจ้งเตือน (ทำงานแยกต่างหาก)
  // ==========================================
  useEffect(() => {
    if (pathname !== "/login" && pathname !== "/register-company") {
      fetchNotifications();
      const intervalId = setInterval(fetchNotifications, 10000);
      return () => clearInterval(intervalId);
    }
  }, [pathname]);

  // ==========================================
  // 🚀 4. รีเฟรชสิทธิ์/เมนูเป็นระยะ + ตอนกลับมาที่แท็บ
  // ==========================================
  // เดิม /api/me ถูกดึงแค่ครั้งเดียวตอนเปิดแอป (ดู Effect 1) ทำให้ถ้าแอดมินเปลี่ยน role/สิทธิ์ให้ผู้ใช้ระหว่างที่
  // หน้าเปิดค้างไว้ ปุ่ม/เมนูที่ผูกกับสิทธิ์จะไม่มีทางรู้เลยจนกว่าจะ refresh มือ — เพิ่ม polling ทุก 4 นาที (ใช้ pattern
  // เดียวกับ fetchNotifications ด้านบน) บวกรีเฟรชทันทีเมื่อกลับมาโฟกัสแท็บ (เคสที่พบบ่อยสุด: alt-tab ไปทำอย่างอื่นแล้วกลับมา)
  useEffect(() => {
    if (pathname === "/login" || pathname === "/register-company") return;

    const refreshIfDue = (minIntervalMs: number) => {
      const token = getToken();
      if (!token) return;
      const now = Date.now();
      if (now - lastUserRefreshRef.current < minIntervalMs) return;
      lastUserRefreshRef.current = now;
      fetchAndApplyUserData(token);
    };

    const intervalId = setInterval(() => refreshIfDue(0), 4 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // กันยิงซ้ำถ้าเพิ่งรีเฟรชไปหมาดๆ (เช่น เพิ่ง mount หรือเพิ่งเปลี่ยน tab กลับไปกลับมาเร็วๆ)
        refreshIfDue(30 * 1000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname]);

  // ==========================================
  // 🚀 5. กัน Chrome จำ/เสนอค่าที่เคยพิมพ์ในฟอร์มข้อมูลทั่วไปทั้งแอป (ลูกค้า/สินค้า/เอกสารขาย/โครงการ ฯลฯ)
  // ==========================================
  // ยกเว้นหน้า login/register-company ที่ให้ Chrome ทำงานตามปกติ (จัดการ autocomplete เองในไฟล์นั้นแล้ว)
  // ใช้วิธี set attribute ผ่าน DOM ตรงๆ (ไม่ไล่แก้ทีละไฟล์) เพราะฟอร์มส่วนใหญ่ในระบบใช้ <input> ดิบ ไม่ผ่าน
  // component กลาง (Input/Textarea) — MutationObserver ไว้จับ input ที่แทรกเข้ามาทีหลัง (เช่นกดปุ่ม "เพิ่มแถวสินค้า")
  // selector `:not([autocomplete])` เคารพค่าที่นักพัฒนาตั้งไว้เองอยู่แล้วทุกจุด ไม่ทับของเดิม
  useEffect(() => {
    if (pathname === "/login" || pathname === "/register-company") return;

    const applyAutocompleteOff = () => {
      document.querySelectorAll("input:not([autocomplete])").forEach((el) => {
        el.setAttribute("autocomplete", "off");
      });
    };

    // 🛡️ รวบ mutation หลายครั้งให้ apply แค่ครั้งเดียวต่อเฟรม กัน MutationObserver ทำงานถี่เกินจนกระทบ
    // performance ตอนพิมพ์ในฟอร์มที่ re-render บ่อย (เช่นตารางรายการสินค้ายาวๆ)
    let rafId: number | null = null;
    const scheduleApply = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        applyAutocompleteOff();
        rafId = null;
      });
    };

    scheduleApply();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });

    // 🛡️ กันชนสำรอง — บางฟอร์มมีหลายส่วนโหลดข้อมูล async/ต่อกันหลายชั้น (เช่นฟอร์มลูกค้าที่มีเงื่อนไขซ่อน/โชว์
    // ฟิลด์ตามตัวเลือก) พบว่าบาง input หลุดไม่โดน MutationObserver จับ (ตรวจสอบจริงแล้วยืนยัน) จึง poll ซ้ำ
    // เป็นระยะเบาๆ เพื่อความชัวร์ ต้นทุนต่ำมาก (querySelectorAll ไม่กี่สิบ element)
    const intervalId = setInterval(applyAutocompleteOff, 1000);

    return () => {
      observer.disconnect();
      clearInterval(intervalId);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [pathname]);

  const toggleGroup = (groupName: string) => {
    if (isMiniSidebar) setIsMiniSidebar(false);
    // แบบ accordion — กดเปิดกลุ่มใหม่แล้วกลุ่มเดิมที่เปิดอยู่หุบอัตโนมัติ
    setOpenGroups((prev) =>
      prev[groupName] ? { ...prev, [groupName]: false } : { [groupName]: true },
    );
  };

  // 🚀 เปิด/ปิดเมนูชั้นที่ 3 — ปล่อยให้เปิดพร้อมกันได้หลายหมวดในกลุ่มเดียวกัน (ไม่ทำ accordion เหมือนชั้นบน
  // เพราะรายการปลายทางในแต่ละหมวดค่อนข้างน้อย เปิดดูพร้อมกันหลายหมวดสะดวกกว่า)
  const toggleSubGroup = (key: string) => {
    setOpenSubGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMiniSidebar = () => {
    const newMiniState = !isMiniSidebar;
    setIsMiniSidebar(newMiniState);
    setMiniSidebarPref(newMiniState);
  };

  const toggleLayout = () => {
    const newMode = layoutMode === "sidebar" ? "topbar" : "sidebar";
    setLayoutMode(newMode);
    setLayoutPref(newMode);
  };

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const token =
        getToken();
      if (token) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"}/logout`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      }
    } catch (error) {
    } finally {
      clearSession();
      setUserData(null);
      setCompanyLogo(null);
      setCompanyName(null);
      setIsLoggingOut(false);
      toast.success("ออกจากระบบเรียบร้อยแล้ว");
      router.push("/login");
    }
  };

  const [switchingCompanyId, setSwitchingCompanyId] = useState<number | null>(null);

  // สลับบริษัทที่กำลังทำงานอยู่ (ผ่านปุ่มใน dropdown โปรไฟล์) — ต่างจาก popup ตอน login ตรงที่ทำได้ตลอดเวลา
  // ไม่ใช่แค่ครั้งแรก reload หน้าเว็บทันทีหลังสลับสำเร็จ กันข้อมูล/state ของหน้าที่เปิดค้างไว้เป็นของบริษัทเก่าตกค้าง
  const handleSwitchCompany = async (companyId: number) => {
    const token = getToken();
    if (!token || switchingCompanyId) return;

    setSwitchingCompanyId(companyId);
    try {
      const data = await switchCompany(token, companyId);
      setSession(token, data);
      toast.success("สลับบริษัทเรียบร้อยแล้ว");
      setIsProfileMenuOpen(false);
      window.location.href = "/dashboard";
    } catch (error: any) {
      toast.error(error.message || "ไม่สามารถสลับบริษัทได้");
      setSwitchingCompanyId(null);
    }
  };

  const fetchNotifications = async () => {
    const token =
      getToken();
    if (!token) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"}/notifications/unread`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setNotifications(await res.json());
    } catch (error) {}
  };

  const isActive = (path: string) => pathname === path;

  // ==========================================
  // COMPONENTS ย่อย
  // ==========================================
  const ThemeIcon = () => {
    if (theme === "light")
      return <Sun className="w-5 h-5 text-amber-500" strokeWidth={1.5} />;
    if (theme === "dark")
      return <Moon className="w-5 h-5 text-blue-400" strokeWidth={1.5} />;
    return <Monitor className="w-5 h-5 text-slate-500" strokeWidth={1.5} />;
  };

  const markOneNotificationAsRead = async (id: string | number) => {
    setNotifications((prev) => prev.filter((n: any) => n.id !== id));
    try {
      const token = getToken();
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"}/notifications/${id}/read`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (error) {}
  };

  const markAllNotificationsAsRead = async () => {
    setNotifications([]);
    try {
      const token = getToken();
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"}/notifications/mark-read`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (error) {}
  };

  const NotificationBell = ({
    className,
    side = "bottom",
    align = "end",
  }: { className?: string; side?: "top" | "right" | "bottom" | "left"; align?: "start" | "center" | "end" } = {}) => (
    <Popover open={isNotifOpen} onOpenChange={setIsNotifOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer",
            className,
          )}
        >
          <Bell
            className="w-5 h-5 text-slate-600 dark:text-slate-300"
            strokeWidth={1.5}
          />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={16}
        className="w-80 p-2 rounded-2xl shadow-xl z-50 border border-slate-100 dark:border-slate-800"
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
            การแจ้งเตือน
          </span>
          {notifications.length > 0 && (
            <button
              onClick={markAllNotificationsAsRead}
              className="text-xs text-blue-600 hover:underline cursor-pointer font-medium"
            >
              อ่านทั้งหมด
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              ไม่มีการแจ้งเตือนใหม่
            </p>
          ) : (
            notifications.map((n: any) => (
              <button
                key={n.id}
                onClick={() => markOneNotificationAsRead(n.id)}
                className="w-full text-left px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <p className="font-medium">{n.data?.message || "-"}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {dayjs(n.created_at).format("DD/MM/YYYY HH:mm")}
                </p>
              </button>
            ))
          )}
        </div>
        <Link
          href="/notifications"
          onClick={() => setIsNotifOpen(false)}
          className="block text-center text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition px-3 py-2.5 mt-1"
        >
          ดูทั้งหมด
        </Link>
      </PopoverContent>
    </Popover>
  );

  const UserProfileDropdown = ({
    side = "right",
    align = "end",
    isTopbar = false,
  }: any) => (
    <Popover open={isProfileMenuOpen} onOpenChange={setIsProfileMenuOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            // 🚀 ปรับตรงนี้: ถ้าเป็น Topbar จะลบขอบและเอาพื้นหลังออก
            "flex items-center gap-3 p-2 rounded-full cursor-pointer transition-all w-full",
            isTopbar
              ? "w-auto hover:bg-slate-100 dark:hover:bg-slate-800"
              : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm",
            isMiniSidebar &&
              "justify-center px-0 bg-transparent border-transparent shadow-none hover:bg-slate-100 dark:hover:bg-slate-800",
          )}
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 overflow-hidden border border-blue-200 dark:border-blue-800">
            {userData?.user?.avatar ? (
              <img
                src={userData.user.avatar}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : userData?.user?.name ? (
              userData.user.name.charAt(0).toUpperCase()
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          {/* 🚀 ปรับตรงนี้: ถ้าเป็น Topbar จะซ่อนชื่อทิ้งไปเลย */}
          {!isMiniSidebar && !isTopbar && (
            <div className="flex flex-col min-w-0 flex-1 text-left">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {userData?.user?.name || "Loading..."}
              </span>
              <span className="text-[11px] text-slate-500 truncate">
                {userData?.user?.email || "-"}
              </span>
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={16}
        className="w-56 p-2 rounded-2xl shadow-xl z-50 border border-slate-100 dark:border-slate-800"
      >
        {/* 🚀 เพิ่มส่วนหัวโชว์ชื่อใน Dropdown แทน */}
        {isTopbar && (
          <div className="px-3 py-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {userData?.user?.name || "Loading..."}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {userData?.user?.email || "-"}
            </p>
          </div>
        )}
        {userData?.user?.companies?.length > 1 && (
          <div className="mb-1 pb-1 border-b border-slate-100 dark:border-slate-800">
            <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
              สลับบริษัท
            </p>
            {userData.user.companies.map((company: any) => {
              const isActive = company.id === userData.user.active_company_id;
              const isSwitching = switchingCompanyId === company.id;
              return (
                <button
                  key={company.id}
                  onClick={() => !isActive && handleSwitchCompany(company.id)}
                  disabled={isActive || switchingCompanyId !== null}
                  className={cn(
                    "w-full flex items-center px-3 py-2 text-sm rounded-xl transition font-medium cursor-pointer disabled:cursor-not-allowed",
                    isActive
                      ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                      : "text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800",
                  )}
                >
                  <Building2 className="w-4 h-4 mr-3 text-slate-400 shrink-0" />
                  <span className="flex-1 text-left truncate">{company.name}</span>
                  {isSwitching ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    isActive && <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        <Link
          href="/profile"
          onClick={() => setIsProfileMenuOpen(false)}
          className="flex items-center px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition font-medium"
        >
          <User className="w-4 h-4 mr-3 text-slate-400" /> ตั้งค่าข้อมูลส่วนตัว
        </Link>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition mt-1 cursor-pointer font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingOut ? (
            <Loader2 className="w-4 h-4 mr-3 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 mr-3" />
          )}
          {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
        </button>
      </PopoverContent>
    </Popover>
  );

  // ==========================================
  // EARLY RETURNS
  // ==========================================
  if (!isMounted || isCheckingAuth) {
    return (
      <AppLoading
        text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..."
        minHeight="min-h-screen"
        className="bg-slate-50 dark:bg-slate-950"
      />
    );
  }

  if (pathname === "/login" || pathname === "/register-company")
    return <div className="font-sans antialiased">{children}</div>;

  // ==========================================
  // RENDER: MAIN LAYOUT
  // ==========================================
  return (
    <>
      {/* 🚪 Popup เต็มหน้าจอตอนกำลังลงชื่อออก */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white-500/50 backdrop-blur-sm p-4">
          <AppLoading text="กำลังลงชื่อออก..." />
        </div>
      )}
      <div
      className={cn(
        "min-h-screen bg-[#F8FAFC] dark:bg-slate-950 font-sans antialiased",
        layoutMode === "topbar" ? "flex flex-col" : "flex",
      )}
    >
      {/* 🟢 SIDEBAR MODE */}
      {layoutMode === "sidebar" && (
        <aside
          className={cn(
            "print:hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col sticky top-0 h-screen shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300 ease-in-out",
            isMiniSidebar ? "w-20" : "w-[280px]",
          )}
        >
          {/* Logo Area */}
          <div
            className={cn(
              "h-16 flex items-center border-b border-slate-100 dark:border-slate-800 px-5",
              isMiniSidebar ? "justify-center px-0" : "",
            )}
          >
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-2 overflow-hidden w-full",
                isMiniSidebar ? "justify-center" : "",
              )}
            >
              <div className="w-8 h-8 bg-blue-600 flex items-center justify-center shadow-sm shrink-0 overflow-hidden rounded-lg">
                {/* 🚀 เหมือนกับ Topbar: ถ้ามีโลโก้โชว์โลโก้ ถ้าไม่มีดึงอักษร 2 ตัวแรกมาโชว์ */}
                {companyLogo ? (
                  <img
                    src={companyLogo}
                    alt="Logo"
                    className="w-full h-full object-cover bg-background"
                  />
                ) : (
                  <span className="text-white font-black text-xs">
                    {/* {companyName
                      ? companyName.substring(0, 2).toUpperCase()
                      : "ERP"} */}
                      OFFICE SYSTEM
                  </span>
                )}
              </div>
              {!isMiniSidebar && (
                /* 🚀 เปลี่ยนจากฟิกซ์คำว่า OFFICE SYSTEM เป็นดึงชื่อบริษัทจากตัวแปรแทน */
                <span className="font-bold text-base tracking-tight truncate text-slate-800 dark:text-slate-100 max-w-[180px]">
                  {/* {companyName || "OFFICE SYSTEM"} */}
                  OFFICE SYSTEM
                </span>
              )}
            </Link>
          </div>

          <button
            onClick={toggleMiniSidebar}
            className="absolute -right-3.5 top-5 w-7 h-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-sm z-50 cursor-pointer transition-transform hover:scale-110"
          >
            {isMiniSidebar ? (
              <ChevronRight className="w-4 h-4 ml-0.5" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Dynamic Menu */}
          <nav
            className={cn(
              "flex-1 py-6 px-3 space-y-2 custom-scrollbar",
              isMiniSidebar ? "overflow-visible" : "overflow-y-auto",
            )}
          >
            {userData?.user?.menus?.map((menuGroup: any) => {
              const IconComp = ICON_MAP[menuGroup.icon] || FolderKey;
              const isGroupOpen = openGroups[menuGroup.group];
              const isSingleItem = menuGroup.items.length === 1;

              return (
                <div key={menuGroup.group} className="mb-2">
                  <button
                    onClick={() =>
                      isSingleItem
                        ? router.push(menuGroup.items[0].path)
                        : toggleGroup(menuGroup.group)
                    }
                    className={cn(
                      "relative group w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all",
                      isSingleItem && isActive(menuGroup.items[0].path)
                        ? "bg-blue-50 text-blue-600 font-bold dark:bg-blue-900/20"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50",
                      isMiniSidebar && "justify-center",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <IconComp className="w-5 h-5" strokeWidth={1.5} />
                      {!isMiniSidebar && (
                        <span className="font-medium text-[15px]">
                          {menuGroup.group}
                        </span>
                      )}
                    </div>
                    {!isMiniSidebar && !isSingleItem && (
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-slate-400 transition-transform",
                          !isGroupOpen && "-rotate-90",
                        )}
                      />
                    )}
                    {isMiniSidebar && (
                      <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl whitespace-nowrap z-[100] flex items-center border border-slate-700 dark:border-slate-200 pointer-events-none">
                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-800 dark:border-r-white"></div>
                        {menuGroup.group}
                      </div>
                    )}
                  </button>

                  {!isMiniSidebar && isGroupOpen && !isSingleItem && (
                    <div className="ml-5 mt-1 border-l border-slate-200 dark:border-slate-800 flex flex-col space-y-0.5 relative">
                      {menuGroup.items.map((item: any, index: number) => {
                        const active = isActive(item.path);
                        return (
                          <Link
                            key={`${item.path}-${index}`}
                            href={item.path}
                            className={cn(
                              "relative flex items-center pl-6 py-2.5 text-sm transition-colors rounded-r-xl",
                              active
                                ? "text-blue-600 font-bold bg-blue-50/50 dark:bg-blue-900/10"
                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/30",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute left-[-4.5px] w-2 h-2 rounded-full border border-white dark:border-slate-900",
                                active
                                  ? "bg-blue-600 scale-125"
                                  : "bg-slate-200 dark:bg-slate-700",
                              )}
                            />
                            <ItemIcon icon={item.icon} className="w-3.5 h-3.5 shrink-0 mr-1.5" />
                            {item.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* 🚀 เมนูชั้นที่ 3 (sub_groups) — เช่น "รายงาน" ที่แตกเป็น ขาย/จัดซื้อ/คลังสินค้า/...
                      กลุ่มไหนไม่มี sub_groups เลย (ทุกกลุ่มอื่นในระบบตอนนี้) จะไม่ผ่านเงื่อนไขนี้เลย
                      เรนเดอร์เหมือนเดิมทุกอย่าง ไม่กระทบเมนูเดิม */}
                  {!isMiniSidebar && isGroupOpen && menuGroup.sub_groups && (
                    <div className="ml-5 mt-1 border-l border-slate-200 dark:border-slate-800 flex flex-col space-y-0.5">
                      {menuGroup.sub_groups.map((subGroup: any) => {
                        const subKey = `${menuGroup.group}::${subGroup.name}`;
                        const isSubOpen = openSubGroups[subKey];
                        const SubIconComp = subGroup.icon
                          ? ICON_MAP[subGroup.icon] || FolderKey
                          : null;
                        const subGroupActive = (subGroup.items || []).some(
                          (it: any) => isActive(it.path),
                        );
                        return (
                          <div key={subKey}>
                            <button
                              onClick={() => toggleSubGroup(subKey)}
                              className="relative w-full flex items-center justify-between pl-6 pr-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-r-xl transition-colors cursor-pointer"
                            >
                              <div
                                className={cn(
                                  "absolute left-[-4.5px] w-2 h-2 rounded-full border border-white dark:border-slate-900",
                                  subGroupActive
                                    ? "bg-blue-600 scale-125"
                                    : "bg-slate-200 dark:bg-slate-700",
                                )}
                              />
                              <span className="flex items-center gap-2 font-medium">
                                {SubIconComp && (
                                  <SubIconComp className="w-3.5 h-3.5" strokeWidth={1.5} />
                                )}
                                {subGroup.name}
                              </span>
                              <ChevronDown
                                className={cn(
                                  "w-3.5 h-3.5 transition-transform shrink-0",
                                  !isSubOpen && "-rotate-90",
                                )}
                              />
                            </button>
                            {isSubOpen && (
                              <div className="ml-6 border-l border-slate-200 dark:border-slate-800 flex flex-col space-y-0.5 relative">
                                {subGroup.items.map((item: any, index: number) => {
                                  const active = isActive(item.path);
                                  return (
                                    <Link
                                      key={`${item.path}-${index}`}
                                      href={item.path}
                                      className={cn(
                                        "relative flex items-center pl-6 py-2 text-sm transition-colors rounded-r-xl",
                                        active
                                          ? "text-blue-600 font-bold bg-blue-50/50 dark:bg-blue-900/10"
                                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/30",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "absolute left-[-4.5px] w-1.5 h-1.5 rounded-full border border-white dark:border-slate-900",
                                          active
                                            ? "bg-blue-600 scale-125"
                                            : "bg-slate-200 dark:bg-slate-700",
                                        )}
                                      />
                                      <ItemIcon icon={item.icon} className="w-3.5 h-3.5 shrink-0 mr-1.5" />
                                      {item.title}
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Bottom Tools */}
          <div
            className={cn(
              "p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4",
              isMiniSidebar ? "items-center" : "",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-1",
                isMiniSidebar
                  ? "flex-col w-full"
                  : "justify-between bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800",
              )}
            >
              <div
                className={cn(
                  "relative group flex justify-center",
                  isMiniSidebar ? "w-full" : "",
                )}
              >
                <NotificationBell
                  className="hover:bg-white dark:hover:bg-slate-800 shadow-sm w-full flex justify-center"
                  side="right"
                  align="end"
                />
              </div>
              <div
                className={cn(
                  "relative group flex justify-center",
                  isMiniSidebar ? "w-full" : "",
                )}
              >
                <button
                  onClick={cycleTheme}
                  className="p-2.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition cursor-pointer text-slate-500 shadow-sm w-full flex justify-center"
                >
                  <ThemeIcon />
                </button>
              </div>
              <div
                className={cn(
                  "relative group flex justify-center",
                  isMiniSidebar ? "w-full" : "",
                )}
              >
                <button
                  onClick={toggleLayout}
                  className="p-2.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition cursor-pointer text-slate-500 shadow-sm w-full flex justify-center"
                >
                  <ArrowRightLeft className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              <div
                className={cn(
                  "relative group flex justify-center",
                  isMiniSidebar ? "w-full" : "",
                )}
              >
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 hover:text-red-600 rounded-xl transition cursor-pointer shadow-sm w-full flex justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <LogOut className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
            <div className="relative group w-full flex justify-center">
              <UserProfileDropdown side="right" align="end" />
              {isMiniSidebar && (
                <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl whitespace-nowrap z-[100] flex items-center border border-slate-700 dark:border-slate-200 pointer-events-none">
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-800 dark:border-r-white"></div>
                  โปรไฟล์ & ตั้งค่า
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* 🔵 TOPBAR MODE */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {layoutMode === "topbar" && (
          <header className="print:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 px-6 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                  {companyLogo ? (
                    <img
                      src={companyLogo}
                      alt="Logo"
                      className="w-full h-full object-cover bg-background"
                    />
                  ) : (
                    <span className="text-white font-black text-xs">
                      {/* {companyName
                        ? companyName.substring(0, 2).toUpperCase()
                        : "ST"} */}
                        OFFICE SYSTEM
                    </span>
                  )}
                </div>
                <span className="font-bold text-lg tracking-tight hidden sm:block truncate max-w-[200px]">
                  {/* {companyName || "MINI ERP"} */}
                </span>
              </Link>
              <div className="hidden sm:block w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-2"></div>
              <Menubar className="border-none shadow-none bg-transparent">
                {userData?.user?.menus?.map((menuGroup: any, index: number) => {
                  const IconComp = ICON_MAP[menuGroup.icon] || FolderKey;
                  const isSingleItem =
                    menuGroup.items.length === 1 &&
                    menuGroup.items[0].title === menuGroup.group;
                  return (
                    <React.Fragment key={menuGroup.group}>
                      <MenubarMenu>
                        <MenubarTrigger
                          onClick={
                            isSingleItem
                              ? () => router.push(menuGroup.items[0].path)
                              : undefined
                          }
                          className="cursor-pointer text-[15px] font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 data-[state=open]:text-blue-600 flex items-center gap-2 px-3"
                        >
                          <IconComp
                            className="w-4 h-4 text-blue-600 dark:text-blue-400"
                            strokeWidth={1.5}
                          />
                          {menuGroup.group}
                        </MenubarTrigger>
                        {(menuGroup.items.length > 0 || menuGroup.sub_groups) &&
                          !isSingleItem && (
                            <MenubarContent
                              align="start"
                              className="p-2 rounded-xl shadow-xl min-w-[200px] z-50"
                            >
                              {menuGroup.items.map(
                                (item: any, index: number) => (
                                  <MenubarItem
                                    key={`${item.path}-${index}`}
                                    asChild
                                  >
                                    <Link
                                      href={item.path}
                                      className="flex items-center gap-2 py-2.5 px-3 cursor-pointer text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                      <ItemIcon icon={item.icon} />
                                      {item.title}
                                    </Link>
                                  </MenubarItem>
                                ),
                              )}
                              {/* 🚀 เมนูชั้นที่ 3 (sub_groups) — flyout ซ้อนของ Radix Menubar เช่น "รายงาน"
                                  ที่แตกเป็น ขาย/จัดซื้อ/คลังสินค้า/... กลุ่มที่ไม่มี sub_groups จะ map
                                  array ว่างเงียบๆ (undefined?.map ไม่มีผล) เรนเดอร์เหมือนเดิมทุกอย่าง */}
                              {menuGroup.sub_groups?.map((subGroup: any) => {
                                const SubIconComp = subGroup.icon
                                  ? ICON_MAP[subGroup.icon] || FolderKey
                                  : null;
                                return (
                                  <MenubarSub key={subGroup.name}>
                                    <MenubarSubTrigger className="rounded-lg py-2.5 px-3 gap-2">
                                      {SubIconComp && (
                                        <SubIconComp className="w-4 h-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                                      )}
                                      {subGroup.name}
                                    </MenubarSubTrigger>
                                    <MenubarSubContent className="p-2 rounded-xl shadow-xl min-w-[200px]">
                                      {subGroup.items.map((item: any, index: number) => (
                                        <MenubarItem key={`${item.path}-${index}`} asChild>
                                          <Link
                                            href={item.path}
                                            className="flex items-center gap-2 py-2.5 px-3 cursor-pointer text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                                          >
                                            <ItemIcon icon={item.icon} />
                                            {item.title}
                                          </Link>
                                        </MenubarItem>
                                      ))}
                                    </MenubarSubContent>
                                  </MenubarSub>
                                );
                              })}
                            </MenubarContent>
                          )}
                      </MenubarMenu>
                      {index < userData.user.menus.length - 1 && (
                        <div className="w-[1.5px] h-5 bg-slate-200 dark:bg-slate-700 mx-1 rounded-full"></div>
                      )}
                    </React.Fragment>
                  );
                })}
              </Menubar>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <NotificationBell />
              <button
                onClick={cycleTheme}
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer text-slate-500"
              >
                <ThemeIcon />
              </button>
              <button
                onClick={toggleLayout}
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer text-slate-500 mr-2"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
              <UserProfileDropdown side="bottom" align="end" isTopbar={true} />
            </div>
          </header>
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-[#F8FAFC] dark:bg-slate-950 relative">
          {children}
        </main>
      </div>
    </div>
    </>
  );
}
