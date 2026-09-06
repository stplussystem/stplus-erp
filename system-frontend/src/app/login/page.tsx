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
  CircleUser,
} from "lucide-react";
import Link from "next/link";
import {
  setSession,
  getRememberedUser,
  setRememberedUser,
  clearRememberedUser,
} from "@/lib/auth-storage";
import { switchCompany } from "@/lib/company-switch";
import { CompanySelectDialog, type CompanyOption } from "@/components/company/CompanySelectDialog";

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // เด้ง popup เลือกบริษัทเฉพาะตอนที่ยังไม่เคยเลือก/บริษัทที่จำไว้ใช้ไม่ได้แล้วเท่านั้น (ดูเงื่อนไขใน handleLogin)
  const [companyPickerToken, setCompanyPickerToken] = useState<string | null>(null);
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);

  useEffect(() => {
    const savedUser = getRememberedUser();
    if (savedUser) {
      setLoginInput(savedUser);
      setRememberMe(true);
    }
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!loginInput) newErrors.loginInput = "กรุณากรอกชื่อผู้ใช้งานหรืออีเมล";
    if (!password) newErrors.password = "กรุณากรอกรหัสผ่าน";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrorMsg("");

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

      if (rememberMe) {
        setRememberedUser(loginInput);
      } else {
        clearRememberedUser();
      }

      // เก็บทั้ง payload ({user: {...}}) ไม่ใช่แค่ data.user — ให้ตรงกับ shape ที่ AppLayout/usePermission
      // อ่านจาก storage อยู่แล้ว (JSON.parse(...).user) ไม่งั้นสิทธิ์จะอ่านไม่เจอจนกว่า AppLayout จะ refetch /me เอง
      setSession(data.access_token, data);

      const companies: CompanyOption[] = data.user?.companies || [];

      if (companies.length > 1) {
        // มีสิทธิ์เข้าได้มากกว่า 1 บริษัท — ต้องถามทุกครั้งที่ login ไม่จำค่าที่เคยเลือกไว้แล้วข้ามไปสลับเอง
        setCompanyOptions(companies);
        setCompanyPickerToken(data.access_token);
        setLoading(false);
        return;
      }

      toast.success("เข้าสู่ระบบสำเร็จ!");
      router.push("/dashboard");
    } catch (error: any) {
      // 🚀 แก้ไข 1: ดักจับ Error "Failed to fetch" แล้วเปลี่ยนเป็นข้อความภาษาไทย
      if (error.message === "Failed to fetch" || error.name === "TypeError") {
        setErrorMsg(
          "ไม่สามารถเชื่อมต่อ Server ได้กรุณาตรวจสอบ Network หรือ Server",
        );
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelected = async (companyId: number) => {
    if (!companyPickerToken) return;
    try {
      const switchData = await switchCompany(companyPickerToken, companyId);
      setSession(companyPickerToken, switchData);
      toast.success("เข้าสู่ระบบสำเร็จ!");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "ไม่สามารถสลับบริษัทได้");
    }
  };

  const handleForgotPassword = async () => {
    if (!loginInput) {
      setErrors((prev) => ({
        ...prev,
        loginInput: "กรุณากรอก ชื่อผู้ใช้งาน หรือ อีเมล ก่อนกดลืมรหัสผ่านครับ",
      }));
      return;
    }

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
      // ดักจับ Error Network ฝั่งลืมรหัสผ่านด้วยเผื่อไว้ครับ
      if (error.message === "Failed to fetch" || error.name === "TypeError") {
        setErrorMsg("ไม่สามารถเชื่อมต่อระบบได้กรุณาตรวจสอบ Network");
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-border dark:border-slate-800 p-8 sm:p-10">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-muted dark:bg-slate-800 text-foreground rounded-full">
            <CircleUser className="w-16 h-16 text-blue-600" />
          </div>

          {/* <Image
            src="/logos/logo-web-b.svg"
            alt="ST PLUS ERP"
            width={250}
            height={49}
            className="dark:hidden block h-auto"
            priority
          />
          <Image
            src="/logos/logo-web-w.svg"
            alt="ST PLUS ERP"
            width={250}
            height={49}
            className="hidden dark:block h-auto"
            priority
          /> */}
        </div>

        {/* <div className="text-center mb-8">
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            เข้าสู่ระบบ
          </h1>
        </div> */}

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-start gap-3 animate-in fade-in zoom-in-95 duration-200">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              {errorMsg}
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2.5">
            <Label
              htmlFor="loginInput"
              className="text-foreground font-medium ml-1"
            >
              ชื่อผู้ใช้งาน หรือ อีเมล
            </Label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="loginInput"
                type="text"
                name="username"
                autoComplete="username"
                placeholder="Username / Email"
                className="pl-11 h-12 rounded-full text-base bg-muted/50 focus:bg-white dark:bg-slate-950 transition-colors shadow-sm"
                value={loginInput}
                onChange={(e) => {
                  setLoginInput(e.target.value);
                  setErrors((prev) => ({ ...prev, loginInput: "" }));
                }}
                aria-invalid={!!errors.loginInput}
              />
            </div>
            {errors.loginInput && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.loginInput}
              </p>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-foreground font-medium ml-1"
              >
                รหัสผ่าน
              </Label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                className="pl-11 pr-12 h-12 rounded-full text-base bg-muted/50 focus:bg-white dark:bg-slate-950 transition-colors shadow-sm"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: "" }));
                }}
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground/50 cursor-pointer p-2 rounded-full hover:bg-muted dark:hover:bg-slate-800 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-sm pt-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-border text-blue-600 focus:ring-blue-600 w-4 h-4 cursor-pointer"
              />
              <span className="text-muted-foreground font-medium group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
                จำผู้ใช้งาน
              </span>
            </label>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold cursor-pointer disabled:opacity-50 transition-colors"
            >
              {forgotLoading ? "กำลังแจ้งเตือน..." : "ลืมรหัสผ่าน?"}
            </button>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 mt-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full transition-all hover:scale-102 transition-transform"
            disabled={loading}
          >
            {/* 🚀 แก้ไข 2: เพิ่มข้อความ "กำลังตรวจสอบข้อมูล" คู่กับตัวหมุนตอนโหลด */}
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>กำลังตรวจสอบข้อมูล</span>
              </div>
            ) : (
              "เข้าสู่ระบบ"
            )}
          </Button>

          <div className="mt-2 text-center border-t border-border dark:border-slate-800 pt-2">
            <p className="text-sm text-muted-foreground">
              ยังไม่ได้ลงทะเบียนบริษัท?{" "}
              <Link
                href="/register-company"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold hover:underline transition-colors"
              >
                สร้างระบบสำหรับบริษัทคุณ
              </Link>
            </p>
          </div>
        </form>
      </div>

      <CompanySelectDialog
        open={companyPickerToken !== null}
        companies={companyOptions}
        onSelect={handleCompanySelected}
      />
    </div>
  );
}
