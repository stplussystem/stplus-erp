"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  HardHat,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Printer,
  FileText,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { Button } from "@/components/ui/button";
import { AppLoading } from "@/components/ui/app-loading";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { AppPagination } from "@/components/ui/app-pagination";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function ContractorWorkOrderListPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 🔢 Pagination ฝั่ง client (backend endpoint นี้ยังไม่มี paginate() จริง — ดู .claude/docs/frontend-page-template.md ส่วน 5.1)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<number | null>(null);
  const [approveTarget, setApproveTarget] = useState<number | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);

  useEffect(() => {
    const userStr = getUserRaw();
    if (!userStr) {
      router.push("/");
      return;
    }
    try {
      const parsedData = JSON.parse(userStr);
      const actualUser = parsedData?.user || parsedData;
      const isPlatformAdmin =
        actualUser?.is_platform_admin === 1 ||
        actualUser?.is_platform_admin === true;
      const roles = Array.isArray(actualUser?.roles) ? actualUser.roles : [];
      const perms = Array.isArray(actualUser?.permissions)
        ? actualUser.permissions
        : [];
      const isSuper = roles.some((role: any) =>
        typeof role === "string"
          ? role.includes("Super Admin")
          : role?.name?.includes("Super Admin"),
      );
      const hasPermission = perms.some((p: any) =>
        typeof p === "string"
          ? p === "view_contractor_work_orders"
          : p?.name === "view_contractor_work_orders",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        setIsSuperAdmin(isPlatformAdmin || isSuper);
        setUserPermissions(perms);
        fetchOrders();
      } else {
        toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        router.push("/");
      }
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  const canCreate =
    isSuperAdmin || userPermissions.includes("create_contractor_work_orders");
  const canEdit =
    isSuperAdmin || userPermissions.includes("edit_contractor_work_orders");
  const canDelete =
    isSuperAdmin || userPermissions.includes("delete_contractor_work_orders");
  const canApprove =
    isSuperAdmin || userPermissions.includes("approve_contractor_work_orders");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/contractor-work-orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) setOrders(await res.json());
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (id: number) => {
    setPrintingId(id);
    const toastId = toast.loading("กำลังเตรียมเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const [orderRes, compRes] = await Promise.all([
        fetch(`${apiUrl}/contractor-work-orders/${id}`, { headers }),
        fetch(`${apiUrl}/company`, { headers }),
      ]);
      if (!orderRes.ok) throw new Error("API Error");

      const orderData = await orderRes.json();
      const order = orderData.data || orderData;
      const compData = await compRes.json();
      const companySettings = Array.isArray(compData)
        ? compData[0]
        : compData.data || compData;

      const items = order.items || [];
      const subtotal = Number(order.subtotal || 0);
      const discount = Number(order.discount_amount || 0);
      const afterDiscount = Math.max(0, subtotal - discount);
      const whtAmount = Number(order.wht_amount || 0);
      const grandTotal = Number(order.grand_total || 0);

      const finance = {
        subtotal,
        discount,
        afterDiscount,
        whtAmount,
        grandTotal,
      };

      const formData = {
        site_reference: order.site_reference,
        order_date: order.order_date,
        note: order.note,
        wht_rate: order.wht_rate,
        show_footer_note: order.show_footer_note,
      };

      const { pdf } = await import("@react-pdf/renderer");
      const { default: ContractorWorkOrderPdfTemplate } =
        await import("@/components/documents/ContractorWorkOrderPdfTemplate");

      const pdfDataObj = {
        companySettings,
        formData,
        selectedContact: order.contact,
        items,
        finance,
        orderNumber: order.order_number,
        ...getPaperSizeConfig(companySettings, "contractor_work_order"),
      };
      const blob = await pdf(
        <ContractorWorkOrderPdfTemplate data={pdfDataObj} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      toast.dismiss(toastId);
      setPreviewUrl(url);
    } catch (error) {
      toast.error("สร้าง PDF ไม่สำเร็จ", { id: toastId });
    } finally {
      setPrintingId(null);
    }
  };

  const executeApprove = async () => {
    if (!approveTarget) return;
    setIsApproving(true);
    const toastId = toast.loading("กำลังดำเนินการ...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(
        `${apiUrl}/contractor-work-orders/${approveTarget}/approve`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        toast.success("อนุมัติสำเร็จ", { id: toastId });
        setApproveTarget(null);
        fetchOrders();
      } else {
        toast.error((await res.json()).message || "ไม่สามารถดำเนินการได้", {
          id: toastId,
        });
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setIsApproving(false);
    }
  };

  const executeCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    const toastId = toast.loading("กำลังดำเนินการ...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(
        `${apiUrl}/contractor-work-orders/${cancelTarget}/cancel`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        toast.success("ยกเลิกสำเร็จ", { id: toastId });
        setCancelTarget(null);
        fetchOrders();
      } else {
        toast.error((await res.json()).message || "ไม่สามารถดำเนินการได้", {
          id: toastId,
        });
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setIsCancelling(false);
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    setDeleteDialogOpen(false);
    const toastId = toast.loading("กำลังลบเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(
        `${apiUrl}/contractor-work-orders/${docToDelete}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        toast.success("ลบสำเร็จ", { id: toastId });
        fetchOrders();
      } else {
        toast.error((await res.json()).message || "ไม่สามารถลบเอกสารได้", {
          id: toastId,
        });
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    }
  };

  const filteredOrders = orders.filter(
    (doc) =>
      doc.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.contact?.business_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );
  const lastPage = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (!isAuthorized) return <div className="min-h-screen bg-muted/50"></div>;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              ใบสั่งซื้อ/จ้างผู้รับเหมา
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              จัดการเอกสารว่าจ้างช่าง/ผู้รับเหมารายตัว
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Link href="/contractor-work-orders/create">
              <Button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
                <Plus className="w-4 h-4" /> สร้างใบสั่งจ้าง
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่เอกสาร หรือ ชื่อผู้รับเหมา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 rounded-xl h-10 border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto hide-scrollbar flex-1 min-h-[400px]">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold">วันที่ออก</th>
                <th className="px-6 py-4 font-bold">เลขที่เอกสาร</th>
                <th className="px-6 py-4 font-bold">ผู้รับเหมา</th>
                <th className="px-6 py-4 font-bold text-right">ยอดสุทธิ</th>
                <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                <th className="px-6 py-4 font-bold text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <AppLoading minHeight="min-h-0" />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <HardHat className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">
                      ไม่พบข้อมูลใบสั่งจ้าง
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-muted-foreground">
                      {dayjs(doc.order_date || doc.created_at).format(
                        "DD/MM/YYYY",
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {doc.order_number}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground truncate max-w-[200px]">
                      {doc.contact?.business_name || doc.contact?.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600">
                      {Number(doc.grand_total).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold border",
                          doc.status === "Pending"
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : doc.status === "Approved"
                              ? "bg-green-50 text-green-600 border-green-200"
                              : doc.status === "Cancelled"
                                ? "bg-red-50 text-red-600 border-red-200"
                                : "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <AppTooltip label="พิมพ์/พรีวิว">
                          <button
                            onClick={() => handlePrint(doc.id)}
                            disabled={printingId === doc.id}
                            className="p-2 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </AppTooltip>
                        {canEdit && doc.status !== "Cancelled" && (
                          <AppTooltip label="แก้ไข">
                            <Link
                              href={`/contractor-work-orders/${doc.id}/edit`}
                            >
                              <button className="p-2 text-muted-foreground hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer">
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </Link>
                          </AppTooltip>
                        )}
                        {canApprove && doc.status === "Pending" && (
                          <AppTooltip label="อนุมัติเอกสาร">
                            <button
                              onClick={() => setApproveTarget(doc.id)}
                              className="p-2 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          </AppTooltip>
                        )}
                        {canEdit && doc.status !== "Cancelled" && (
                          <AppTooltip label="ยกเลิกเอกสาร">
                            <button
                              onClick={() => setCancelTarget(doc.id)}
                              className="p-2 text-muted-foreground hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </AppTooltip>
                        )}
                        {canDelete &&
                          (doc.status === "Pending" ||
                            doc.status === "Cancelled") && (
                            <AppTooltip label="ลบถาวร">
                              <button
                                onClick={() => {
                                  setDocToDelete(doc.id);
                                  setDeleteDialogOpen(true);
                                }}
                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </AppTooltip>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AppPagination
        currentPage={currentPage}
        lastPage={lastPage}
        total={filteredOrders.length}
        perPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-8 text-center bg-card border-0 shadow-2xl [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-100/50">
              <Trash2 className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
              ยืนยันการลบ?
            </DialogTitle>
            <p className="text-muted-foreground text-sm leading-relaxed px-4">
              ลบแล้วจะไม่สามารถกู้คืนได้
            </p>
            <div className="flex justify-center gap-3 w-full mt-6 pt-2">
              <button
                className="flex-1 h-12 rounded-xl border border-border hover:bg-muted/50 text-muted-foreground font-bold cursor-pointer transition-all"
                onClick={() => setDeleteDialogOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 font-bold cursor-pointer transition-all"
                onClick={confirmDelete}
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AppConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(v) => !v && setApproveTarget(null)}
        icon={CheckCircle2}
        iconColorClass="bg-blue-50 text-blue-600 border-blue-100/50"
        title="อนุมัติใบสั่งจ้าง?"
        description="ยืนยันการอนุมัติใบสั่งจ้างฉบับนี้ใช่หรือไม่?"
        confirmLabel={isApproving ? "กำลังดำเนินการ..." : "อนุมัติเอกสาร"}
        confirmColorClass="bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
        onConfirm={executeApprove}
        loading={isApproving}
      />

      <AppConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        icon={XCircle}
        iconColorClass="bg-orange-50 text-orange-600 border-orange-100/50"
        title="ยกเลิกใบสั่งจ้าง?"
        description="ยืนยันการยกเลิกใบสั่งจ้างนี้ใช่หรือไม่?"
        confirmLabel={isCancelling ? "กำลังดำเนินการ..." : "ยืนยันยกเลิก"}
        confirmColorClass="bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
        onConfirm={executeCancel}
        loading={isCancelling}
      />

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ตัวอย่างเอกสาร
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1 text-muted-foreground hover:text-red-500 bg-background rounded-full shadow-sm border border-border transition-all"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-muted p-2">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-xl border border-border"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
