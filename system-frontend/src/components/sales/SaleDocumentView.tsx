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
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";

// 👁️ หน้าดูเอกสารขาย/เบิกแบบอ่านอย่างเดียว — ใช้เป็นปลายทางของลิงก์ "ดูเอกสาร" (เช่น จากรายงานกำไร-ขาดทุนต่อโครงการ)
// แทนหน้า /edit ที่ปฏิเสธเอกสารที่อนุมัติแล้ว (ไม่ใช่หน้าแก้ไข — แก้ไขได้เฉพาะเอกสารสถานะ Pending ผ่านปุ่มด้านบน)
interface SaleDocumentViewProps {
  listHref: string;
  editHref: (id: string | number) => string;
  editPermission: string;
  showCostPrice?: boolean;
  // ✅ แสดงปุ่ม "แก้ไข" ตอนอนุมัติแล้วด้วย (ใบกำกับภาษีที่แก้ไขหลังอนุมัติได้)
  editWhenApproved?: boolean;
}

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

const money = (v: any) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

export function SaleDocumentView({
  listHref,
  editHref,
  editPermission,
  showCostPrice = false,
  editWhenApproved = false,
}: SaleDocumentViewProps) {
  const router = useRouter();
  const params = useParams();
  const docId = params.id as string;

  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const canEdit = usePermission(editPermission);

  useEffect(() => {
    if (!docId) return;
    const fetchDoc = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const res = await fetch(`${apiUrl}/sale-documents/${docId}`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.message || "ไม่พบข้อมูลเอกสาร");
          router.replace(listHref);
          return;
        }
        const json = await res.json();
        setDoc(json.data || json);
      } catch (e) {
        toast.error("ข้อผิดพลาดในการเชื่อมต่อ");
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [docId]);

  if (loading) return <AppLoading />;
  if (!doc) return null;

  const showCredit = Number(doc.credit_days) > 0;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-md font-bold tracking-tight text-foreground">
              {doc.document_number}
            </h1>
            <StatusBadge status={doc.status} />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            สร้างเมื่อ {dayjs(doc.created_at).format("DD/MM/YYYY HH:mm")}
            {doc.creator?.name ? ` โดย ${doc.creator.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={listHref}>
            <button className="flex justify-center h-10 px-5 gap-2 text-sm font-medium items-center text-foreground bg-card hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all">
              <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
            </button>
          </Link>
          {canEdit &&
            (doc.status === "Pending" ||
              (editWhenApproved && doc.status === "Approved")) && (
              <Link href={editHref(doc.id)}>
                <button className="flex justify-center h-10 px-5 gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all">
                  <Edit2 className="w-4 h-4" /> แก้ไข
                </button>
              </Link>
            )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="p-6 border-b md:border-b-0 md:border-r border-border">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              ลูกค้า (Customer)
            </h3>
            <div className="text-lg font-bold text-foreground">
              {doc.contact?.business_name || doc.contact?.contact_name || "-"}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {doc.contact?.address || "ไม่มีข้อมูลที่อยู่"}
            </div>
          </div>
          <div className="p-6 bg-muted/50">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              รายละเอียดเอกสาร
            </h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <div className="text-xs text-muted-foreground">วันที่ออกเอกสาร</div>
                <div className="font-medium text-foreground">
                  {doc.issue_date ? dayjs(doc.issue_date).format("DD/MM/YYYY") : "-"}
                </div>
              </div>
              {showCredit && (
                <div>
                  <div className="text-xs text-muted-foreground">เงื่อนไขการชำระเงิน</div>
                  <div className="font-bold text-blue-600">{doc.credit_days} วัน</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">โครงการ</div>
                <div className="font-medium text-foreground">
                  {doc.project?.name || "-"}
                </div>
              </div>
              {doc.warehouse?.name && (
                <div>
                  <div className="text-xs text-muted-foreground">คลังสินค้า</div>
                  <div className="font-medium text-foreground">{doc.warehouse.name}</div>
                </div>
              )}
              {doc.referenced_document?.document_number && (
                <div>
                  <div className="text-xs text-muted-foreground">เอกสารอ้างอิง</div>
                  <div className="font-medium text-foreground">
                    {doc.referenced_document.document_number}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {doc.invoice_refs?.length > 0 && (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
          <div className="p-4 border-b border-border bg-muted/50">
            <h3 className="font-bold text-foreground">ใบกำกับภาษีที่อ้างอิง</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-card text-muted-foreground text-xs uppercase border-b border-border">
                <tr>
                  <th className="px-6 py-4">เลขที่ใบกำกับภาษี</th>
                  <th className="px-6 py-4 text-right">ยอดใบกำกับภาษี</th>
                  {doc.document_type === "receipt" && (
                    <th className="px-6 py-4 text-right">ยอดที่รับชำระ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {doc.invoice_refs.map((ref: any) => (
                  <tr key={ref.id}>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {ref.tax_invoice?.document_number || `#${ref.tax_invoice_id}`}
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {money(ref.tax_invoice?.grand_total)}
                    </td>
                    {doc.document_type === "receipt" && (
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        {money(ref.payment_amount)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        {doc.items?.length > 0 && (
        <>
        <div className="p-4 border-b border-border bg-muted/50">
          <h3 className="font-bold text-foreground">รายการสินค้า</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-card text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-6 py-4">รายการสินค้า</th>
                <th className="px-6 py-4 text-center">จำนวน</th>
                <th className="px-6 py-4 text-right">ราคาต่อหน่วย</th>
                {showCostPrice && <th className="px-6 py-4 text-right">ราคาทุน</th>}
                <th className="px-6 py-4 text-right">ส่วนลด</th>
                <th className="px-6 py-4 text-right">ราคารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doc.items?.map((item: any) => (
                <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">
                      {item.item_name || item.product?.name || `Product ID: ${item.product_id}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.product?.sku || ""}
                    </div>
                    {item.serials?.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1 font-mono">
                        S/N: {item.serials.map((s: any) => s.serial_number).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-foreground">
                    {Number(item.quantity)} {item.unit_name}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-muted-foreground">
                    {money(item.unit_price)}
                  </td>
                  {showCostPrice && (
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {money(item.cost_price)}
                    </td>
                  )}
                  <td className="px-6 py-4 text-right text-red-500">
                    {Number(item.discount_amount) > 0 ? money(item.discount_amount) : "-"}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">
                    {money(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        )}

        <div className="p-6 bg-muted/50 border-t border-border flex justify-end">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>รวมเป็นเงิน</span>
              <span>{money(doc.subtotal)}</span>
            </div>
            {Number(doc.discount_amount) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>หักส่วนลด</span>
                <span>{money(doc.discount_amount)}</span>
              </div>
            )}
            {doc.tax_type && doc.tax_type !== "none" && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>ภาษีมูลค่าเพิ่ม</span>
                <span>{money(doc.vat_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
              <span>ยอดรวมทั้งสิ้น</span>
              <span>{money(doc.grand_total)}</span>
            </div>
          </div>
        </div>
      </div>

      {doc.note && (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            หมายเหตุ
          </h3>
          <p className="text-sm text-foreground whitespace-pre-line">{doc.note}</p>
        </div>
      )}
    </div>
  );
}
