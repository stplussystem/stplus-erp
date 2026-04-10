import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai_Looped } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/layouts/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

// ตั้งค่า Inter (สำหรับภาษาอังกฤษ)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter", // สร้างตัวแปรไว้เรียกใช้
  display: "swap",
});

// ตั้งค่า Noto Sans Thai Looped (สำหรับภาษาไทย)
const notoSansThai = Noto_Sans_Thai_Looped({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai"],
  variable: "--font-noto-thai", // สร้างตัวแปรไว้เรียกใช้
  display: "swap",
});

export const metadata: Metadata = {
  title: "ST PLUS - Modern ERP",
  description: "ระบบบริหารจัดการสำนักงาน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      {/* 4. ฝังตัวแปรลงคลาส และใช้ style กำหนดลำดับ (เอา Inter ขึ้นก่อนเสมอครับ!) */}
      <body
        className={`${inter.variable} ${notoSansThai.variable}`}
        style={{
          fontFamily: "var(--font-inter), var(--font-noto-thai), sans-serif",
        }}
      >
        <AppLayout>{children}</AppLayout>
        {/* Toaster แจ้งเตือน*/}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
