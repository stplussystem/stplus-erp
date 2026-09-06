"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  PackageCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Edit2,
  History,
  Loader2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function ViewPurchaseOrderPage() {
  const router = useRouter();
  const params = useParams();
  const poId = params.id;

  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  // 🚀 ปิดใบสั่งซื้อก่อนรับครบ (กรณีผู้จำหน่ายแจ้งว่าจะไม่ส่งของส่วนที่เหลือแล้ว)
  const [isForceCloseModalOpen, setIsForceCloseModalOpen] = useState(false);
  const [forceCloseReason, setForceCloseReason] = useState("");
  const [isForceClosing, setIsForceClosing] = useState(false);

  // States สำหรับ Modal ประวัติราคา
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");

  // 🚀 คลิกดู PO อ้างอิงจากตารางประวัติการซื้อ — แสดงเป็น modal ซ้อนอยู่ในหน้าเดิม ไม่ต้อง navigate ออกไปหน้าอื่น
  // (เดิมใช้ Link นำทางออกจากหน้าปัจจุบันไปเลย ทำให้เสียบริบทที่กำลังดูอยู่)
  const [isViewingPoModalOpen, setIsViewingPoModalOpen] = useState(false);
  const [viewingPo, setViewingPo] = useState<any>(null);
  const [viewingPoLoading, setViewingPoLoading] = useState(false);

  const handleViewPoFromHistory = async (targetPoId: number) => {
    setIsViewingPoModalOpen(true);
    setViewingPoLoading(true);
    setViewingPo(null);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${targetPoId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );
      if (!res.ok) throw new Error("ไม่พบข้อมูลใบสั่งซื้อ");
      const data = await res.json();
      setViewingPo(data.data || data);
    } catch (error: any) {
      toast.error(error.message || "ดึงข้อมูลใบสั่งซื้อไม่สำเร็จ");
      setIsViewingPoModalOpen(false);
    } finally {
      setViewingPoLoading(false);
    }
  };

  // 🚀 "เปิดดูหน้าเต็ม" ของ PO ที่อ้างอิงจากประวัติการซื้อ — แสดงเป็นตัวอย่างเอกสาร PDF แบบเดียวกับปุ่ม
  // "ตัวอย่าง"/"พิมพ์" ในหน้าสร้าง/แก้ไข PO แทนที่จะพาออกจากหน้าไปหน้ารายละเอียดแบบเดิม
  const [viewingPoPreviewUrl, setViewingPoPreviewUrl] = useState<string | null>(
    null,
  );
  const [previewGenerating, setPreviewGenerating] = useState(false);

  const handlePreviewViewingPo = async () => {
    if (!viewingPo) return;
    setPreviewGenerating(true);
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const token = getToken();
      const compRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/company`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      const compData = await compRes.json();
      const companySettings = Array.isArray(compData)
        ? compData[0]
        : compData.data || compData;

      const { pdf } = await import("@react-pdf/renderer");
      const { default: POPdfTemplate } =
        await import("@/components/documents/POPdfTemplate");

      const pdfDataObj = {
        companySettings,
        formData: {
          expected_date: viewingPo.expected_date,
          reference_number: viewingPo.reference_number,
          credit_days: viewingPo.credit_days,
          tax_type: viewingPo.tax_type,
          note: viewingPo.note,
          creator: viewingPo.creator,
          approver: viewingPo.approver,
          created_at: viewingPo.created_at,
          updated_at: viewingPo.updated_at,
        },
        selectedContact: viewingPo.contact,
        items: (viewingPo.items || []).map((item: any) => ({
          product_name: item.product?.name,
          quantity: item.quantity,
          unit_name: item.unit_name,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
          total_price: item.total_price,
        })),
        products: [],
        // 🚀 บิลนี้ถูกบันทึกแล้ว (backend คำนวณ/ยืนยันตัวเลขไว้ตั้งแต่ตอนบันทึกแล้ว) — อ่านค่าที่บันทึกไว้ตรงๆ
        // ไม่คำนวณซ้ำจาก items เพื่อไม่ให้ตัวเลขใน PDF เพี้ยนไปจากที่บันทึกจริง (เช่น กรณีแก้ subtotal/VAT เอง)
        finance: {
          subtotal: Number(viewingPo.subtotal || 0),
          discount: Number(viewingPo.discount_amount || 0),
          after_discount: Math.max(
            0,
            Number(viewingPo.subtotal || 0) -
              Number(viewingPo.discount_amount || 0),
          ),
          vat_amount: Number(viewingPo.vat_amount || 0),
          wht_amount: Number(viewingPo.wht_amount || 0),
          grand_total: Number(viewingPo.grand_total || 0),
          net_payable:
            Number(viewingPo.grand_total || 0) -
            Number(viewingPo.wht_amount || 0),
        },
        poNumber: viewingPo.po_number,
        footerCondition:
          "**กรุณาแนบใบสั่งซื้อทุกครั้งที่มีการส่งของ วางบิล หรือรับเช็ค**",
        ...getPaperSizeConfig(companySettings, "purchase_order"),
      };

      const blob = await pdf(<POPdfTemplate data={pdfDataObj} />).toBlob();
      setViewingPoPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (error) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    } finally {
      setPreviewGenerating(false);
    }
  };

  const canApprove = usePermission("bt_approve_purchase");
  const canEdit = usePermission("bt_edit_purchase");
  console.log("สิทธิ์การอนุมัติ (canApprove) = ", canApprove);

  useEffect(() => {
    if (poId) fetchPO();
  }, [poId]);

  const fetchPO = async () => {
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${poId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store", // 🚀 กันเบราว์เซอร์ใช้ response เก่าซ้ำหลังกดอนุมัติ/แก้ไข ทำให้สถานะบนจอไม่อัปเดต
        },
      );

      if (!res.ok) {
        toast.error("ไม่พบข้อมูลใบสั่งซื้อ");
        router.push("/purchase-orders");
        return;
      }
      const data = await res.json();
      setPo(data.data || data);
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const executeApprove = async () => {
    setIsApproveModalOpen(false);
    setIsApproving(true);
    const toastId = toast.loading("กำลังยืนยันใบสั่งซื้อ...");

    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${poId}/approve`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!res.ok)
        throw new Error((await res.json()).message || "ไม่สามารถยืนยันได้");

      toast.success("ยืนยันใบสั่งซื้อเรียบร้อยแล้ว!", { id: toastId });
      router.push("/purchase-orders");
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsApproving(false);
    }
  };

  const executeForceClose = async () => {
    if (!forceCloseReason.trim()) {
      toast.error("กรุณาระบุเหตุผลในการปิดใบสั่งซื้อ");
      return;
    }

    setIsForceClosing(true);
    const toastId = toast.loading("กำลังปิดใบสั่งซื้อ...");

    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${poId}/force-close`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({ reason: forceCloseReason }),
        },
      );

      if (!res.ok)
        throw new Error(
          (await res.json()).message || "ไม่สามารถปิดใบสั่งซื้อได้",
        );

      toast.success("ปิดใบสั่งซื้อเรียบร้อยแล้ว!", { id: toastId });
      setIsForceCloseModalOpen(false);
      setForceCloseReason("");
      router.push("/purchase-orders");
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsForceClosing(false);
    }
  };

  const handleViewHistory = async (productId: number, productName: string) => {
    setSelectedProductName(productName);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}/purchase-history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const json = await res.json();
        setHistoryData(json.data);
      }
    } catch (err) {
      toast.error("ดึงข้อมูลประวัติไม่สำเร็จ");
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) return <AppLoading text="กำลังโหลดข้อมูลใบสั่งซื้อ..." />;
  if (!po) return null;

  const isPending = po.status === "Pending" || po.status === "Draft";

  const StatusBadge = ({ status }: { status?: string } = {}) => {
    switch (status ?? po.status) {
      case "Completed":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold border border-green-200">
            <CheckCircle2 className="w-4 h-4" /> รับสินค้าครบแล้ว
          </span>
        );
      case "Partial":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold border border-orange-200">
            <Clock className="w-4 h-4" /> รับบางส่วน
          </span>
        );
      case "Approved":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold border border-blue-200">
            <PackageCheck className="w-4 h-4" /> รอรับสินค้า
          </span>
        );
      case "Cancelled":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-bold border border-red-200">
            <XCircle className="w-4 h-4" /> ยกเลิก
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-bold border border-amber-200">
            <Clock className="w-4 h-4" /> รออนุมัติ
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-md font-bold tracking-tight text-foreground">
                {po.po_number}
              </h1>
              <StatusBadge />
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              สร้างเมื่อ {dayjs(po.created_at).format("DD/MM/YYYY HH:mm")} โดย{" "}
              {po.creator?.name || "-"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/purchase-orders">
            <button className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
              <ArrowLeft className="w-5 h-5" /> ย้อนกลับ
            </button>
          </Link>

          {isPending && (
            <Link href={`/purchase-orders/${po.id}/edit`}>
              <button className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
                <Edit2 className="w-4 h-4" /> แก้ไขเอกสาร
              </button>
            </Link>
          )}

          {isPending && canApprove && (
            <button
              onClick={() => setIsApproveModalOpen(true)}
              disabled={isApproving}
              className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
            >
              {isApproving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {isApproving ? "กำลังยืนยัน..." : "ยืนยันสั่งซื้อ"}
            </button>
          )}

          {po.status === "Partial" && canEdit && (
            <button
              onClick={() => setIsForceCloseModalOpen(true)}
              className="h-10 px-4 rounded-full text-white text-sm font-medium bg-orange-500 hover:bg-orange-600 gap-2 shadow-lg shadow-orange-500/20 flex items-center cursor-pointer transition-all font-medium"
            >
              <XCircle className="w-4 h-4" /> ปิดใบสั่งซื้อ
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="p-6 border-b md:border-b-0 md:border-r border-border">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              ข้อมูลผู้จำหน่าย (Supplier)
            </h3>
            <div className="text-lg font-bold text-foreground">
              {po.contact?.business_name || po.contact?.name || "-"}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {po.contact?.address || "ไม่มีข้อมูลที่อยู่"}
            </div>
          </div>
          <div className="p-6 bg-muted/50">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              รายละเอียดเอกสาร
            </h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <div className="text-xs text-muted-foreground">กำหนดส่ง</div>
                <div className="font-medium text-foreground">
                  {po.expected_date
                    ? dayjs(po.expected_date).format("DD/MM/YYYY")
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  คลังสินค้าที่รับเข้า
                </div>
                <div className="font-medium text-blue-600 font-bold">
                  {po.warehouse?.name || "ไม่ระบุ"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        <div className="p-4 border-b border-border bg-muted/50 flex justify-between items-center">
          <h3 className="font-bold text-foreground">รายการสินค้าและราคา</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-card text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-6 py-4">รายการสินค้า</th>
                <th className="px-6 py-4 text-center">สั่งซื้อ</th>
                <th className="px-6 py-4 text-center">รับแล้ว</th>
                <th className="px-6 py-4 text-right">ราคาต่อหน่วย</th>
                <th className="px-6 py-4 text-right">ราคารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {po.items?.map((item: any, idx: number) => {
                const isItemComplete = item.received_quantity >= item.quantity;
                return (
                  <tr
                    key={idx}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-between group">
                        <div>
                          <div className="font-bold text-foreground">
                            {item.product?.name ||
                              `Product ID: ${item.product_id}`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.product?.sku || ""}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleViewHistory(
                              item.product_id,
                              item.product?.name,
                            )
                          }
                          className="p-1.5 text-indigo-400 border border-border hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 rounded-lg shadow-sm transition-all flex items-center gap-1 text-xs font-bold"
                          title="ดูประวัติการซื้อ"
                        >
                          <History className="w-4 h-4" />{" "}
                          <span className="hidden md:inline">ประวัติ</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`font-bold ${isItemComplete ? "text-green-600" : "text-amber-600"}`}
                      >
                        {item.received_quantity || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-muted-foreground">
                      ฿{Number(item.unit_price).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">
                      ฿{Number(item.total_price).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isApproveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center transform animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border-[6px] border-blue-100/50">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              ยืนยันการสั่งซื้อ?
            </h3>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              คุณต้องการอนุมัติใบสั่งซื้อเลขที่ <br />
              <span className="font-bold text-foreground text-base">
                {po.po_number}
              </span>{" "}
              ใช่หรือไม่? <br />
              (เมื่อยืนยันแล้วจะสามารถรับสินค้าเข้าคลังได้)
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsApproveModalOpen(false)}
                className="flex-1 py-3 rounded-full border border-border text-muted-foreground font-bold hover:bg-muted/50 transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              {canApprove && (
                <button
                  onClick={executeApprove}
                  className="flex-1 py-3 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  ยืนยันสั่งซื้อ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isForceCloseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center transform animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 border-[6px] border-orange-100/50">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              ปิดใบสั่งซื้อ?
            </h3>
            <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
              คุณต้องการปิดใบสั่งซื้อเลขที่ <br />
              <span className="font-bold text-foreground text-base">
                {po.po_number}
              </span>{" "}
              ทั้งที่ยังรับสินค้าไม่ครบตามจำนวนที่สั่งใช่หรือไม่? <br />
              (รายการที่ค้างรับจะถูกปิดถาวร ไม่สามารถรับเพิ่มได้อีก)
            </p>
            <div className="mb-4 text-left">
              <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                เหตุผลในการปิดใบสั่งซื้อ *
              </label>
              <input
                type="text"
                placeholder="เช่น ผู้จำหน่ายแจ้งของหมด/เลิกผลิตแล้ว"
                className="w-full h-11 px-4 border border-border rounded-xl outline-none focus:border-orange-500 text-sm bg-muted/50 focus:bg-background transition-all"
                value={forceCloseReason}
                onChange={(e) => setForceCloseReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsForceCloseModalOpen(false);
                  setForceCloseReason("");
                }}
                disabled={isForceClosing}
                className="flex-1 py-3 rounded-full border border-border text-muted-foreground font-bold hover:bg-muted/50 transition-all cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={executeForceClose}
                disabled={isForceClosing}
                className="flex-1 py-3 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isForceClosing ? "กำลังปิด..." : "ยืนยันปิดใบสั่งซื้อ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                ประวัติการซื้อ :{" "}
                <span className="text-indigo-600">{selectedProductName}</span>
              </h3>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-muted-foreground hover:text-red-500"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {historyLoading ? (
                <AppLoading
                  text="กำลังค้นหาข้อมูลจากฐานข้อมูล..."
                  minHeight="min-h-[160px]"
                />
              ) : historyData.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground font-medium bg-muted/50 rounded-xl border border-dashed border-border">
                  ไม่พบประวัติการสั่งซื้อสินค้านี้ในระบบ
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                      <tr>
                        <th className="px-4 py-3">วันที่อนุมัติ</th>
                        <th className="px-4 py-3">อ้างอิง (PO)</th>
                        <th className="px-4 py-3">ผู้จำหน่าย</th>
                        <th className="px-4 py-3 text-center">จำนวน</th>
                        <th className="px-4 py-3 text-right">ราคาต่อหน่วย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {historyData.map((h, i) => (
                        <tr
                          key={i}
                          className="hover:bg-indigo-50/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-muted-foreground">{h.date}</td>
                          <td className="px-4 py-3 font-bold text-indigo-600">
                            {h.po_id ? (
                              <button
                                type="button"
                                onClick={() => handleViewPoFromHistory(h.po_id)}
                                className="hover:underline hover:text-indigo-800 transition-colors cursor-pointer"
                              >
                                {h.po_number}
                              </button>
                            ) : (
                              h.po_number
                            )}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {h.supplier_name}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-foreground">
                            {h.quantity}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            ฿{Number(h.unit_price).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Modal ดูสรุป PO ที่คลิกจากตารางประวัติการซื้อ — ซ้อนอยู่ในหน้าเดิม ไม่ navigate ออกไป */}
      {isViewingPoModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/50 shrink-0">
              <h3 className="font-bold text-foreground flex items-center gap-3">
                {viewingPoLoading || !viewingPo
                  ? "กำลังโหลดข้อมูล..."
                  : viewingPo.po_number}
                {viewingPo?.status && <StatusBadge status={viewingPo.status} />}
              </h3>
              <button
                onClick={() => {
                  setIsViewingPoModalOpen(false);
                  setViewingPo(null);
                }}
                className="text-muted-foreground hover:text-red-500 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {viewingPoLoading || !viewingPo ? (
                <AppLoading
                  text="กำลังดึงข้อมูลใบสั่งซื้อ..."
                  minHeight="min-h-[160px]"
                />
              ) : (
                <>
                  <div className="mb-4">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      ผู้จำหน่าย
                    </div>
                    <div className="font-bold text-foreground">
                      {viewingPo.contact?.business_name ||
                        viewingPo.contact?.name ||
                        "-"}
                    </div>
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                        <tr>
                          <th className="px-4 py-3">รายการสินค้า</th>
                          <th className="px-4 py-3 text-center">สั่งซื้อ</th>
                          <th className="px-4 py-3 text-right">ราคาต่อหน่วย</th>
                          <th className="px-4 py-3 text-right">รวม</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(viewingPo.items || []).map((item: any) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-foreground">
                              {item.product?.name || "-"}
                            </td>
                            <td className="px-4 py-3 text-center text-muted-foreground">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              ฿{Number(item.unit_price).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-foreground">
                              ฿{Number(item.total_price).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end mt-4">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        ยอดรวมทั้งสิ้น
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        ฿{Number(viewingPo.grand_total).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={handlePreviewViewingPo}
                      disabled={previewGenerating}
                      className="text-sm text-indigo-600 hover:underline font-medium cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      {previewGenerating
                        ? "กำลังสร้างตัวอย่าง..."
                        : "เปิดดูหน้าเต็ม (ตัวอย่างเอกสาร)"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Modal ตัวอย่างเอกสาร PDF ของ PO ที่คลิก "เปิดดูหน้าเต็ม" จากประวัติ (สไตล์เดียวกับปุ่มตัวอย่าง/พิมพ์ในหน้าสร้าง/แก้ไข PO) */}
      {viewingPoPreviewUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />{" "}
                ตัวอย่างเอกสารจริง
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(viewingPoPreviewUrl);
                  setViewingPoPreviewUrl(null);
                }}
                className="p-1 text-muted-foreground hover:text-red-500 bg-background rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-muted p-2">
              <iframe
                src={viewingPoPreviewUrl}
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
