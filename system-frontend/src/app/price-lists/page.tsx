"use client";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

import React, { useState, useEffect } from "react";
import {
  Tags,
  Search,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { apiFetch } from "@/lib/api";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppPagination } from "@/components/ui/app-pagination";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermission } from "@/hooks/usePermission";
import { PriceListImportExportAction } from "@/components/products/PriceListExcelActions";
import { PriceListEntryDialog } from "@/components/products/PriceListEntryDialog";
import { VendorSearchDropdown } from "@/components/products/VendorSearchDropdown";

const TREND_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  up: { label: "ราคาขึ้น", className: "bg-red-50 text-red-600 border-red-200", icon: TrendingUp },
  down: { label: "ราคาลง", className: "bg-green-50 text-green-600 border-green-200", icon: TrendingDown },
  stable: { label: "ราคาคงที่", className: "bg-muted text-muted-foreground border-border", icon: Minus },
};

function PriceListsPageContent() {
  const canManage = usePermission("manage_price_lists");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [expiringFilter, setExpiringFilter] = useState("all");
  const [vendors, setVendors] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 15;

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  // 🚀 กรองแบบ debounce ทันทีที่พิมพ์ (400ms) — onKeyDown ที่ Input ยังคงไว้ให้กด Enter ข้ามการรอได้ทันที
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, vendorFilter, expiringFilter]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, vendorFilter, expiringFilter, currentPage]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("refreshPriceLists", handler);
    return () => window.removeEventListener("refreshPriceLists", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, vendorFilter, expiringFilter, currentPage]);

  const fetchVendors = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contacts`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        setVendors(list.filter((c: any) => !!c.is_vendor));
      }
    } catch (error) {}
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (vendorFilter !== "all") params.set("vendor_id", vendorFilter);
      if (expiringFilter !== "all") params.set("expiring_within_days", expiringFilter);
      params.set("page", String(currentPage));
      params.set("per_page", String(perPage));

      const res = await apiFetch(`/product-price-lists?${params}`);
      setRows(res?.data || []);
      setLastPage(res?.last_page || 1);
      setTotal(res?.total || 0);
    } catch (error: any) {
      toast.error(error.message || "โหลดข้อมูล Price List ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setVendorFilter("all");
    setExpiringFilter("all");
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/product-price-lists/${entryToDelete.id}`, { method: "DELETE" });
      toast.success("ลบรายการสำเร็จ");
      setEntryToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "ลบไม่สำเร็จ");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Tags className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">Price List ผู้จำหน่าย</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ราคาที่แต่ละผู้จำหน่ายตั้งไว้ต่อสินค้า ใช้เทียบตอนอนุมัติใบเสนอราคา
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PriceListImportExportAction vendors={vendors} />
          {canManage && (
            <button
              onClick={() => {
                setEditingEntry(null);
                setEntryDialogOpen(true);
              }}
              className="flex justify-center h-10 px-5 py-2 gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <Plus className="w-4 h-4" /> เพิ่มรายการ
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <label className="block text-xs font-medium text-muted-foreground mb-1">ค้นหา</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ชื่อสินค้า, SKU..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
                className="pl-9 h-10 bg-background border-border rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">ผู้จำหน่าย</label>
            <VendorSearchDropdown
              value={vendorFilter}
              vendors={vendors}
              onChange={setVendorFilter}
              allowAll
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">วันหมดอายุ</label>
            <AppSelect
              value={expiringFilter}
              onValueChange={setExpiringFilter}
              options={[
                { value: "all", label: "ทั้งหมด" },
                { value: "0", label: "หมดอายุแล้ว" },
                { value: "7", label: "ใกล้หมดอายุใน 7 วัน" },
                { value: "30", label: "ใกล้หมดอายุใน 30 วัน" },
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

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <AppLoading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">สินค้า</th>
                  <th className="px-6 py-4 font-bold">ผู้จำหน่าย</th>
                  <th className="px-6 py-4 font-bold text-right">ราคา</th>
                  <th className="px-6 py-4 font-bold text-right">ส่วนลด</th>
                  <th className="px-6 py-4 font-bold text-right">ราคาสั่งซื้อ</th>
                  <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                  <th className="px-6 py-4 font-bold">อัพเดทล่าสุด</th>
                  <th className="px-6 py-4 font-bold">วันสิ้นสุดราคา</th>
                  <th className="px-6 py-4 font-bold text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-muted-foreground">
                      ไม่พบรายการ Price List ตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((row: any) => {
                    const trend = TREND_BADGE[row.price_trend] || TREND_BADGE.stable;
                    const TrendIcon = trend.icon;
                    const isExpired = row.expiry_date && new Date(row.expiry_date) < new Date();
                    return (
                      <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-foreground">{row.product?.name}</div>
                          <div className="text-xs text-muted-foreground">{row.product?.sku}</div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {row.vendor?.business_name || row.vendor?.contact_person_name || "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-foreground">
                          {Number(row.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground">
                          {row.discount_percent != null ? `${row.discount_percent}%` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right text-red-600 font-bold">
                          {(Number(row.price) * (1 - (Number(row.discount_percent) || 0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="outline" className={`text-[10px] gap-1 ${trend.className}`}>
                            <TrendIcon className="w-3 h-3" /> {trend.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {row.updated_at ? new Date(row.updated_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                        </td>
                        <td className="px-6 py-4">
                          {row.expiry_date ? (
                            <span className={isExpired ? "text-red-600 font-bold flex items-center gap-1" : "text-muted-foreground"}>
                              {isExpired && <AlertTriangle className="w-3.5 h-3.5" />}
                              {new Date(row.expiry_date).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            {canManage && (
                              <AppTooltip label="แก้ไข">
                                <button
                                  onClick={() => {
                                    setEditingEntry(row);
                                    setEntryDialogOpen(true);
                                  }}
                                  className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </AppTooltip>
                            )}
                            {canManage && (
                              <AppTooltip label="ลบ">
                                <button
                                  onClick={() => setEntryToDelete(row)}
                                  className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </AppTooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AppPagination
        currentPage={currentPage}
        lastPage={lastPage}
        total={total}
        perPage={perPage}
        onPageChange={setCurrentPage}
      />

      <PriceListEntryDialog
        open={entryDialogOpen}
        onClose={() => setEntryDialogOpen(false)}
        onSaved={fetchData}
        vendors={vendors}
        entry={editingEntry}
      />

      <Dialog open={!!entryToDelete} onOpenChange={(o) => !o && setEntryToDelete(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-8 text-center bg-card border-0 shadow-2xl [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-100/50">
              <Trash2 className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
              ยืนยันลบรายการนี้?
            </DialogTitle>
            <p className="text-muted-foreground text-sm leading-relaxed px-4">
              ราคาของ <span className="font-bold text-foreground">{entryToDelete?.product?.name}</span> จากผู้จำหน่าย{" "}
              <span className="font-bold text-foreground">
                {entryToDelete?.vendor?.business_name || entryToDelete?.vendor?.contact_person_name}
              </span>{" "}
              จะถูกลบถาวร
            </p>
            <div className="flex justify-center gap-3 w-full mt-6 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                onClick={() => setEntryToDelete(null)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-800 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                onClick={confirmDelete}
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PriceListsPage() {
  return (
    <RoleRouteGuard permission="view_price_lists">
      <PriceListsPageContent />
    </RoleRouteGuard>
  );
}
