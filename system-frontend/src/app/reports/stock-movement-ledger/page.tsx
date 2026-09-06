"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import { ListOrdered, ArrowLeft, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";
import { cn } from "@/lib/utils";

interface MovementRow {
  id: number;
  created_at: string;
  type: "in" | "out" | "adjust";
  quantity: number;
  reference_number: string | null;
  product: { name?: string; sku?: string } | null;
  warehouse: { name?: string } | null;
  user: { name?: string } | null;
}

const TYPE_LABEL: Record<string, string> = { in: "รับเข้า", out: "เบิกออก", adjust: "ปรับปรุงยอด" };

function StockMovementLedgerReportPageContent() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState("all");
  const [productId, setProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, type, productId]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (type !== "all") params.set("type", type);
    if (productId) params.set("product_id", productId);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/stock-movement-ledger?${buildParams()}`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/stock-movement-ledger/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_movement_ledger_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setType("all");
    setProductId("");
    setSelectedProduct(null);
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <ListOrdered className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">รายงานความเคลื่อนไหวสต๊อก</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">ทะเบียนธุรกรรมรับเข้า/เบิกออก/ปรับปรุงยอด (สูงสุด 500 รายการ)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/inventory-valuation"
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> รายงานสินค้าคงเหลือ
          </Link>
          <button
            onClick={handleExport}
            className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6 space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่เริ่มต้น</label>
            <AppDatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันที่สิ้นสุด</label>
            <AppDatePicker value={dateTo} onChange={setDateTo} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">ประเภท</label>
            <AppSelect
              value={type}
              onValueChange={setType}
              options={[
                { value: "all", label: "ทั้งหมด" },
                { value: "in", label: "รับเข้า" },
                { value: "out", label: "เบิกออก" },
                { value: "adjust", label: "ปรับปรุงยอด" },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">สินค้า</label>
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
        <button
          onClick={clearFilters}
          className="h-10 px-4 flex items-center justify-center gap-2 text-foreground bg-background border border-border hover:bg-muted rounded-xl text-sm font-medium transition-all cursor-pointer"
        >
          ล้างตัวกรอง
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <AppLoading />
        ) : (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">วันที่</th>
                  <th className="px-6 py-4 font-bold">สินค้า</th>
                  <th className="px-6 py-4 font-bold">คลัง</th>
                  <th className="px-6 py-4 font-bold text-center">ประเภท</th>
                  <th className="px-6 py-4 font-bold text-right">จำนวน</th>
                  <th className="px-6 py-4 font-bold">เลขที่อ้างอิง</th>
                  <th className="px-6 py-4 font-bold">ผู้ทำรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-muted-foreground">
                      ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground">{dayjs(row.created_at).format("DD/MM/YYYY HH:mm")}</td>
                      <td className="px-6 py-4 text-foreground truncate max-w-[200px]">{row.product?.name || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{row.warehouse?.name || "-"}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            row.type === "in"
                              ? "bg-green-50 text-green-600 border-green-200"
                              : row.type === "out"
                                ? "bg-orange-50 text-orange-600 border-orange-200"
                                : "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {TYPE_LABEL[row.type] || row.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">{row.quantity}</td>
                      <td className="px-6 py-4 text-muted-foreground">{row.reference_number || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{row.user?.name || "-"}</td>
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

export default function StockMovementLedgerReportPage() {
  return (
    <RoleRouteGuard permission="view_reports_stock_movement_ledger">
      <StockMovementLedgerReportPageContent />
    </RoleRouteGuard>
  );
}
