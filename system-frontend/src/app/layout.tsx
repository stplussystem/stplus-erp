import type { Metadata } from "next";
import { Inter, Sarabun } from "next/font/google"; // 💡 เปลี่ยนจาก Noto_Sans_Thai_Looped เป็น Sarabun
import "./globals.css";
import AppLayout from "@/components/layouts/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// 💡 ตั้งค่า Font Sarabun
const sarabun = Sarabun({
  weight: ["200", "300", "400", "500", "600", "700"],
  subsets: ["thai"],
  variable: "--font-sarabun", // 💡 เปลี่ยนชื่อตัวแปรให้สื่อสารชัดเจน
  display: "swap",
});

// 🚀 1. เพิ่ม Viewport เพื่อรองรับ PWA Theme Color
export const viewport: Viewport = {
  themeColor: "#2563EB",
};

// 🚀 2. อัปเดต Metadata เพิ่ม manifest และไอคอนสำหรับ Apple
export const metadata: Metadata = {
  title: "OFFICE SYSTEM - Modern ERP",
  description: "ระบบบริหารจัดการสำนักงาน",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OFFICE SYSTEM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${sarabun.variable}`} // 💡 ใช้ตัวแปร font-sarabun
      suppressHydrationWarning
    >
      <body className="antialiased font-sans" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppLayout>{children}</AppLayout>
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
