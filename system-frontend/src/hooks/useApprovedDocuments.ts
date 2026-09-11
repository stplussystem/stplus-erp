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
export function useApprovedDocuments(types: string[]) {
  const [docs, setDocs] = useState<ApprovedDocumentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const typesKey = types.join(",");

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
        const results = await Promise.all(
          typesKey.split(",").map(async (type) => {
            try {
              const res = await fetch(`${apiUrl}/sale-documents?type=${type}&status=Approved`, { headers });
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
  }, [typesKey]);

  return { docs, loading };
}
