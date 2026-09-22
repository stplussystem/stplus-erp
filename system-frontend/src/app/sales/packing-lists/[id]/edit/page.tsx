"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  PackageCheck,
  ArrowLeft,
  Loader2,
  FileText,
  XCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { SaleDocumentItemsTable } from "@/components/sales/SaleDocumentItemsTable";
import { ItemSerialsDialog } from "@/components/sales/ItemSerialsDialog";
import { useSaleDocumentItems } from "@/hooks/useSaleDocumentItems";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function PackingListViewPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [fetching, setFetching] = useState(true);
  // 👁️ แถวสินค้าที่กำลังเปิดดูรายการ S/N (index ใน items) — null = ปิด
  const [serialViewIndex, setSerialViewIndex] = useState<number | null>(null);

  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [warehouseName, setWarehouseName] = useState<string>("-");
  const [projectName, setProjectName] = useState<string>("-");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    document_number: "",
    document_type: "packing_list",
    status: "Pending",
    issue_date: dayjs().format("YYYY-MM-DD"),
    note: "",
  });

  const { items, loadFromDocument } = useSaleDocumentItems();

  const [approveOpen, setApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
          ? p === "edit_packing_list"
          : p?.name === "edit_packing_list",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        setIsSuperAdmin(isPlatformAdmin || isSuper);
        setUserPermissions(
          perms.map((p: any) => (typeof p === "string" ? p : p?.name)),
        );
        fetchCompany();
        fetchDocumentData();
      } else {
        toast.error("คุณไม่มีสิทธิ์ดูเอกสารนี้");
        router.replace("/sales/packing-lists");
      }
    } catch (e) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, documentId]);

  const canApprove =
    isSuperAdmin || userPermissions.includes("approve_packing_list");
  const canDelete =
    isSuperAdmin || userPermissions.includes("delete_packing_list");

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

  const fetchDocumentData = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const doc = (await res.json()).data;
        setFormData({
          document_number: doc.document_number,
          document_type: doc.document_type,
          status: doc.status,
          issue_date: doc.issue_date
            ? dayjs(doc.issue_date).format("YYYY-MM-DD")
            : "",
          note: doc.note || "",
        });
        setSelectedContact(doc.contact || null);
        setWarehouseName(doc.warehouse?.name || "-");
        setProjectName(doc.project?.name || "-");
        loadFromDocument(doc.items || []);
      } else {
        toast.error("ไม่พบข้อมูลเอกสาร");
        router.replace("/sales/packing-lists");
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setFetching(false);
    }
  };

  const finance = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.total_price || 0),
      0,
    );
    return {
      subtotal,
      discount: 0,
      after_discount: subtotal,
      vat_amount: 0,
      wht_amount: 0,
      grand_total: subtotal,
      net_payable: subtotal,
    };
  }, [items]);

  const handlePreviewPDF = async () => {
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
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
            formData,
            selectedContact,
            items,
            finance,
            documentNumber: formData.document_number,
            paperSize,
            letterLayout,
          }}
        />,
      ).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    }
  };

  const executeApprove = async () => {
    setIsApproving(true);
    const toastId = toast.loading("กำลังดำเนินการ...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(
        `${apiUrl}/sale-documents/${documentId}/approve`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        toast.success("อนุมัติสำเร็จ", { id: toastId });
        setApproveOpen(false);
        fetchDocumentData();
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
    setIsCancelling(true);
    const toastId = toast.loading("กำลังดำเนินการ...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(
        `${apiUrl}/sale-documents/${documentId}/cancel`,
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
        setCancelOpen(false);
        setCancelReason("");
        fetchDocumentData();
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

  const executeDelete = async () => {
    setDeleteOpen(false);
    const toastId = toast.loading("กำลังลบเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("ลบสำเร็จ");
        router.push("/sales/packing-lists");
      } else {
        toast.error((await res.json()).message || "ไม่สามารถลบเอกสารได้", {
          id: toastId,
        });
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    }
  };

  if (!isAuthorized) return <AppLoading text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..." variant="bar" minHeight="min-h-screen" className="bg-muted/50" />;

  if (fetching) return <AppLoading text="กำลังโหลดข้อมูลเอกสาร..." minHeight="min-h-screen" />;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight flex items-center gap-2">
              {formData.document_number}
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold border",
                  formData.status === "Pending"
                    ? "bg-amber-50 text-amber-600 border-amber-200"
                    : formData.status === "Approved"
                      ? "bg-green-50 text-green-600 border-green-200"
                      : "bg-red-50 text-red-600 border-red-200",
                )}
              >
                {formData.status}
              </span>
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ใบจัดสินค้า — รายการสินค้า/S/N ล็อกตามใบเบิกสินค้าต้นทาง แก้ไขไม่ได้
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ตัวอย่าง PDF
          </button>
          {canApprove && formData.status === "Pending" && (
            <button
              type="button"
              onClick={() => setApproveOpen(true)}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-green-600 hover:bg-green-700 shadow-sm shadow-green-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <CheckCircle2 className="w-4 h-4" /> อนุมัติ
            </button>
          )}
          {formData.status !== "Cancelled" && (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <XCircle className="w-4 h-4" /> ยกเลิก
            </button>
          )}
          {canDelete && formData.status === "Pending" && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <Trash2 className="w-4 h-4" /> ลบ
            </button>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> กลับ
          </button>
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border min-h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-5 p-5 border border-border rounded-xl bg-muted/50">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              โครงการ
            </label>
            <p className="h-10 flex items-center text-sm font-medium">{projectName}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              ลูกค้า
            </label>
            <p className="h-10 flex items-center text-sm font-medium truncate">
              {selectedContact?.business_name || selectedContact?.name || "-"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              คลังสินค้า
            </label>
            <p className="h-10 flex items-center text-sm font-medium">{warehouseName}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              วันที่ออกเอกสาร
            </label>
            <p className="h-10 flex items-center text-sm font-medium">
              {formData.issue_date ? dayjs(formData.issue_date).format("DD/MM/YYYY") : "-"}
            </p>
          </div>
        </div>

        <SaleDocumentItemsTable
          items={items}
          readOnly
          hidePricing
          onSelectProduct={() => {}}
          onChangeField={() => {}}
          onAdd={() => {}}
          onRemove={() => {}}
          showSerialPicker={false}
          onViewSerials={(index) => setSerialViewIndex(index)}
        />

        {formData.note && (
          <div className="mt-6">
            <label className="block text-sm font-bold text-foreground mb-2">
              หมายเหตุ
            </label>
            <p className="w-full p-4 rounded-2xl border border-border text-sm bg-muted/50 whitespace-pre-wrap">
              {formData.note}
            </p>
          </div>
        )}
      </div>

      <ItemSerialsDialog
        open={serialViewIndex !== null}
        onClose={() => setSerialViewIndex(null)}
        productName={serialViewIndex !== null ? items[serialViewIndex]?.product_name || "" : ""}
        sku={serialViewIndex !== null ? items[serialViewIndex]?.sku : undefined}
        serials={serialViewIndex !== null ? items[serialViewIndex]?.serials || [] : []}
      />

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />{" "}
                พรีวิวตัวอย่างเอกสาร ({formData.document_number})
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

      <AppConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
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
        open={cancelOpen}
        onOpenChange={(v) => {
          setCancelOpen(v);
          if (!v) setCancelReason("");
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

      <AppConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        icon={Trash2}
        iconColorClass="bg-red-50 text-red-500 border-red-100/50"
        title="ยืนยันการลบ?"
        description="ลบแล้วจะไม่สามารถกู้คืนได้"
        confirmLabel="ยืนยันลบ"
        confirmColorClass="bg-red-600 hover:bg-red-700 shadow-red-600/20"
        onConfirm={executeDelete}
      />
    </div>
  );
}
