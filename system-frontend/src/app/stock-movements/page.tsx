"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Search,
  History,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCcw,
  FileSpreadsheet,
} from "lucide-react";
// 💡 นำเข้า apiFetch พระเอกของเรามาใช้งาน
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth-storage";
import { toast } from "sonner";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";

function MovementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParam = searchParams.get("search") || "";
  const typeParam = searchParams.get("type") || "all";
  const dateFromParam = searchParams.get("date_from") || "";
  const dateToParam = searchParams.get("date_to") || "";
  const page = searchParams.get("page") || "1";

  const [searchInput, setSearchInput] = useState(searchParam);
  const [filterType, setFilterType] = useState(typeParam);
  const [dateFrom, setDateFrom] = useState(dateFromParam);
  const [dateTo, setDateTo] = useState(dateToParam);
  const [movements, setMovements] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const buildQuery = (overrides: Record<string, string> = {}) => {
    const params = {
      search: searchInput,
      type: filterType,
      date_from: dateFrom,
      date_to: dateTo,
      page: "1",
      ...overrides,
    };
    return `search=${encodeURIComponent(params.search)}&type=${params.type}&date_from=${params.date_from}&date_to=${params.date_to}&page=${params.page}`;
  };

  // 💡 เปลี่ยนมาใช้ apiFetch แทนการเขียน fetch สดๆ เพื่อให้ระบบ Token สมบูรณ์ 100%
  const fetchMovements = async () => {
    setLoading(true);
    try {
      const fetchUrl = `/stock-movements?search=${encodeURIComponent(searchParam)}&type=${typeParam}&date_from=${dateFromParam}&date_to=${dateToParam}&page=${page}`;
      const response = await apiFetch(fetchUrl);

      if (response) {
        setMovements(response.data || []);
        setMeta(response || {});
      }
    } catch (error) {
      console.error("Error fetching movements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [searchParam, typeParam, dateFromParam, dateToParam, page]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      router.push(`?${buildQuery()}`);
    }
  };

  const handleTypeChange = (newType: string) => {
    setFilterType(newType);
    router.push(`?${buildQuery({ type: newType })}`);
  };

  const handleDateFromChange = (v: string) => {
    setDateFrom(v);
    router.push(`?${buildQuery({ date_from: v })}`);
  };

  const handleDateToChange = (v: string) => {
    setDateTo(v);
    router.push(`?${buildQuery({ date_to: v })}`);
  };

  const handleExport = async () => {
    const toastId = toast.loading("กำลังเตรียมไฟล์ Excel...");
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/stock-movements/export?search=${encodeURIComponent(searchParam)}&type=${typeParam}&date_from=${dateFromParam}&date_to=${dateToParam}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_movements_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("สำเร็จ! กรุณาตรวจสอบไฟล์ที่ดาวน์โหลด", { id: toastId });
    } catch (error) {
      toast.error("ส่งออกไฟล์ไม่สำเร็จ", { id: toastId });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderTypeBadge = (type: string) => {
    switch (type) {
      case "in":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none gap-1">
            <ArrowDownRight className="w-3 h-3" /> รับเข้า
          </Badge>
        );
      case "out":
        return (
          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-none gap-1">
            <ArrowUpRight className="w-3 h-3" /> เบิกออก
          </Badge>
        );
      case "adjust":
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none gap-1">
            <RefreshCcw className="w-3 h-3" /> ปรับยอด
          </Badge>
        );
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              ประวัติคลังสินค้า (Movement History)
            </h1>
            <p className="text-muted-foreground  text-[11px] mt-0.5">
              ตรวจสอบประวัติการรับเข้า เบิกออก และปรับปรุงยอดสต็อก
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="h-10 px-5 py-2 rounded-full border border-border text-foreground bg-background hover:bg-muted hover:border-border text-sm font-medium shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-102 transition-transform"
        >
          <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel
        </button>
      </div>

      <div className="bg-card p-4 rounded-t-xl border border-border border-b-0 flex flex-wrap items-center gap-4 print:hidden">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา เลขที่, ชื่อสินค้า, SKU..."
            className="pl-10 h-10 w-150 rounded-lg bg-muted/50 dark:bg-slate-900 border-border dark:border-slate-800"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>

        <div className="w-[200px]">
          <AppSelect
            value={filterType}
            onValueChange={handleTypeChange}
            options={[
              { value: "all", label: "แสดงทุกประเภท" },
              { value: "in", label: "เฉพาะรับเข้า (In)" },
              { value: "out", label: "เฉพาะเบิกออก (Out)" },
              { value: "adjust", label: "เฉพาะปรับปรุงยอด (Adjust)" },
            ]}
          />
        </div>

        <div className="w-[160px]">
          <AppDatePicker value={dateFrom} onChange={handleDateFromChange} />
        </div>
        <div className="w-[160px]">
          <AppDatePicker value={dateTo} onChange={handleDateToChange} />
        </div>
      </div>

      <div className="border border-border rounded-b-xl bg-card overflow-x-auto shadow-sm p-4">
        <Table className="whitespace-nowrap">
          <TableHeader className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
            <TableRow>
              <TableHead className="w-[150px]">วัน-เวลา</TableHead>
              <TableHead className="w-[200px]">เลขที่เอกสาร</TableHead>
              <TableHead>สินค้า (SKU)</TableHead>
              <TableHead className="text-center w-[120px]">ประเภท</TableHead>
              <TableHead className="text-right w-[100px]">จำนวน</TableHead>
              <TableHead className="w-[150px]">ผู้ดำเนินการ</TableHead>
              <TableHead>หมายเหตุ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <AppLoading text="กำลังโหลดประวัติ..." />
                </TableCell>
              </TableRow>
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-20 text-muted-foreground font-medium"
                >
                  ไม่พบประวัติการเคลื่อนไหว
                </TableCell>
              </TableRow>
            ) : (
              movements.map((item: any) => (
                <TableRow
                  key={item.id}
                  className="hover:bg-muted/30 border-border"
                >
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(item.created_at)}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {item.reference_number || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">
                        {item.product?.sku || "SKU Deleted"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                        {item.product?.name || "-"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {renderTypeBadge(item.type)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-black",
                      item.type === "in"
                        ? "text-emerald-600"
                        : item.type === "out"
                          ? "text-rose-600"
                          : "text-amber-600",
                    )}
                  >
                    {item.type === "in" ? "+" : item.type === "out" ? "-" : ""}
                    {item.quantity}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                        {item.user?.name?.substring(0, 2).toUpperCase() || "SY"}
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {item.user?.name || "ระบบ"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className="text-sm text-muted-foreground truncate max-w-[300px]"
                    title={item.note}
                  >
                    {item.note || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && meta.total > 0 && (
        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-muted-foreground font-medium">
            แสดง {(meta.current_page - 1) * meta.per_page + 1} ถึง{" "}
            {Math.min(meta.current_page * meta.per_page, meta.total)} จาก{" "}
            {meta.total} รายการ
          </div>
          {/* 🚀 ปรับแต่งปุ่มก่อนหน้าและถัดไป ให้สวยงามและมีลูกศร */}
          <div className="flex gap-3">
            {/* ปุ่มก่อนหน้า (Previous) */}
            <Button
              variant="outline"
              size="sm"
              asChild
              className={cn(
                "rounded-full px-5 font-bold transition-all h-10 border-border dark:border-slate-800 flex items-center gap-2",
                meta.current_page === 1
                  ? "pointer-events-none opacity-50 bg-muted/50 text-muted-foreground"
                  : "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-900/30 dark:hover:border-blue-800",
              )}
            >
              <Link
                href={`?page=${Math.max(1, meta.current_page - 1)}&search=${searchParam}&type=${typeParam}`}
              >
                {/* 🚀 ไอคอนลูกศรชี้ไปทางซ้าย */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-chevron-left w-4 h-4"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                ก่อนหน้า
              </Link>
            </Button>

            {/* ปุ่มถัดไป (Next) */}
            <Button
              variant="outline"
              size="sm"
              asChild
              className={cn(
                "rounded-full px-5 font-bold transition-all h-10 border-border dark:border-slate-800 flex items-center gap-2",
                meta.current_page === meta.last_page
                  ? "pointer-events-none opacity-50 bg-muted/50 text-muted-foreground"
                  : "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-900/30 dark:hover:border-blue-800",
              )}
            >
              <Link
                href={`?page=${Math.min(meta.last_page || 1, meta.current_page + 1)}&search=${searchParam}&type=${typeParam}`}
              >
                ถัดไป
                {/* 🚀 ไอคอนลูกศรชี้ไปทางขวา */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-chevron-right w-4 h-4"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MovementsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600" />
        </div>
      }
    >
      <MovementsContent />
    </Suspense>
  );
}
