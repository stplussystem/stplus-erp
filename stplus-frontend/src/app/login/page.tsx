"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  BellRing,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  // 💡 States ต่างๆ
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loginInput, setLoginInput] = useState(""); // เปลี่ยนจาก email เป็น loginInput
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // ควบคุมรูปตา
  const [rememberMe, setRememberMe] = useState(false); // ควบคุมการจำ User
  const [errorMsg, setErrorMsg] = useState(""); // แจ้งเตือนในกล่อง

  // โหลดข้อมูล User ที่เคยบันทึกไว้ (ถ้ามี)
  useEffect(() => {
    const savedUser = localStorage.getItem("stplus_remember_user");
    if (savedUser) {
      setLoginInput(savedUser);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(""); // เคลียร์ error เก่าก่อน

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    try {
      const response = await fetch(`${apiUrl}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ login: loginInput, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      }

      // 💡 ระบบ Remember Me (บันทึกแค่ชื่อ/อีเมล)
      if (rememberMe) {
        localStorage.setItem("stplus_remember_user", loginInput);
      } else {
        localStorage.removeItem("stplus_remember_user");
      }

      localStorage.setItem("stplus_token", data.access_token);
      localStorage.setItem("stplus_user", JSON.stringify(data.user));
      document.cookie = `stplus_token=${data.access_token}; path=/; max-age=86400`; // อายุ 1 วัน

      toast.success("เข้าสู่ระบบสำเร็จ!");
      router.push("/dashboard");
    } catch (error: any) {
      setErrorMsg(error.message); // แสดง error ในกล่องแดงแทน Toaster
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginInput) {
      setErrorMsg("กรุณากรอก ชื่อผู้ใช้งาน หรือ อีเมล ก่อนกดลืมรหัสผ่านครับ");
      return;
    }

    /* =========================================================
      💡 ระบบลืมรหัสผ่าน แบบที่ 1 (แจ้งเตือนให้ติดต่อ Admin โดยตรง)
      **คอมเมนต์เก็บไว้เผื่อพี่แม็คอยากสลับมาใช้ในอนาคตครับ**
      =========================================================
      
      alert(`กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน\nพนักงาน: ${loginInput}\nโทร: 08X-XXX-XXXX หรือ Line: @admin_stplus`);
      return; 
    */

    // =========================================================
    // 💡 ระบบลืมรหัสผ่าน แบบที่ 2 (ส่งเข้า LINE Notify อัตโนมัติ)
    // =========================================================
    setForgotLoading(true);
    setErrorMsg("");
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    try {
      const response = await fetch(`${apiUrl}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ login: loginInput }),
      });

      if (!response.ok) throw new Error("ไม่สามารถส่งคำขอได้ กรุณาลองใหม่");

      toast.success(
        `ส่งคำขอรีเซ็ตรหัสผ่านของ "${loginInput}" ไปยัง Admin แล้ว!`,
        {
          icon: <BellRing className="w-4 h-4 text-green-500" />,
        },
      );
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
        <div className="flex justify-center mb-8">
          <Image
            src="/logos/logo-web-b.svg"
            alt="ST PLUS ERP"
            width={180}
            height={40}
            className="dark:hidden block"
            priority
          />
          <Image
            src="/logos/logo-web-w.svg"
            alt="ST PLUS ERP"
            width={180}
            height={40}
            className="hidden dark:block"
            priority
          />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            เข้าสู่ระบบ
          </h1>
        </div>

        {/* 💡 กล่องแจ้งเตือน Error สีแดง (แสดงเมื่อมี errorMsg) */}
        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              {errorMsg}
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="loginInput">ชื่อผู้ใช้งาน หรือ อีเมล</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="loginInput"
                type="text"
                placeholder="Username / Email"
                className="pl-10"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">รหัสผ่าน</Label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"} // 💡 สลับ Type ตาม State
                className="pl-10 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {/* 💡 ปุ่มรูปตา สลับเปิด/ปิด รหัสผ่าน */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            {/* 💡 จำ User */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 w-4 h-4"
              />
              <span className="text-slate-600 dark:text-slate-400">
                จำผู้ใช้งาน
              </span>
            </label>

            {/* ปุ่มลืมรหัสผ่าน */}
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
              className="text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer disabled:opacity-50"
            >
              {forgotLoading ? "กำลังแจ้งเตือน..." : "ลืมรหัสผ่าน?"}
            </button>
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 mt-4"
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>
        </form>
      </div>
    </div>
  );
}
