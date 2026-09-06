"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import { AppSelect } from "@/components/ui/app-select";

export interface InvoiceRefRow {
  tax_invoice_id: number;
  document_number: string;
  issue_date: string | null;
  due_date: string | null;
  grand_total: number;
  outstanding_balance: number;
  payment_amount: number;
}

interface InvoiceReferenceTableProps {
  rows: InvoiceRefRow[];
  onChange: (rows: InvoiceRefRow[]) => void;
  // 📋 ใบกำกับภาษีที่อนุมัติแล้วทั้งหมด (จาก useApprovedDocuments) + ยอดค้างชำระต่อใบ (จาก endpoint outstanding-balances)
  // ผสาน 2 แหล่งข้อมูลนี้เข้าด้วยกันตอนเพิ่มแถวใหม่
  availableTaxInvoices: any[];
  outstandingBalanceById: Record<number, number>;
  // 💰 ใบเสร็จรับเงินเท่านั้นที่มีคอลัมน์ "ยอดชำระ" ให้กรอก — ใบวางบิลแค่แจ้งยอดที่จะเรียกเก็บ (ไม่มีคอลัมน์นี้)
  showPaymentColumn: boolean;
  hasError?: boolean;
}

// 🧾 ตารางอ้างอิงใบกำกับภาษีหลายใบ — ใช้ร่วมกันทั้งใบวางบิล (billing_invoice) และใบเสร็จรับเงิน (receipt)
// แทนที่ตารางรายการสินค้าปกติ เมื่อเอกสารสร้างในโหมด "อ้างอิงใบกำกับภาษี" (ตรงข้ามกับโหมดเดิมที่โหลดจากใบเสนอราคา)
export function InvoiceReferenceTable({
  rows,
  onChange,
  availableTaxInvoices,
  outstandingBalanceById,
  showPaymentColumn,
  hasError,
}: InvoiceReferenceTableProps) {
  const selectedIds = new Set(rows.map((r) => r.tax_invoice_id));
  const selectableDocs = availableTaxInvoices.filter((d) => !selectedIds.has(d.id));

  const handleAdd = (idStr: string) => {
    const id = Number(idStr);
    const doc = availableTaxInvoices.find((d) => d.id === id);
    if (!doc) return;
    const outstanding = outstandingBalanceById[id] ?? (Number(doc.grand_total) || 0);
    onChange([
      ...rows,
      {
        tax_invoice_id: id,
        document_number: doc.document_number,
        issue_date: doc.issue_date,
        due_date: doc.due_date,
        grand_total: Number(doc.grand_total) || 0,
        outstanding_balance: outstanding,
        payment_amount: outstanding,
      },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const handlePaymentChange = (index: number, value: string) => {
    const next = [...rows];
    next[index] = { ...next[index], payment_amount: Number(value) || 0 };
    onChange(next);
  };

  return (
    <div className={`border rounded-2xl overflow-hidden mb-6 ${hasError ? "border-red-300" : "border-slate-200"}`}>
      <div className="overflow-x-auto hide-scrollbar">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10 text-center font-bold">#</th>
              <th className="px-4 py-3 font-bold">เลขที่ใบกำกับภาษี</th>
              <th className="px-4 py-3 w-28 text-center font-bold">วันที่</th>
              <th className="px-4 py-3 w-28 text-center font-bold">ครบกำหนด</th>
              <th className="px-4 py-3 w-32 text-right font-bold">จำนวนเงิน</th>
              <th className="px-4 py-3 w-32 text-right font-bold">ยอดค้างชำระ</th>
              {showPaymentColumn && <th className="px-4 py-3 w-36 text-right font-bold">ยอดชำระ</th>}
              <th className="px-4 py-3 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={showPaymentColumn ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                  ยังไม่ได้เลือกใบกำกับภาษี — เลือกจากช่องด้านล่าง
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.tax_invoice_id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-center text-slate-400">{index + 1}</td>
                <td className="px-4 py-3 font-bold text-slate-700">{row.document_number}</td>
                <td className="px-4 py-3 text-center text-slate-500">
                  {row.issue_date ? dayjs(row.issue_date).format("DD/MM/YYYY") : "-"}
                </td>
                <td className="px-4 py-3 text-center text-slate-500">
                  {row.due_date ? dayjs(row.due_date).format("DD/MM/YYYY") : "-"}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {row.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right text-amber-600 font-medium">
                  {row.outstanding_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                {showPaymentColumn && (
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      className="w-full h-10 text-right border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      value={row.payment_amount}
                      onChange={(e) => handlePaymentChange(index, e.target.value)}
                    />
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleRemove(index)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2">
        <Plus className="w-4 h-4 text-blue-600 shrink-0" />
        <div className="flex-1 max-w-md">
          <AppSelect
            value="__none__"
            onValueChange={handleAdd}
            options={[
              { value: "__none__", label: "-- เลือกใบกำกับภาษีเพื่อเพิ่ม --" },
              ...selectableDocs.map((d) => ({
                value: String(d.id),
                label: `${d.document_number} (${dayjs(d.issue_date).format("DD/MM/YYYY")})`,
              })),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
