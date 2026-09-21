"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  Eye,
  Trash2,
  Loader2,
  Printer,
  PackageCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { AppSelect } from "@/components/ui/app-select";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { AppPagination } from "@/components/ui/app-pagination";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function PackingListListPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // 🆕 [2026-09-20] ใบเบิกสินค้าที่อนุมัติแล้วและรอจัดสินค้า (ยังไม่มีใบจัดสินค้า/ไม่ใช่ใบที่มีแต่บริการ) — แสดงปนในตารางเดียวกัน
  // สถานะ "รอจัดสินค้า" พร้อมปุ่ม "จัดสินค้า" ไปหน้าสร้างใบจัดสินค้า (ดู SaleDocumentController::packableMaterialIssues())
  const [packableIssues, setPackableIssues] = useState<any[]>([]);
  // ตัวกรองสถานะ — ค่าเริ่มต้น "ยังไม่อนุมัติ" = รอจัดสินค้า + รออนุมัติ
  const [statusFilter, setStatusFilter] = useState("unapproved");

  // 🔢 Pagination ฝั่ง client (backend endpoint นี้ยังไม่มี paginate() จริง — ดู .claude/docs/frontend-page-template.md ส่วน 5.1)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);

  const [approveTarget, setApproveTarget] = useState<number | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const userStr = getUserRaw();
    if (!userStr) {
      router.replace("/");
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
          ? p === "view_packing_list"
          : p?.name === "view_packing_list",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        setIsSuperAdmin(isPlatformAdmin || isSuper);
        setUserPermissions(perms);
        fetchCompany();
        fetchDocuments();
      } else {
        toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        router.replace("/");
      }
    } catch (e) {
      router.replace("/");
    }
  }, [router]);

  const canCreate =
    isSuperAdmin || userPermissions.includes("create_packing_list");
  const canEdit =
    isSuperAdmin || userPermissions.includes("edit_packing_list");
  const canDelete =
    isSuperAdmin || userPermissions.includes("delete_packing_list");
  const canApprove =
    isSuperAdmin || userPermissions.includes("approve_packing_list");

  const fetchCompany = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/company`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const compData = await res.json();
        setCompanySettings(
          Array.isArray(compData) ? compData[0] : compData.data || compData,
        );
      }
    } catch (e) {}
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const [res, packableRes] = await Promise.all([
        fetch(`${apiUrl}/sale-documents?type=packing_list`, { headers }),
        fetch(`${apiUrl}/sale-documents/packable-material-issues`, {
          headers,
        }).catch(() => null),
      ]);
      if (res.ok) setDocuments(await res.json());
      if (packableRes && packableRes.ok) {
        setPackableIssues((await packableRes.json()).data || []);
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
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
        `${apiUrl}/sale-documents/${approveTarget}/approve`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        toast.success("อนุมัติสำเร็จ", { id: toastId });
        setApproveTarget(null);
        fetchDocuments();
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
        `${apiUrl}/sale-documents/${cancelTarget}/cancel`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: cancelReason }),
        },
      );
      if (res.ok) {
        toast.success("ยกเลิกสำเร็จ", { id: toastId });
        setCancelTarget(null);
        setCancelReason("");
        fetchDocuments();
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

  const handlePrint = async (docId: number) => {
    setPrintingId(docId);
    const toastId = toast.loading("กำลังเตรียมเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const fullDoc = (await res.json()).data;
        const finance = {
          subtotal: Number(fullDoc.subtotal),
          discount: Number(fullDoc.discount_amount),
          after_discount:
            Number(fullDoc.subtotal) - Number(fullDoc.discount_amount),
          vat_amount: Number(fullDoc.vat_amount),
          wht_amount: Number(fullDoc.wht_amount),
          grand_total: Number(fullDoc.grand_total),
        };
        const { pdf } = await import("@react-pdf/renderer");
        const { default: SalesPdfTemplate } =
          await import("@/components/documents/SalesPdfTemplate");
        const { paperSize, letterLayout } = getPaperSizeConfig(
          companySettings,
          "packing_list",
        );
        const blob = await pdf(
          <SalesPdfTemplate
            data={{
              companySettings,
              formData: fullDoc,
              selectedContact: fullDoc.contact,
              items: fullDoc.items,
              finance,
              documentNumber: fullDoc.document_number,
              paperSize,
              letterLayout,
            }}
          />,
        ).toBlob();
        setPreviewUrl(URL.createObjectURL(blob));
        toast.dismiss(toastId);
      }
    } catch (error) {
      toast.error("สร้างเอกสารไม่สำเร็จ", { id: toastId });
    } finally {
      setPrintingId(null);
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
      const res = await fetch(`${apiUrl}/sale-documents/${docToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("ลบสำเร็จ", { id: toastId });
        fetchDocuments();
      } else {
        toast.error((await res.json()).message || "ไม่สามารถลบเอกสารได้", {
          id: toastId,
        });
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    }
  };

  const awaitingRows = packableIssues.map((mi) => ({
    ...mi,
    _kind: "material_issue",
    status: "AwaitingPacking",
  }));
  const statusMatches = (status: string) => {
    switch (statusFilter) {
      case "all":
        return true;
      case "unapproved":
        return status === "AwaitingPacking" || status === "Pending";
      default:
        return status === statusFilter;
    }
  };
  const filteredDocs = [...awaitingRows, ...documents].filter(
    (doc) =>
      statusMatches(doc.status) &&
      (doc.document_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.contact?.business_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())),
  );
  const lastPage = Math.ceil(filteredDocs.length / itemsPerPage) || 1;
  const paginatedDocs = filteredDocs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (!isAuthorized) return <AppLoading text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..." variant="bar" minHeight="min-h-screen" className="bg-muted/50" />;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              ใบจัดสินค้า (Packing List)
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              เลือก S/N จากใบเบิกสินค้าที่อนุมัติแล้ว — ไว้ตัดออกจริงตอนอนุมัติใบกำกับภาษี/ใบส่งสินค้า
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Link href="/sales/packing-lists/create">
              <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
                <Plus className="w-4 h-4" /> สร้างใบจัดสินค้า
              </button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-muted/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่เอกสาร หรือ ชื่อลูกค้า..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 rounded-xl h-10 border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-colors"
            />
          </div>
          <div className="w-full sm:w-64">
            <AppSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "unapproved", label: "ยังไม่อนุมัติ (รอจัด + รออนุมัติ)" },
                { value: "all", label: "ทุกสถานะ" },
                { value: "AwaitingPacking", label: "รอจัดสินค้า" },
                { value: "Pending", label: "รออนุมัติ" },
                { value: "Approved", label: "อนุมัติแล้ว" },
                { value: "Cancelled", label: "ยกเลิก" },
              ]}
            />
          </div>
        </div>

        <div className="overflow-x-auto hide-scrollbar flex-1 min-h-[400px]">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold">วันที่ออก</th>
                <th className="px-6 py-4 font-bold">เลขที่เอกสาร</th>
                <th className="px-6 py-4 font-bold">โครงการ</th>
                <th className="px-6 py-4 font-bold">ลูกค้า</th>
                <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                <th className="px-6 py-4 font-bold text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <AppLoading minHeight="min-h-[400px]" />
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">
                      ไม่พบข้อมูลใบจัดสินค้า
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc) => (
                  <tr
                    key={`${doc._kind || "pl"}-${doc.id}`}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-muted-foreground">
                      {dayjs(doc.issue_date || doc.created_at).format(
                        "DD/MM/YYYY",
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {doc.document_number}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {doc.project?.name ||
                        (doc.project_id ? `#${doc.project_id}` : "-")}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground truncate max-w-[200px]">
                      {doc.contact?.business_name || doc.contact?.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold border",
                          doc.status === "AwaitingPacking"
                            ? "bg-blue-50 text-blue-600 border-blue-200"
                            : doc.status === "Pending"
                              ? "bg-amber-50 text-amber-600 border-amber-200"
                              : doc.status === "Approved"
                                ? "bg-green-50 text-green-600 border-green-200"
                                : doc.status === "Cancelled"
                                  ? "bg-red-50 text-red-600 border-red-200"
                                  : "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {doc.status === "AwaitingPacking"
                          ? "รอจัดสินค้า"
                          : doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {doc._kind === "material_issue" ? (
                        <div className="flex items-center justify-center gap-1">
                          {canCreate && (
                            <AppTooltip label="จัดสินค้า">
                              <Link
                                href={`/sales/packing-lists/create?project_id=${doc.project_id}&material_issue_id=${doc.id}`}
                              >
                                <button className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer">
                                  <PackageCheck className="w-4 h-4" />
                                </button>
                              </Link>
                            </AppTooltip>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <AppTooltip label="พิมพ์/พรีวิว">
                            <button
                              onClick={() => handlePrint(doc.id)}
                              disabled={printingId === doc.id}
                              className="p-2 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {printingId === doc.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Printer className="w-4 h-4" />
                              )}
                            </button>
                          </AppTooltip>
                          {canEdit && (
                            <AppTooltip label="ดูรายละเอียด">
                              <Link
                                href={`/sales/packing-lists/${doc.id}/edit`}
                              >
                                <button className="p-2 text-muted-foreground hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer">
                                  <Eye className="w-4 h-4" />
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
                          {canDelete && doc.status === "Pending" && (
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
                      )}
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
        total={filteredDocs.length}
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
        title="อนุมัติใบจัดสินค้า?"
        description="เอกสารนี้ไม่กระทบสต๊อก/การจองใดๆ (ใบเบิกสินค้าจองไว้แล้ว) แค่ยืนยันว่า S/N ที่เลือกไว้พร้อมใช้อ้างอิงตอนอนุมัติใบกำกับภาษี/ใบส่งสินค้า ยืนยันการอนุมัติใช่หรือไม่?"
        confirmLabel={isApproving ? "กำลังดำเนินการ..." : "อนุมัติเอกสาร"}
        confirmColorClass="bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
        onConfirm={executeApprove}
        loading={isApproving}
      />

      <AppConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(v) => {
          if (!v) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
        icon={XCircle}
        iconColorClass="bg-orange-50 text-orange-600 border-orange-100/50"
        title="ยกเลิกใบจัดสินค้า?"
        description="ยกเลิกแล้วใบเบิกสินค้าต้นทางจะกลับมาสร้างใบจัดสินค้าใหม่ได้อีกครั้ง ยืนยันการยกเลิกใช่หรือไม่?"
        confirmLabel={isCancelling ? "กำลังดำเนินการ..." : "ยืนยันยกเลิก"}
        confirmColorClass="bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
        onConfirm={executeCancel}
        loading={isCancelling}
      >
        <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          เหตุผลในการยกเลิก
        </label>
        <input
          type="text"
          placeholder="เช่น เลือก S/N ผิด"
          className="w-full h-11 px-4 border border-border rounded-xl outline-none focus:border-orange-500 text-sm bg-muted/50 focus:bg-background transition-all"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </AppConfirmDialog>

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> เอกสาร PDF
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
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
