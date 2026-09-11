import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development", /// ปิด PWA ในโหมดพัฒนาเพื่อให้การพัฒนาเร็วขึ้น
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  
  // 🚀 เพิ่มบรรทัดนี้เข้าไป เพื่อบอก Next.js ว่าเรารับทราบเรื่อง Turbopack แล้ว
  turbopack: {}, 

  // 🚀 ปิด Strict Mode เพื่อแก้ปัญหาการยิง API ซ้ำซ้อน 2-3 รอบตอน Dev
  reactStrictMode: false,

  // 🚀 [โค้ดดี้เพิ่มให้] ปลดล็อคให้ Next.js ยอมรับรูปภาพจาก Laravel Backend
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
      }
    ],
  },
};

export default withPWA(nextConfig);