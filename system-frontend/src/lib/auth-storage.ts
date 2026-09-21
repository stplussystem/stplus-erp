// จุดเดียวที่จัดการ localStorage/sessionStorage ทั้งหมดของแอป (session, ค่าจำผู้ใช้, การตั้งค่า layout)
// ก่อนหน้านี้แต่ละหน้าเขียน/อ่าน key ตรงๆ กระจายกันหลายสิบไฟล์ ทำให้แก้ยาก — รวมมาไว้ที่เดียว เรียกผ่าน import แทน
const TOKEN_KEY = "system_token";
const USER_KEY = "system_user";
const REMEMBER_USER_KEY = "system_remember_user";
const LAYOUT_KEY = "system_layout";
const MINI_SIDEBAR_KEY = "system_minisidebar";

// ยิง event นี้ทุกครั้งที่ session/สิทธิ์ผู้ใช้เปลี่ยน เพื่อให้ hook ที่ mount อยู่แล้ว (เช่น usePermission)
// รู้ตัวและ recompute ใหม่ทันที โดยไม่ต้องรอ remount — native "storage" event จะช่วยแจ้งข้ามแท็บให้อัตโนมัติอยู่แล้ว
// (แต่ "storage" event ไม่ยิงในแท็บที่เป็นคนเขียนเอง) จึงต้องมี custom event นี้เสริมสำหรับแท็บปัจจุบัน
export const AUTH_UPDATED_EVENT = "auth:updated";

// ===== Session (token + user) =====
// เขียนลงทั้ง localStorage และ sessionStorage เสมอ เพราะโค้ดเดิมในหลายหน้าอ่านจากคนละที่กัน
// (บางหน้าเช็ค localStorage อย่างเดียว บางหน้าเช็ค sessionStorage อย่างเดียว) การเขียนคู่ทำให้ทุกหน้าทำงานถูกต้องโดยไม่ต้องไล่แก้ทีละไฟล์
export function setSession(token: string, user: unknown) {
  const userJson = JSON.stringify(user);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, userJson);
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, userJson);
  window.dispatchEvent(new Event(AUTH_UPDATED_EVENT));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

// คืนค่า user เป็น raw JSON string (ไม่ parse) — ไว้ให้หน้าที่มี logic แกะโครงสร้าง user เอง (เช่น unwrap .user) เรียกแล้ว JSON.parse ต่อเองได้เหมือนเดิม
export function getUserRaw(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
}

export function getStoredUser<T = any>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_UPDATED_EVENT));
}

// ===== "จำผู้ใช้งาน" ตอน login (sessionStorage อย่างเดียว ตามพฤติกรรมเดิม) =====
export function getRememberedUser(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REMEMBER_USER_KEY);
}

export function setRememberedUser(login: string) {
  sessionStorage.setItem(REMEMBER_USER_KEY, login);
}

export function clearRememberedUser() {
  sessionStorage.removeItem(REMEMBER_USER_KEY);
}

// ===== การตั้งค่า Layout (sidebar/topbar, mini sidebar) =====
export function getLayoutPref(): "sidebar" | "topbar" | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAYOUT_KEY) as "sidebar" | "topbar" | null;
}

export function setLayoutPref(mode: "sidebar" | "topbar") {
  localStorage.setItem(LAYOUT_KEY, mode);
}

export function getMiniSidebarPref(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MINI_SIDEBAR_KEY) === "true";
}

export function setMiniSidebarPref(value: boolean) {
  localStorage.setItem(MINI_SIDEBAR_KEY, value.toString());
}

// ===== การตั้งค่า Layout หน้า /permissions (เรียงอิสระ ↔ เรียงตามลำดับหมายเลข) =====
// เก็บ per-browser เหมือน layoutMode/miniSidebar ด้านบน — เป็นแค่ความสะดวกในการจัดหน้าจอส่วนตัว
// ไม่ต้อง sync ข้ามเครื่อง/ผู้ใช้ จึงไม่มีความจำเป็นต้องมี backend endpoint ใหม่
const PERM_LAYOUT_KEY = "system_perm_layout";
const PERM_POSITIONS_KEY = "system_perm_positions";

export function getPermissionsLayoutMode(): "default" | "free" {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem(PERM_LAYOUT_KEY) === "free" ? "free" : "default";
}

export function setPermissionsLayoutMode(mode: "default" | "free") {
  localStorage.setItem(PERM_LAYOUT_KEY, mode);
}

export function getPermissionsGroupPositions(): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PERM_POSITIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setPermissionsGroupPositions(positions: Record<string, { x: number; y: number }>) {
  localStorage.setItem(PERM_POSITIONS_KEY, JSON.stringify(positions));
}
