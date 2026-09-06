"use client";

import React, { useState, useEffect } from "react";
import { Warehouse as WarehouseIcon, ArrowLeft, Package, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";

interface WarehouseGroup {
  warehouse: { id: number; name: string } | null;
  total_qty: number;
  total_reserved_qty: number;
  product_count: number;
  items: { product: { name?: string; sku?: string } | null; qty: number; reserved_qty: number; available_qty: number }[];
}

export default function StockByWarehouseReportPage() {
  const [warehouseId, setWarehouseId] = useState("all");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [groups, setGroups] = useState<WarehouseGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  const fetchWarehouses = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/warehouses`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setWarehouses(Array.isArray(result) ? result : []);
      }
    } catch (error) {}
  };

  const buildParams = () => {
    const params = new URLSearchParams();
    if (warehouseId !== "all") params.set("warehouse_id", warehouseId);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/stock-by-warehouse?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setGroups(result.data || []);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/stock-by-warehouse/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_by_warehouse_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  return (
    <div className="w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <WarehouseIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานสต๊อกแยกตามคลัง</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">ยอดคงเหลือสินค้าแยกตามคลังสินค้าแต่ละแห่ง</p>
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 lg:sticky lg:top-4 print:hidden">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">คลังสินค้า</label>
            <AppSelect
              value={warehouseId}
              onValueChange={setWarehouseId}
              options={[
                { value: "all", label: "ทุกคลัง" },
                ...warehouses.map((w: any) => ({ value: String(w.id), label: w.name })),
              ]}
            />
          </div>
        </div>

        {loading ? (
          <AppLoading />
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ไม่มีสินค้าคงเหลือตามเงื่อนไขที่เลือก</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group, gIdx) => (
              <div key={gIdx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                  <span className="font-bold text-slate-800">{group.warehouse?.name || "-"}</span>
                  <span className="text-xs text-slate-500">
                    {group.product_count} รายการ · รวม {group.total_qty.toLocaleString()} ชิ้น
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-bold text-left">สินค้า</th>
                      <th className="px-6 py-3 font-bold text-right">คงเหลือ</th>
                      <th className="px-6 py-3 font-bold text-right">จองแล้ว</th>
                      <th className="px-6 py-3 font-bold text-right">พร้อมใช้จริง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-3">
                          <div className="font-medium text-slate-800">{item.product?.name || "-"}</div>
                          <div className="text-xs text-slate-500">{item.product?.sku || "-"}</div>
                        </td>
                        <td className="px-6 py-3 text-right text-slate-700">{item.qty}</td>
                        <td className="px-6 py-3 text-right text-amber-600">{item.reserved_qty}</td>
                        <td className="px-6 py-3 text-right font-bold text-green-600">{item.available_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
