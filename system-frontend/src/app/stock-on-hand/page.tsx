"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import {
  Boxes,
  Layers,
  Coins,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  Search,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  StockAdjustmentAction,
  ImportUndoBanner,
} from "@/components/products/ProductExcelActions";

function StockOnHandPageContent() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [granularity, setGranularity] = useState("all");
  // 🆕 [2026-09-20] ตัวกรองสต็อก: all = สินค้าทั้งระบบ (รวมที่เป็น 0), in_stock = มีสินค้า (รวมของที่ติดยืม/จอง), zero = สินค้าเป็น 0
  const [stockStatus, setStockStatus] = useState("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, warehouseId, granularity, stockStatus]);

  const fetchOptions = async () => {
    try {
      const token = getToken();
      const [productOptionsRes, warehousesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/product-options`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/warehouses`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
      ]);
      if (productOptionsRes.ok) {
        const result = await productOptionsRes.json();
        setCategories(result.categories || []);
      }
      if (warehousesRes.ok) {
        const result = await warehousesRes.json();
        setWarehouses(Array.isArray(result) ? result : []);
      }
    } catch (error) {}
  };

  const buildParams = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryId !== "all") params.set("category_id", categoryId);
    if (warehouseId !== "all") params.set("warehouse_id", warehouseId);
    if (granularity !== "all") params.set("granularity", granularity);
    if (stockStatus !== "all") params.set("stock_status", stockStatus);
    return params;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock-on-hand?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setRows(result.data?.rows || []);
        setSummary(result.data?.summary || {});
      }
    } catch (error) {
      toast.error("โหลดข้อมูลสินค้าคงเหลือไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // 🛡️ เก็บ fetchData เวอร์ชันล่าสุดไว้ใน ref กัน stale closure — event listener ผูกครั้งเดียวตอน mount
  // แต่ต้องอ่านค่าตัวกรอง (search/categoryId/ฯลฯ) ปัจจุบันเสมอตอนเหตุการณ์ยิงจริง ไม่ใช่ค่าตอน mount
  const fetchDataRef = React.useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    // 🆕 รีเฟรชตารางทันทีหลังปรับปรุงสต๊อก (นำเข้า/ยกเลิกการนำเข้า) สำเร็จ — เหตุการณ์เดียวกับที่
    // ImportUndoBanner/StockAdjustmentAction ยิงออกมา (ดู ProductExcelActions.tsx)
    const handler = () => fetchDataRef.current();
    window.addEventListener("refreshProducts", handler);
    return () => window.removeEventListener("refreshProducts", handler);
  }, []);

  const handleExport = async () => {
    const toastId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock-on-hand/export?${buildParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_on_hand_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setCategoryId("all");
    setWarehouseId("all");
    setGranularity("all");
    setStockStatus("all");
  };

  const toggleExpand = (productId: number) => {
    setExpanded((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const formatMoney = (n: number) => `฿${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : "-");

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">สินค้าคงเหลือ</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              แยกรายชิ้นตาม S/N สำหรับสินค้าที่คุม S/N และแยกรายล็อตที่รับเข้าสำหรับสินค้าที่ไม่คุม S/N พร้อมต้นทุนจริงแบบ FIFO
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StockAdjustmentAction />
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

      <ImportUndoBanner watchType="adjust" />

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-64">
              <label className="block text-xs font-medium text-muted-foreground mb-1">ค้นหา</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ชื่อ, SKU, บาร์โค้ด, S/N..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
                  className="pl-9 h-10 bg-background border-border rounded-xl text-sm"
                />
              </div>
            </div>
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
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">คลังสินค้า</label>
              <AppSelect
                value={warehouseId}
                onValueChange={setWarehouseId}
                options={[
                  { value: "all", label: "คลังทั้งหมด" },
                  ...warehouses.map((w: any) => ({ value: String(w.id), label: w.name })),
                ]}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">ประเภท</label>
              <AppSelect
                value={granularity}
                onValueChange={setGranularity}
                options={[
                  { value: "all", label: "ทั้งหมด" },
                  { value: "serial", label: "เฉพาะสินค้าคุม S/N" },
                  { value: "lot", label: "เฉพาะสินค้าไม่คุม S/N" },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">สถานะสต็อก</label>
              <AppSelect
                value={stockStatus}
                onValueChange={setStockStatus}
                options={[
                  { value: "all", label: "ทั้งหมด (รวมสินค้าเป็น 0)" },
                  { value: "in_stock", label: "มีสินค้า" },
                  { value: "zero", label: "สินค้าเป็น 0" },
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

          {!loading && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-lg">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground leading-none">รวมคงเหลือ</div>
                  <div className="text-base font-black text-foreground leading-tight">
                    {Number(summary.total_qty || 0).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-lg">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground leading-none">มูลค่าต้นทุนรวม (FIFO)</div>
                  <div className="text-base font-black text-foreground leading-tight">
                    {formatMoney(summary.total_cost_value)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-green-50 dark:bg-green-950/20">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/40 text-green-600 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground leading-none">จำนวนหน่วยย่อย (S/N + ล็อต)</div>
                  <div className="text-base font-black text-foreground leading-tight">
                    {Number(summary.unit_count || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <AppLoading />
        ) : (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-bold w-10"></th>
                  <th className="px-6 py-4 font-bold">สินค้า</th>
                  <th className="px-6 py-4 font-bold">ประเภท</th>
                  <th className="px-6 py-4 font-bold">หมวดหมู่</th>
                  <th className="px-6 py-4 font-bold text-right">คงเหลือรวม</th>
                  <th className="px-6 py-4 font-bold text-right">หน่วยย่อย</th>
                  <th className="px-6 py-4 font-bold text-right">ต้นทุนเฉลี่ย/หน่วย</th>
                  <th className="px-6 py-4 font-bold text-right">มูลค่าต้นทุนรวม</th>
                  <th className="px-6 py-4 font-bold text-center">สถานะต้นทุน</th>
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
                  rows.map((row: any) => {
                    const isSerial = row.granularity === "serial";
                    const isOpen = !!expanded[row.product.id];
                    return (
                      <React.Fragment key={row.product.id}>
                        <tr
                          className="hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => toggleExpand(row.product.id)}
                        >
                          <td className="px-4 py-4 text-muted-foreground">
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-6 py-4 font-bold text-foreground">
                            {row.product.name}
                            <div className="text-[11px] text-muted-foreground font-normal">{row.product.sku}</div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={isSerial ? "default" : "secondary"} className="text-[10px]">
                              {isSerial ? "คุม S/N" : "รายล็อต"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">{row.product.category?.name || "-"}</td>
                          <td className="px-6 py-4 text-right text-foreground">
                            <span className={Number(row.total_qty) === 0 ? "text-red-500 font-bold" : ""}>
                              {Number(row.total_qty).toLocaleString()}
                            </span>
                            {/* 🆕 ของที่ติดยืม/จอง — คงเหลือ 0 แต่ติดยืม N = ยังมีของ N ชิ้น แค่ไม่ว่าง */}
                            {Number(row.held_qty) > 0 && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                              >
                                {row.held_only
                                  ? `มี ${Number(row.held_qty).toLocaleString()} (ติดยืม/จอง)`
                                  : `ติดยืม/จอง ${Number(row.held_qty).toLocaleString()}`}
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-muted-foreground">
                            {row.unit_count} {isSerial ? "S/N" : "ล็อต"}
                          </td>
                          <td className="px-6 py-4 text-right text-foreground">{formatMoney(row.avg_unit_cost)}</td>
                          <td className="px-6 py-4 text-right font-bold text-foreground">{formatMoney(row.total_cost_value)}</td>
                          <td className="px-6 py-4 text-center">
                            {row.has_estimated_cost && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20 gap-1"
                              >
                                <AlertTriangle className="w-3 h-3" /> ประมาณการ
                              </Badge>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-muted/30">
                            <td colSpan={9} className="p-0">
                              <div className="px-4 py-3">
                                {row.units.length === 0 && !(row.held_units?.length > 0) && (
                                  <div className="px-4 py-2 text-xs text-muted-foreground">
                                    สินค้านี้คงเหลือ 0 ในตอนนี้
                                  </div>
                                )}
                                {row.held_units?.length > 0 && (
                                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/10 p-3">
                                    <div className="text-xs font-bold text-amber-700 mb-2">
                                      S/N ที่ติดยืม/จอง ({row.held_units.length}) — ยังเป็นของเราอยู่ แต่ไม่ว่างให้ขาย
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                                      {row.held_units.map((h: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between gap-3 text-xs">
                                          <span className="font-mono text-foreground">{h.serial_number}</span>
                                          <span className="text-muted-foreground">
                                            {h.reference_number || "-"}
                                            {h.warehouse?.name ? ` • ${h.warehouse.name}` : ""}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {row.units.length > 0 && (
                                <table className="w-full text-xs text-left">
                                  <thead className="text-muted-foreground">
                                    <tr>
                                      <th className="px-4 py-2 font-semibold">{isSerial ? "S/N" : "ล็อต"}</th>
                                      <th className="px-4 py-2 font-semibold">คลัง</th>
                                      <th className="px-4 py-2 font-semibold">วันที่รับเข้า</th>
                                      <th className="px-4 py-2 font-semibold">เลขที่เอกสารรับ</th>
                                      {!isSerial && <th className="px-4 py-2 font-semibold text-right">คงเหลือ / รับเข้า</th>}
                                      <th className="px-4 py-2 font-semibold text-right">ต้นทุน/หน่วย</th>
                                      <th className="px-4 py-2 font-semibold text-right">มูลค่า</th>
                                      <th className="px-4 py-2 font-semibold text-center">สถานะ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/60">
                                    {row.units.map((unit: any, idx: number) => (
                                      <tr key={idx}>
                                        <td className="px-4 py-2 font-mono text-foreground">
                                          {isSerial ? unit.serial_number : unit.lot_label}
                                        </td>
                                        <td className="px-4 py-2 text-muted-foreground">{unit.warehouse?.name || "-"}</td>
                                        <td className="px-4 py-2 text-muted-foreground">{formatDate(unit.received_at)}</td>
                                        <td className="px-4 py-2 text-muted-foreground">{unit.reference_number || "-"}</td>
                                        {!isSerial && (
                                          <td className="px-4 py-2 text-right text-foreground">
                                            {Number(unit.qty_remaining).toLocaleString()} / {Number(unit.qty_received).toLocaleString()}
                                          </td>
                                        )}
                                        <td className="px-4 py-2 text-right text-foreground">{formatMoney(unit.unit_cost)}</td>
                                        <td className="px-4 py-2 text-right font-semibold text-foreground">
                                          {formatMoney(unit.cost_value)}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          {unit.cost_is_estimated ? (
                                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                              ประมาณการ
                                            </Badge>
                                          ) : isSerial ? (
                                            <Badge className="text-[10px] bg-green-600 hover:bg-green-600">พร้อมขาย</Badge>
                                          ) : (
                                            "-"
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StockOnHandPage() {
  return (
    <RoleRouteGuard permission="view_stock_on_hand">
      <StockOnHandPageContent />
    </RoleRouteGuard>
  );
}
