import { getToken, clearSession } from "@/lib/auth-storage";

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  if (!process.env.NEXT_PUBLIC_API_URL && typeof window !== "undefined") {
    console.warn(
      "[api] NEXT_PUBLIC_API_URL ไม่ได้ตั้งค่าไว้ (เช็คไฟล์ .env.local) กำลังใช้ค่า default แทน ซึ่งอาจไม่ตรงกับ backend จริง",
    );
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  const token = getToken();

  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers,
    });

    // 💡 ดักจับ 401 และล้างให้เกลี้ยงทั้ง Local และ Session
    if (response.status === 401) {
      clearSession();
      window.location.href = "/login";
      return null;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(
        `เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (Status: ${response.status})`,
      );
    }

    const data = await response.json();

    // 🚀 จุดที่ 1 ที่โค้ดดี้แก้:
    // ถ้าสถานะไม่ ok (เช่น 422 ข้อมูลซ้ำ) ให้ส่งก้อน data ที่ได้จาก Laravel กลับไปตรงๆ เลย
    // ไม่ต้องใช้ throw new Error() แล้วครับ ข้อมูล errors รายช่องจะได้ไม่หาย
    if (!response.ok) {
      return Promise.reject(data);
    }

    return data;
  } catch (error: any) {
    // 🚀 จุดที่ 2 ที่โค้ดดี้แก้:
    // ลบ console.error ออก เพื่อไม่ให้ Next.js เด้งจอแดง (Error Overlay)
    // แล้วส่ง error ต่อไปเงียบๆ ให้ไฟล์หน้าเว็บ (ContactForm) จัดการต่อ
    return Promise.reject(error);
  }
}
