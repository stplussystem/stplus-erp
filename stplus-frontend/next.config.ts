import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 💡 ปรับให้ Compiler ทำงานเบาลงด้วยการระบุเฉพาะสิ่งที่ใช้
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"], // ถ้าพี่มีใช้ database
  },
  // 💡 อนุญาต IP ให้ถูกต้องเพื่อลด Warning สีส้ม
  devIndicators: {
    appIsrStatus: false, // ปิดตัวบ่งชี้สีส้มที่มุมจอที่จะทำให้เครื่องช้า
  }
};

export default nextConfig;