import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai_Looped } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/layouts/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
});

const notoSansThai = Noto_Sans_Thai_Looped({ 
  weight: ['400', '500', '600', '700'], 
  subsets: ["thai"],           
  variable: "--font-noto-thai",
  display: 'swap',
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
    // 💡 1. ใส่ suppressHydrationWarning เพื่อแก้จอแดง
    // 💡 2. ฝังตัวแปร Font ไว้ที่นี่ เพื่อให้ globals.css นำไปใช้งานได้
    <html 
      lang="th" 
      className={`${inter.variable} ${notoSansThai.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppLayout>
            {children}
          </AppLayout>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}