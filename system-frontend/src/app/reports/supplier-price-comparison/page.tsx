"use client";

import React, { useState, useEffect } from "react";
import { Scale, ArrowLeft, Package, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";

interface ComparisonRow {
  contact: { business_name?: string; contact_person_name?: string } | null;
  total_qty: number;
  avg_unit_price: number | null;
  receipt_count: number;
}

const money = (v: number) => `฿${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function SupplierPriceComparisonReportPage() {
  const [productId, setProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productId) fetchData();
    else setRows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/supplier-price-comparison?product_id=${productId}`, {
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
    if (!productId) return;
    const toastId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/supplier-price-comparison/export?product_id=${productId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supplier_price_comparison_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const minPrice = rows.length > 0 ? Math.min(...rows.filter((r) => r.avg_unit_price !== null).map((r) => r.avg_unit_price as number)) : null;

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">เปรียบเทียบราคาซื้อต่อซัพพลายเออร์</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              เลือกสินค้าเพื่อเปรียบเทียบราคาเฉลี่ยที่เคยรับเข้าจากแต่ละซัพพลายเออร์
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/purchases"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> รายงานจัดซื้อ
          </Link>
          <button
            onClick={handleExport}
            disabled={!productId}
            className="h-10 px-5 py-2 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 lg:sticky lg:top-4 print:hidden">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">สินค้า</label>
            <ProductSearchDropdown
              value={productId}
              selectedName={selectedProduct?.name}
              selectedSku={selectedProduct?.sku}
              onChange={(id, productData) => {
                setProductId(id);
                setSelectedProduct(productData);
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          {!productId ? (
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">กรุณาเลือกสินค้าเพื่อดูการเปรียบเทียบราคา</p>
            </div>
          ) : loading ? (
            <AppLoading />
          ) : rows.length === 0 ? (
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ยังไม่มีประวัติการรับสินค้านี้จากซัพพลายเออร์</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-bold text-left">ซัพพลายเออร์</th>
                    <th className="px-6 py-4 font-bold text-right">จำนวนครั้งที่รับ</th>
                    <th className="px-6 py-4 font-bold text-right">จำนวนรวม</th>
                    <th className="px-6 py-4 font-bold text-right">ราคาเฉลี่ย/หน่วย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {row.contact?.business_name || row.contact?.contact_person_name || "-"}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600">{row.receipt_count}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{row.total_qty}</td>
                      <td
                        className={`px-6 py-4 text-right font-bold ${
                          row.avg_unit_price !== null && row.avg_unit_price === minPrice ? "text-green-600" : "text-slate-800"
                        }`}
                      >
                        {row.avg_unit_price !== null ? money(row.avg_unit_price) : "-"}
                      </td>
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
