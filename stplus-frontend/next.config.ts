import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],

  // 💡 สั่งปิด UI แจ้งเตือน Compiling มุมจอให้หายขาด 100%
  devIndicators: {
    buildActivity: false, // ปิดปุ่ม Compiling สีดำ
    appIsrStatus: false, // ปิดปุ่มลูกศรสายฟ้าสีเหลือง
  },
};

export default nextConfig;
