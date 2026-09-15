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

// 🆕 [2026-09-15] เซฟไฟล์ Blob ลงเครื่องผู้ใช้โดยตรง (ไม่เปิด preview modal) — ใช้กับปุ่ม "ดาวน์โหลด (A4)" ของ
// ใบกำกับภาษี/ใบเสร็จรับเงิน สร้าง <a download> ชั่วคราวแล้วกดเองด้วยโค้ด จากนั้นเก็บกวาดทิ้งทันที
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
