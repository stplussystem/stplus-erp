"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth-storage";

export interface ApprovedDocumentOption {
  id: number;
  document_number: string;
  document_type: string;
  issue_date: string;
  contact?: { business_name?: string; contact_name?: string; name?: string } | null;
}

// 📋 ดึงรายชื่อเอกสารขายที่อนุมัติแล้ว (status=Approved) ของประเภทที่ระบุ — รองรับหลายประเภทพร้อมกัน
// (เช่น quotation + custom_quotation) เพื่อใช้เป็นตัวเลือกใน dropdown "อ้างอิงเอกสารต้นทาง"
// ยิงแยกต่อประเภทและ catch แยกกัน กันกรณีไม่มีสิทธิ์ดูเอกสารประเภทใดประเภทหนึ่ง (403) ไปบล็อกประเภทอื่น
// 🔄 [2026-09-18] เพิ่ม projectId (ไม่บังคับ) — ถ้าหน้าที่เรียกรู้โครงการอยู่แล้ว (เช่น มาจากปุ่มในหน้าโครงการ)
// กรองให้เหลือเฉพาะเอกสารของโครงการนั้น กันไม่ให้เห็นใบเบิกสินค้า/ใบกำกับภาษี ฯลฯ ของโครงการอื่นปนมาให้เลือกผิด
// (ยืนยันกับผู้ใช้แล้วว่าต้องการแบบนี้ทุกหน้าที่ใช้ hook นี้) ไม่ส่ง project_id ถ้ายังไม่รู้โครงการ (แสดงทุกใบเหมือนเดิม)
export function useApprovedDocuments(types: string[], projectId?: string | number | null) {
  const [docs, setDocs] = useState<ApprovedDocumentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const typesKey = types.join(",");
  const projectIdKey = projectId || "";

  useEffect(() => {
    if (!typesKey) {
      setDocs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const projectParam = projectIdKey ? `&project_id=${projectIdKey}` : "";
        const results = await Promise.all(
          typesKey.split(",").map(async (type) => {
            try {
              const res = await fetch(
                `${apiUrl}/sale-documents?type=${type}&status=Approved${projectParam}`,
                { headers },
              );
              if (!res.ok) return [];
              const data = await res.json();
              return Array.isArray(data) ? data : data?.data || [];
            } catch {
              return [];
            }
          }),
        );
        if (cancelled) return;
        const merged: ApprovedDocumentOption[] = results.flat();
        merged.sort((a, b) => (b.issue_date || "").localeCompare(a.issue_date || ""));
        setDocs(merged);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [typesKey, projectIdKey]);

  return { docs, loading };
}
