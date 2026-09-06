"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileLock2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Printer,
  XCircle,
  FileText,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { Button } from "@/components/ui/button";
import { AppLoading } from "@/components/ui/app-loading";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppPagination } from "@/components/ui/app-pagination";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

// 📋 ใบคุมสัญญาราชการ — ทะเบียนติดตามสัญญา+หลักประกัน ไม่มี workflow อนุมัติ (แก้ไข/ลบตรงๆ)
export default function GovernmentContractListPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);

  const [contracts, setContracts] = useState<any[]>([]);
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
          ? p === "view_government_contracts"
          : p?.name === "view_government_contracts",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        setIsSuperAdmin(isPlatformAdmin || isSuper);
        setUserPermissions(perms);
        fetchCompany();
        fetchContracts();
      } else {
        toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        router.push("/");
      }
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  const canCreate =
    isSuperAdmin || userPermissions.includes("create_government_contracts");
  const canEdit =
    isSuperAdmin || userPermissions.includes("edit_government_contracts");
  const canDelete =
    isSuperAdmin || userPermissions.includes("delete_government_contracts");

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

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/government-contracts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) setContracts(await res.json());
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    setDeleteDialogOpen(false);
    const toastId = toast.loading("กำลังลบข้อมูล...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/government-contracts/${docToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("ลบสำเร็จ", { id: toastId });
        fetchContracts();
      } else {
        toast.error((await res.json()).message || "ไม่สามารถลบข้อมูลได้", {
          id: toastId,
        });
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    }
  };

  // 🧾 พิมพ์ใบสำคัญรับเงิน — เปิดใช้เฉพาะสัญญาที่มี guarantee_returned_date แล้วเท่านั้น
  const handlePrintVoucher = async (contract: any) => {
    if (!contract.guarantee_returned_date) return;
    setPrintingId(contract.id);
    const toastId = toast.loading("กำลังเตรียมเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: ReceiptVoucherPdfTemplate } =
        await import("@/components/documents/ReceiptVoucherPdfTemplate");
      const blob = await pdf(
        <ReceiptVoucherPdfTemplate
          data={{
            companySettings,
            contract,
            ...getPaperSizeConfig(companySettings, "receipt_voucher"),
          }}
        />,
      ).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (error) {
      toast.error("สร้างเอกสารไม่สำเร็จ", { id: toastId });
    } finally {
      setPrintingId(null);
    }
  };

  const filteredContracts = contracts.filter(
    (doc) =>
      doc.agency_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.contract_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.project?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const lastPage = Math.ceil(filteredContracts.length / itemsPerPage) || 1;
  const paginatedContracts = filteredContracts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const fmtDate = (d?: string | null) =>
    d ? dayjs(d).format("DD/MM/YYYY") : "-";
  const fmtMoney = (n?: number | string | null) =>
    n === null || n === undefined || n === ""
      ? "-"
      : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  if (!isAuthorized) return <div className="min-h-screen bg-muted/50"></div>;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <FileLock2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              ใบคุมสัญญาราชการ
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ทะเบียนติดตามสัญญาราชการและหลักประกันสัญญา
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Link href="/government-contracts/create">
              <Button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
                <Plus className="w-4 h-4" /> เพิ่มสัญญา
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
              placeholder="ค้นหาหน่วยงาน, เลขที่สัญญา หรือ โครงการ..."
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
                <th className="px-6 py-4 font-bold">หน่วยงาน / โครงการ</th>
                <th className="px-6 py-4 font-bold">
                  เลขที่สัญญา / วันที่ทำสัญญา
                </th>
                <th className="px-6 py-4 font-bold text-right">
                  จำนวนเงินตามสัญญา
                </th>
                <th className="px-6 py-4 font-bold">หลักประกันสัญญา</th>
                <th className="px-6 py-4 font-bold">วันครบสัญญา</th>
                <th className="px-6 py-4 font-bold">
                  วันที่ยื่นขอคืน / ได้คืนหลักประกัน
                </th>
                <th className="px-6 py-4 font-bold text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <AppLoading minHeight="min-h-0" />
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <FileLock2 className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">
                      ไม่พบข้อมูลสัญญาราชการ
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedContracts.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-muted/50 transition-colors align-top"
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold text-foreground">
                        {doc.agency_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.project?.name || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">
                        {doc.contract_number}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {fmtDate(doc.contract_date)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600">
                      {fmtMoney(doc.contract_amount)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-foreground">
                        {doc.guarantee_number || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {fmtMoney(doc.guarantee_amount)} บาท · ค้ำประกันถึง{" "}
                        {fmtDate(doc.guarantee_date)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {doc.contract_due_date || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-muted-foreground">
                        ยื่นขอคืน:{" "}
                        {fmtDate(doc.guarantee_return_requested_date)}
                      </p>
                      <p className="text-xs mt-1">
                        {doc.guarantee_returned_date ? (
                          <span className="text-green-600 font-bold">
                            ได้คืนแล้ว {fmtDate(doc.guarantee_returned_date)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">ยังไม่ได้คืน</span>
                        )}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <AppTooltip
                          label={
                            doc.guarantee_returned_date
                              ? "พิมพ์ใบสำคัญรับเงิน"
                              : "พิมพ์ใบสำคัญรับเงิน (ต้องระบุวันที่ได้คืนหลักประกันก่อน)"
                          }
                        >
                          <button
                            onClick={() => handlePrintVoucher(doc)}
                            disabled={
                              !doc.guarantee_returned_date ||
                              printingId === doc.id
                            }
                            className="p-2 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            {printingId === doc.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Printer className="w-4 h-4" />
                            )}
                          </button>
                        </AppTooltip>
                        {canEdit && (
                          <AppTooltip label="แก้ไข">
                            <Link href={`/government-contracts/${doc.id}/edit`}>
                              <button className="p-2 text-muted-foreground hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer">
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </Link>
                          </AppTooltip>
                        )}
                        {canDelete && (
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
        total={filteredContracts.length}
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

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ใบสำคัญรับเงิน
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
