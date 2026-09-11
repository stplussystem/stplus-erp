"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { Archive, RefreshCw, FileSpreadsheet, Printer, Coins, Tags, AlertTriangle, ListOrdered, Warehouse as WarehouseIcon, TimerOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";

interface ValuationRow {
  product: { id: number; name: string; sku: string; price: number; category?: { name?: string } | null };
  qty: number;
  reserved_qty: number;
  available_qty: number;
  avg_cost: number | null;
  cost_value: number | null;
  sale_value: number;
}

function InventoryValuationReportPageContent() {
  const [categoryId, setCategoryId] = useState("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [rows, setRows] = useState<ValuationRow[]>([]);
  const [totals, setTotals] = useState({ total_cost_value: 0, total_sale_value: 0 });
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/inventory-valuation?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setRows(result.data?.rows || []);
        setTotals({
          total_cost_value: result.data?.total_cost_value || 0,
          total_sale_value: result.data?.total_sale_value || 0,
        });
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/inventory-valuation/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory_valuation_${Date.now()}.xlsx`;
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
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานสินค้าคงเหลือ</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              มูลค่าต้นทุน (ถัวเฉลี่ยถ่วงน้ำหนักจากประวัติรับสินค้า) และมูลค่าขาย ณ ปัจจุบัน
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
          <button
            onClick={() => window.print()}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <Printer className="w-4 h-4" /> พิมพ์
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6 print:hidden">
        {[
          { href: "/reports/low-stock", icon: AlertTriangle, label: "สินค้าใกล้หมด/ต้องสั่งเพิ่ม" },
          { href: "/reports/stock-movement-ledger", icon: ListOrdered, label: "ความเคลื่อนไหวสต๊อก" },
          { href: "/reports/stock-by-warehouse", icon: WarehouseIcon, label: "สต๊อกแยกตามคลัง" },
          { href: "/reports/slow-moving-stock", icon: TimerOff, label: "สินค้าเคลื่อนไหวช้า/ค้างสต๊อก" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-4 h-9 rounded-full border border-border text-muted-foreground bg-background hover:bg-muted/50 text-xs font-medium transition-all"
          >
            <item.icon className="w-3.5 h-3.5" /> {item.label}
          </Link>
        ))}
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">หมวดหมู่สินค้า</label>
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
            className="h-10 px-4 flex items-center justify-center gap-2 text-foreground bg-background border border-border hover:bg-muted rounded-xl text-sm font-medium transition-all cursor-pointer shrink-0"
          >
            <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
          </button>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">มูลค่าต้นทุนรวม</div>
              <div className="text-xl font-black text-foreground">
                ฿{Number(totals.total_cost_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-center gap-3">
            <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">มูลค่าขายรวม</div>
              <div className="text-xl font-black text-foreground">
                ฿{Number(totals.total_sale_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <AppLoading />
        ) : (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">สินค้า</th>
                  <th className="px-6 py-4 font-bold">หมวดหมู่</th>
                  <th className="px-6 py-4 font-bold text-right">คงเหลือ</th>
                  <th className="px-6 py-4 font-bold text-right">จองแล้ว</th>
                  <th className="px-6 py-4 font-bold text-right">พร้อมใช้จริง</th>
                  <th className="px-6 py-4 font-bold text-right">ต้นทุน/หน่วย</th>
                  <th className="px-6 py-4 font-bold text-right">มูลค่าต้นทุนรวม</th>
                  <th className="px-6 py-4 font-bold text-right">ราคาขาย/หน่วย</th>
                  <th className="px-6 py-4 font-bold text-right">มูลค่าขายรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-muted-foreground">
                      ไม่พบสินค้าคงเหลือตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.product.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">
                        {row.product.name}
                        <div className="text-[11px] text-muted-foreground font-normal">{row.product.sku}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{row.product.category?.name || "-"}</td>
                      <td className="px-6 py-4 text-right text-foreground">{row.qty.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-amber-600">{row.reserved_qty.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-green-600">{row.available_qty.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-foreground">
                        {row.avg_cost !== null
                          ? `฿${Number(row.avg_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        {row.cost_value !== null
                          ? `฿${Number(row.cost_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-right text-foreground">
                        ฿{Number(row.product.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        ฿{Number(row.sale_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InventoryValuationReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_inventory">
      <InventoryValuationReportPageContent />
    </RoleRouteGuard>
  );
}
