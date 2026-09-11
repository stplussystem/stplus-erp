import Image from "next/image";

// สร้าง Component ย่อยๆ แยกตามประเภทการใช้งาน
export const IconPackage = ({ size = 24 }: { size?: number }) => (
  <Image
    src="/icons/package.png"
    width={size}
    height={size}
    alt="สินค้า"
    priority
  />
);

export const IconStockIn = ({ size = 24 }: { size?: number }) => (
  <Image src="/icons/package-in.png" width={size} height={size} alt="รับเข้า" />
);

export const IconStockOut = ({ size = 24 }: { size?: number }) => (
  <Image
    src="/icons/package-out.png"
    width={size}
    height={size}
    alt="เบิกออก"
  />
);
