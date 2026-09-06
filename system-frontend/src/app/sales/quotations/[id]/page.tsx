"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Edit2,
  FileText,
  Loader2,
  AlertTriangle,
  History,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { SalesHistoryModal } from "@/components/sales/SalesHistoryModal";
import {
  getPaperSizeConfig,
  getQuotationHeaderBackgroundUrl,
} from "@/lib/letterLayoutDefaults";

const StatusBadge = ({ status }: { status?: string }) => {
  switch (status) {
    case "Approved":
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-xs font-bold border border-green-200">
          <CheckCircle2 className="w-4 h-4" /> อนุมัติแล้ว
        </span>
      );
    case "Cancelled":
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-200">
          <XCircle className="w-4 h-4" /> ยกเลิก
        </span>
      );
    case "Revised":
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full text-xs font-bold border border-purple-200">
          <RefreshCw className="w-4 h-4" /> ถูกสร้างเวอร์ชันใหม่แล้ว
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-bold border border-amber-200">
          <Clock className="w-4 h-4" /> รออนุมัติ
        </span>
      );
  }
};

export default function ViewQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const docId = params.id;

  const [doc, setDoc] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewGenerating, setPreviewGenerating] = useState(false);

  // 🚀 ปุ่ม "ดูรายการขายล่าสุด" ต่อแถวสินค้า (เหมือนหน้าสร้าง/แก้ไข)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [historyProductName, setHistoryProductName] = useState("");

  const canApprove = usePermission("approve_quotation");
  const canEdit = usePermission("edit_quotation");

  useEffect(() => {
    if (docId) {
      fetchDoc();
      fetchCompany();
    }
  }, [docId]);

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

  const fetchDoc = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${docId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("ไม่พบข้อมูลใบเสนอราคา");
        router.push("/sales/quotations");
        return;
      }
      const json = await res.json();
      setDoc(json.data || json);
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const executeApprove = async () => {
    setIsApproving(true);
    const toastId = toast.loading("กำลังอนุมัติเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${docId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok)
        throw new Error((await res.json()).message || "ไม่สามารถอนุมัติได้");

      toast.success("อนุมัติใบเสนอราคาเรียบร้อยแล้ว!", { id: toastId });
      setIsApproveOpen(false);
      router.push("/sales/quotations");
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsApproving(false);
    }
  };

  const executeCancel = async () => {
    setIsCancelling(true);
    const toastId = toast.loading("กำลังยกเลิกเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${docId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok)
        throw new Error((await res.json()).message || "ไม่สามารถยกเลิกได้");

      toast.success("ยกเลิกใบเสนอราคาเรียบร้อยแล้ว!", { id: toastId });
      setIsCancelOpen(false);
      setCancelReason("");
      router.push("/sales/quotations");
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePreviewPDF = async () => {
    if (!doc) return;
    setPreviewGenerating(true);
    const toastId = toast.loading("กำลังเตรียมเอกสาร...");
    try {
      const finance = {
        subtotal: Number(doc.subtotal),
        discount: Number(doc.discount_amount),
        after_discount: Number(doc.subtotal) - Number(doc.discount_amount),
        vat_amount: Number(doc.vat_amount),
        wht_amount: Number(doc.wht_amount),
        grand_total: Number(doc.grand_total),
      };
      const { pdf } = await import("@react-pdf/renderer");
      const { default: SalesPdfTemplate } =
        await import("@/components/documents/SalesPdfTemplate");
      const { paperSize, letterLayout } = getPaperSizeConfig(
        companySettings,
        "quotation",
      );
      const quotationHeaderBackgroundUrl =
        getQuotationHeaderBackgroundUrl(companySettings);
      const blob = await pdf(
        <SalesPdfTemplate
          data={{
            companySettings,
            formData: doc,
            selectedContact: doc.contact,
            items: doc.items,
            finance,
            documentNumber: doc.document_number,
            paperSize,
            letterLayout,
            quotationHeaderBackgroundUrl,
          }}
        />,
      ).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (error) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    } finally {
      setPreviewGenerating(false);
    }
  };

  if (loading) return <AppLoading text="กำลังโหลดข้อมูลใบเสนอราคา..." />;
  if (!doc) return null;

  const isPending = doc.status === "Pending";

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-md font-bold tracking-tight text-slate-800">
              {doc.document_number}
            </h1>
            <StatusBadge status={doc.status} />
          </div>
          <p className="text-slate-500 text-sm mt-1">
            สร้างเมื่อ {dayjs(doc.created_at).format("DD/MM/YYYY HH:mm")} โดย{" "}
            {doc.creator?.name || "-"}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/sales/quotations">
            <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
              <ArrowLeft className="w-5 h-5" /> ย้อนกลับ
            </button>
          </Link>

          <button
            onClick={handlePreviewPDF}
            disabled={previewGenerating}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {previewGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            ตัวอย่าง PDF
          </button>

          {isPending && canEdit && (
            <Link href={`/sales/quotations/${doc.id}/edit`}>
              <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
                <Edit2 className="w-4 h-4" /> แก้ไขเอกสาร
              </button>
            </Link>
          )}

          {doc.status !== "Cancelled" &&
            doc.status !== "Revised" &&
            canEdit && (
              <button
                onClick={() => setIsCancelOpen(true)}
                className="h-10 px-4 rounded-full text-white text-sm font-medium bg-orange-500 hover:bg-orange-600 gap-2 shadow-lg shadow-orange-500/20 flex items-center cursor-pointer transition-all"
              >
                <XCircle className="w-4 h-4" /> ยกเลิกเอกสาร
              </button>
            )}

          {isPending && canApprove && (
            <button
              onClick={() => setIsApproveOpen(true)}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <CheckCircle2 className="w-5 h-5" /> อนุมัติเอกสาร
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              ลูกค้า (Customer)
            </h3>
            <div className="text-lg font-bold text-slate-800">
              {doc.contact?.business_name || doc.contact?.contact_name || "-"}
            </div>
            <div className="text-sm text-slate-600 mt-2">
              {doc.contact?.address || "ไม่มีข้อมูลที่อยู่"}
            </div>
          </div>
          <div className="p-6 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              รายละเอียดเอกสาร
            </h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <div className="text-xs text-slate-500">วันที่ออกเอกสาร</div>
                <div className="font-medium text-slate-800">
                  {doc.issue_date
                    ? dayjs(doc.issue_date).format("DD/MM/YYYY")
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  เงื่อนไขการชำระเงิน
                </div>
                <div className="font-medium text-blue-600 font-bold">
                  {doc.credit_days > 0 ? `${doc.credit_days} วัน` : "เงินสด"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">รายการสินค้า</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-600 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">รายการสินค้า</th>
                <th className="px-6 py-4 text-center">ราคาขายล่าสุด</th>
                <th className="px-6 py-4 text-center">จำนวน</th>
                <th className="px-6 py-4 text-right">ราคาต่อหน่วย</th>
                <th className="px-6 py-4 text-right">ส่วนลด</th>
                <th className="px-6 py-4 text-right">ราคารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doc.items?.map((item: any, idx: number) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">
                      {item.product?.name || `Product ID: ${item.product_id}`}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {item.product?.sku || ""}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <AppTooltip label="ดูรายการขายล่าสุด">
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryProductId(item.product_id);
                          setHistoryProductName(item.product?.name || "");
                          setHistoryOpen(true);
                        }}
                        className="p-1.5 text-indigo-400 border border-slate-100 hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 rounded-lg shadow-sm transition-all cursor-pointer"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </AppTooltip>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-slate-700">
                    {item.quantity} {item.unit_name}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-600">
                    {Number(item.unit_price).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-4 text-right text-red-500">
                    {Number(item.discount_amount) > 0
                      ? Number(item.discount_amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-800">
                    {Number(item.total_price).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>รวมเป็นเงิน</span>
              <span>
                {Number(doc.subtotal).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>หักส่วนลด</span>
              <span>
                {Number(doc.discount_amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            {doc.tax_type !== "none" && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>ภาษีมูลค่าเพิ่ม</span>
                <span>
                  {Number(doc.vat_amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-800 pt-2 border-t border-slate-200">
              <span>ยอดรวมทั้งสิ้น</span>
              <span>
                {Number(doc.grand_total).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <AppConfirmDialog
        open={isApproveOpen}
        onOpenChange={setIsApproveOpen}
        icon={CheckCircle2}
        iconColorClass="bg-blue-50 text-blue-600 border-blue-100/50"
        title="อนุมัติใบเสนอราคา?"
        description={
          <>
            คุณต้องการอนุมัติใบเสนอราคาเลขที่ <br />
            <span className="font-bold text-slate-800 text-base">
              {doc.document_number}
            </span>{" "}
            เพื่อส่งให้ลูกค้าใช่หรือไม่?
          </>
        }
        confirmLabel="อนุมัติเอกสาร"
        confirmColorClass="bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
        onConfirm={executeApprove}
        loading={isApproving}
      />

      <AppConfirmDialog
        open={isCancelOpen}
        onOpenChange={(v) => {
          setIsCancelOpen(v);
          if (!v) setCancelReason("");
        }}
        icon={AlertTriangle}
        iconColorClass="bg-orange-50 text-orange-600 border-orange-100/50"
        title="ยกเลิกใบเสนอราคา?"
        description={
          <>
            คุณต้องการยกเลิกใบเสนอราคาเลขที่ <br />
            <span className="font-bold text-slate-800 text-base">
              {doc.document_number}
            </span>{" "}
            ใช่หรือไม่?
          </>
        }
        confirmLabel={isCancelling ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
        confirmColorClass="bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
        onConfirm={executeCancel}
        loading={isCancelling}
      >
        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
          เหตุผลในการยกเลิก
        </label>
        <input
          type="text"
          placeholder="เช่น ลูกค้ายกเลิกคำสั่งซื้อ"
          className="w-full h-11 px-4 border border-slate-200 rounded-xl outline-none focus:border-orange-500 text-sm bg-slate-50 focus:bg-white transition-all"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </AppConfirmDialog>

      <SalesHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        productId={historyProductId}
        productName={historyProductName}
        contactId={doc.contact_id || null}
        companySettings={companySettings}
      />

      {previewUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ตัวอย่างเอกสาร
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1 text-slate-400 hover:text-red-500 bg-white rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-xl border border-slate-200"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
