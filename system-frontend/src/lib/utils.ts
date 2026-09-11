import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 🛡️ @react-pdf/renderer โหลดรูปข้าม origin ด้วย URL ตรงๆ ไม่ได้ (frontend :3000 → backend :8000) — ต้องแปลง
// เป็น base64 data URI ก่อนเสมอ (เหมือนที่ Company::logoBase64() ทำฝั่ง backend สำหรับโลโก้บริษัท) ใช้ตอน
// เพิ่งอัปโหลดโลโก้เฉพาะเอกสาร (ใบเสนอราคา/บิลเงินสดแบบกำหนดเอง) แล้วยังไม่ได้บันทึกเอกสาร จึงมีแค่ไฟล์ดิบ
// อยู่ในเบราว์เซอร์ ไม่มี URL ที่แปลงแล้วจาก backend ให้ใช้
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
