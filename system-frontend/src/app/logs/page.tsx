"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { History, Search, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { AppPagination } from "@/components/ui/app-pagination";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

function LogsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParam = searchParams.get("search") || "";
  const methodParam = searchParams.get("method") || "all";
  const dateFromParam = searchParams.get("date_from") || "";
  const dateToParam = searchParams.get("date_to") || "";
  const page = searchParams.get("page") || "1";

  const [searchInput, setSearchInput] = useState(searchParam);
  const [filterMethod, setFilterMethod] = useState(methodParam);
  const [dateFrom, setDateFrom] = useState(dateFromParam);
  const [dateTo, setDateTo] = useState(dateToParam);
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const buildQuery = (overrides: Record<string, string> = {}) => {
    const params = {
      search: searchInput,
      method: filterMethod,
      date_from: dateFrom,
      date_to: dateTo,
      page: "1",
      ...overrides,
    };
    return `search=${encodeURIComponent(params.search)}&method=${params.method}&date_from=${params.date_from}&date_to=${params.date_to}&page=${params.page}`;
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const fetchUrl = `/logs?search=${encodeURIComponent(searchParam)}&method=${methodParam}&date_from=${dateFromParam}&date_to=${dateToParam}&page=${page}`;
      const response = await apiFetch(fetchUrl);
      if (response) {
        setLogs(response.data || []);
        setMeta(response || {});
      }
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, methodParam, dateFromParam, dateToParam, page]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      router.push(`?${buildQuery()}`);
    }
  };

  const handleMethodChange = (newMethod: string) => {
    setFilterMethod(newMethod);
    router.push(`?${buildQuery({ method: newMethod })}`);
  };

  const handleDateFromChange = (v: string) => {
    setDateFrom(v);
    router.push(`?${buildQuery({ date_from: v })}`);
  };

  const handleDateToChange = (v: string) => {
    setDateTo(v);
    router.push(`?${buildQuery({ date_to: v })}`);
  };

  const handlePageChange = (p: number) => {
    router.push(`?${buildQuery({ page: String(p) })}`);
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
      second: "2-digit",
    });
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              ประวัติการใช้งานระบบ (Activity Log)
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ตรวจสอบว่าใครทำอะไร เมื่อไหร่ และจาก IP ใด
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card p-4 rounded-t-xl border border-border border-b-0 flex flex-wrap items-center gap-4 print:hidden">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="ค้นหา ชื่อผู้ใช้, อีเมล, การกระทำ..."
            className="pl-10 h-10 w-150 rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>

        <div className="w-[180px]">
          <AppSelect
            value={filterMethod}
            onValueChange={handleMethodChange}
            options={[
              { value: "all", label: "ทุกประเภทการกระทำ" },
              { value: "POST", label: "สร้างใหม่ (POST)" },
              { value: "PUT", label: "แก้ไข (PUT)" },
              { value: "PATCH", label: "แก้ไข (PATCH)" },
              { value: "DELETE", label: "ลบ (DELETE)" },
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
          <TableHeader className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-[170px]">เวลา</TableHead>
              <TableHead className="w-[200px]">ผู้ใช้</TableHead>
              <TableHead>การกระทำ</TableHead>
              <TableHead className="w-[150px]">IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <AppLoading text="กำลังโหลดประวัติการใช้งาน..." />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-20 text-muted-foreground font-medium"
                >
                  ไม่พบประวัติการใช้งาน
                </TableCell>
              </TableRow>
            ) : (
              logs.map((item: any) => (
                <TableRow
                  key={item.id}
                  className="hover:bg-slate-50/80 transition-colors border-border"
                >
                  <TableCell className="text-slate-500 text-sm">
                    {formatDate(item.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                        {(item.user_name || "SY").substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {item.user_name || "ระบบ"}
                        </span>
                        <span className="text-xs text-slate-400 truncate">
                          {item.user_email || "-"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">
                        {item.action}
                      </span>
                      <span className="text-xs text-slate-500">
                        {item.method} /{item.path}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 font-mono">
                    {item.ip_address || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && (
        <AppPagination
          currentPage={meta.current_page || 1}
          lastPage={meta.last_page || 1}
          total={meta.total || 0}
          perPage={meta.per_page || 15}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600" />
        </div>
      }
    >
      <RoleRouteGuard permission="view_activity_log">
        <LogsContent />
      </RoleRouteGuard>
    </Suspense>
  );
}
