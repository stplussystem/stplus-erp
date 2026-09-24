"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History, ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { AppPagination } from "@/components/ui/app-pagination";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "sonner";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

interface ImportBatch {
  id: number;
  type: "master" | "adjust" | "price_list";
  file_name: string | null;
  affected_count: number;
  status: "completed" | "partially_undone" | "undone";
  created_at: string;
  user?: { id: number; name: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  master: "นำเข้าสินค้าใหม่",
  adjust: "ปรับปรุงสต๊อก/S/N",
  price_list: "Price List",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-50 text-green-700 border-green-200",
  partially_undone: "bg-amber-50 text-amber-700 border-amber-200",
  undone: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "นำเข้าสำเร็จ",
  partially_undone: "ยกเลิกไปแล้วบางส่วน",
  undone: "ยกเลิกแล้ว",
};

function formatDate(dateString: string) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ImportHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") || "all";
  const statusParam = searchParams.get("status") || "all";
  const dateFromParam = searchParams.get("date_from") || "";
  const dateToParam = searchParams.get("date_to") || "";
  const page = searchParams.get("page") || "1";

  const canImportPRO = usePermission("manage_products");
  const canStockAdjustment = usePermission("stock_adjustment");

  const [filterType, setFilterType] = useState(typeParam);
  const [filterStatus, setFilterStatus] = useState(statusParam);
  const [dateFrom, setDateFrom] = useState(dateFromParam);
  const [dateTo, setDateTo] = useState(dateToParam);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [undoTarget, setUndoTarget] = useState<ImportBatch | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const buildQuery = (overrides: Record<string, string> = {}) => {
    const params = {
      type: filterType,
      status: filterStatus,
      date_from: dateFrom,
      date_to: dateTo,
      page: "1",
      ...overrides,
    };
    return `type=${params.type}&status=${params.status}&date_from=${params.date_from}&date_to=${params.date_to}&page=${params.page}`;
  };

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (typeParam !== "all") q.set("type", typeParam);
      if (statusParam !== "all") q.set("status", statusParam);
      if (dateFromParam) q.set("date_from", dateFromParam);
      if (dateToParam) q.set("date_to", dateToParam);
      q.set("page", page);
      const response = await apiFetch(`/products/excel/import-batches?${q.toString()}`);
      if (response) {
        setBatches(response.data || []);
        setMeta(response || {});
      }
    } catch (error) {
      toast.error("โหลดประวัติการนำเข้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeParam, statusParam, dateFromParam, dateToParam, page]);

  const handleTypeChange = (v: string) => {
    setFilterType(v);
    router.push(`?${buildQuery({ type: v })}`);
  };
  const handleStatusChange = (v: string) => {
    setFilterStatus(v);
    router.push(`?${buildQuery({ status: v })}`);
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

  const canUndo = (batch: ImportBatch) =>
    batch.status !== "undone" &&
    (batch.type === "adjust" ? canStockAdjustment : canImportPRO);

  const confirmUndo = async () => {
    if (!undoTarget) return;
    setIsUndoing(true);
    const tId = toast.loading("กำลังยกเลิกการนำเข้า...");
    try {
      const res = await apiFetch(
        `/products/excel/import-batches/${undoTarget.id}/undo`,
        { method: "POST" },
      );
      toast.success(res?.message || "ยกเลิกการนำเข้าสำเร็จ", { id: tId, duration: 8000 });
      setUndoTarget(null);
      fetchBatches();
      window.dispatchEvent(new Event("refreshProducts"));
      window.dispatchEvent(new Event("refreshLastImportBatch"));
    } catch (error: any) {
      // ข้อความปฏิเสธ (มีสินค้าถูกใช้งานแล้ว) ยาว — ให้ค้างนานพอที่จะอ่านครบ
      toast.error(error.message || "ยกเลิกการนำเข้าไม่สำเร็จ", { id: tId, duration: 15000 });
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">ประวัติการนำเข้าข้อมูล</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ดูและยกเลิกการนำเข้า Excel ทุกครั้ง (ไม่จำกัดแค่ครั้งล่าสุด)
            </p>
          </div>
        </div>
        <Link
          href="/products"
          className="flex items-center gap-2 px-4 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> กลับหน้าสินค้า
        </Link>
      </div>

      <div className="bg-card p-4 rounded-t-xl border border-border border-b-0 flex flex-wrap items-center gap-4 print:hidden">
        <div className="w-[200px]">
          <AppSelect
            value={filterType}
            onValueChange={handleTypeChange}
            options={[
              { value: "all", label: "ทุกประเภท" },
              { value: "master", label: "นำเข้าสินค้าใหม่" },
              { value: "adjust", label: "ปรับปรุงสต๊อก/S/N" },
              { value: "price_list", label: "Price List" },
            ]}
          />
        </div>
        <div className="w-[200px]">
          <AppSelect
            value={filterStatus}
            onValueChange={handleStatusChange}
            options={[
              { value: "all", label: "ทุกสถานะ" },
              { value: "completed", label: "นำเข้าสำเร็จ" },
              { value: "partially_undone", label: "ยกเลิกไปแล้วบางส่วน" },
              { value: "undone", label: "ยกเลิกแล้ว" },
            ]}
          />
        </div>
        <div className="w-[160px]">
          <AppDatePicker value={dateFrom} onChange={handleDateFromChange} placeholder="ตั้งแต่วันที่" />
        </div>
        <div className="w-[160px]">
          <AppDatePicker value={dateTo} onChange={handleDateToChange} placeholder="ถึงวันที่" />
        </div>
      </div>

      <div className="border border-border rounded-b-xl bg-card overflow-x-auto shadow-sm p-4">
        <Table className="whitespace-nowrap">
          <TableHeader className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
            <TableRow>
              <TableHead className="w-[170px]">วันที่นำเข้า</TableHead>
              <TableHead className="w-[160px]">ประเภท</TableHead>
              <TableHead>ไฟล์</TableHead>
              <TableHead className="w-[110px] text-right">จำนวนรายการ</TableHead>
              <TableHead className="w-[160px]">ผู้นำเข้า</TableHead>
              <TableHead className="w-[150px]">สถานะ</TableHead>
              <TableHead className="w-[90px] text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <AppLoading text="กำลังโหลดประวัติการนำเข้า..." />
                </TableCell>
              </TableRow>
            ) : batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-20 text-muted-foreground font-medium">
                  ไม่พบประวัติการนำเข้า
                </TableCell>
              </TableRow>
            ) : (
              batches.map((batch) => (
                <TableRow key={batch.id} className="hover:bg-muted/50 transition-colors border-border">
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(batch.created_at)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {TYPE_LABEL[batch.type] || batch.type}
                  </TableCell>
                  <TableCell className="text-sm text-foreground truncate max-w-[260px]">
                    {batch.file_name || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-right font-bold">
                    {batch.affected_count}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {batch.user?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_BADGE[batch.status]}`}
                    >
                      {STATUS_LABEL[batch.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {canUndo(batch) ? (
                      <AppTooltip label="ยกเลิกการนำเข้านี้">
                        <button
                          onClick={() => setUndoTarget(batch)}
                          className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AppTooltip>
                    ) : (
                      "-"
                    )}
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
          perPage={meta.per_page || 20}
          onPageChange={handlePageChange}
        />
      )}

      <AppConfirmDialog
        open={undoTarget !== null}
        onOpenChange={(v) => !v && setUndoTarget(null)}
        icon={Trash2}
        iconColorClass="bg-red-50 text-red-500 border-red-100/50"
        title="ยืนยันยกเลิกการนำเข้านี้?"
        description={
          undoTarget?.type === "master" ? (
            <>
              ระบบจะลบสินค้าที่เพิ่งถูกสร้างใหม่จากไฟล์{" "}
              <span className="font-bold text-foreground">{undoTarget?.file_name}</span>{" "}
              พร้อมยกเลิกใบรับสินค้าอัตโนมัติและคืนสต๊อก/ล็อตต้นทุนให้ครบ — ถ้ามีสินค้าใดถูกใช้งานในเอกสารอื่นหรือขายไปแล้ว
              ระบบจะ <b>ปฏิเสธการยกเลิกทั้งหมด</b> (ไม่ย้อนบางส่วน) ต้องยกเลิกเอกสารที่ใช้สินค้านั้นก่อน — เมื่อยกเลิกแล้วจะไม่สามารถกู้คืนได้
            </>
          ) : (
            <>
              ระบบจะคืนค่าจำนวนสต็อก/สถานะ S/N ที่ปรับจากไฟล์{" "}
              <span className="font-bold text-foreground">{undoTarget?.file_name}</span>{" "}
              กลับไปเป็นค่าก่อนนำเข้า — เมื่อยกเลิกแล้วจะไม่สามารถกู้คืนได้
            </>
          )
        }
        confirmLabel={isUndoing ? "กำลังดำเนินการ..." : "ยืนยันการยกเลิก"}
        confirmColorClass="bg-red-600 hover:bg-red-700 shadow-red-600/20"
        onConfirm={confirmUndo}
        loading={isUndoing}
      />
    </div>
  );
}

export default function ImportHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600" />
        </div>
      }
    >
      <RoleRouteGuard permission="view_products">
        <ImportHistoryContent />
      </RoleRouteGuard>
    </Suspense>
  );
}
