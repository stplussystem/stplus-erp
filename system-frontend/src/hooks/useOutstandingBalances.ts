"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth-storage";

// 💰 ดึงยอดค้างชำระต่อใบกำกับภาษี (Approved เท่านั้น) — ใช้คู่กับ useApprovedDocuments(["tax_invoice"])
// ในหน้าสร้างใบวางบิล/ใบเสร็จรับเงินโหมด "อ้างอิงใบกำกับภาษีหลายใบ" (ดู InvoiceReferenceTable)
export function useOutstandingBalances(type: string = "tax_invoice") {
  const [balanceById, setBalanceById] = useState<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const res = await fetch(`${apiUrl}/sale-documents/outstanding-balances?type=${type}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const map: Record<number, number> = {};
        (data?.data || []).forEach((d: any) => {
          map[d.id] = Number(d.outstanding_balance) || 0;
        });
        setBalanceById(map);
      } catch {
        // เงียบไว้ — ถ้าโหลดไม่สำเร็จ InvoiceReferenceTable จะ fallback ไปใช้ grand_total เต็มจำนวนแทน
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  return { balanceById };
}
