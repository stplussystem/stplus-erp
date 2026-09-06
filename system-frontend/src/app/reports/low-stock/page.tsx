"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, ArrowLeft, Package, RefreshCw, FileSpreadsheet, Printer } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";

interface LowStockRow {
  product: { id: number; name: string; sku: string } | null;
  qty: number;
  reserved_qty: number;
  available_qty: number;
  threshold: number;
  shortage: number;
}

export default function LowStockReportPage() {
  const [categoryId, setCategoryId] = useState("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [rows, setRows] = useState<LowStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const fetchCategories = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/product-options`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setCategories(result.categories || []);
      }
    } catch (error) {}
  };

  const buildParams = () => {
    const params = new URLSearchParams();
    if (categoryId !== "all") params.set("category_id", categoryId);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/low-stock?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setRows(result.data || []);
      }
    } catch (error) {
      toast.error("โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const toastId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/low-stock/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `low_stock_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const clearFilters = () => setCategoryId("all");

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานสินค้าใกล้หมด / ต้องสั่งเพิ่ม</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              สินค้าที่ยอดคงเหลือรวมทุกคลังต่ำกว่าหรือเท่ากับเกณฑ์ขั้นต่ำที่ตั้งไว้
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/inventory-valuation"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> รายงานสินค้าคงเหลือ
          </Link>
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-slate-200 hover:border-slate-300 text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
          <button
            onClick={() => window.print()}
            className="h-10 px-5 py-2 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-slate-200 hover:border-slate-300 text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Printer className="w-4 h-4" /> พิมพ์
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 lg:sticky lg:top-4 print:hidden">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">หมวดหมู่สินค้า</label>
            <AppSelect
              value={categoryId}
              onValueChange={setCategoryId}
              options={[
                { value: "all", label: "หมวดหมู่ทั้งหมด" },
                ...categories.map((c: any) => ({ value: String(c.id), label: c.name })),
              ]}
            />
          </div>
          <button
            onClick={clearFilters}
            className="w-full h-10 px-4 flex items-center justify-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <AppLoading />
          ) : rows.length === 0 ? (
            <div className="text-center py-14">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ไม่มีสินค้าใกล้หมดตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-bold text-left">สินค้า</th>
                    <th className="px-6 py-4 font-bold text-right">คงเหลือ</th>
                    <th className="px-6 py-4 font-bold text-right">จองแล้ว</th>
                    <th className="px-6 py-4 font-bold text-right">พร้อมใช้จริง</th>
                    <th className="px-6 py-4 font-bold text-right">เกณฑ์ขั้นต่ำ</th>
                    <th className="px-6 py-4 font-bold text-right">ขาดอีก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{row.product?.name || "-"}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{row.product?.sku || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700">{row.qty}</td>
                      <td className="px-6 py-4 text-right text-amber-600">{row.reserved_qty}</td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">{row.available_qty}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{row.threshold}</td>
                      <td className="px-6 py-4 text-right font-bold text-amber-600">{row.shortage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
