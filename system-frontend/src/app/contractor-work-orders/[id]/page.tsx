"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Edit2 } from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";

const money = (v: any) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

const StatusBadge = ({ status }: { status?: string }) => {
  if (status === "Approved")
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-xs font-bold border border-green-200">
        <CheckCircle2 className="w-4 h-4" /> อนุมัติแล้ว
      </span>
    );
  if (status === "Cancelled")
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-200">
        <XCircle className="w-4 h-4" /> ยกเลิก
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-bold border border-amber-200">
      <Clock className="w-4 h-4" /> รออนุมัติ
    </span>
  );
};

// 👁️ หน้าดูใบสั่งจ้างผู้รับเหมาแบบอ่านอย่างเดียว — ใช้กับใบที่อนุมัติแล้ว (ใบที่ยังไม่อนุมัติเข้าหน้าแก้ไข /edit)
export default function ViewContractorWorkOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const canEdit = usePermission("edit_contractor_work_orders");

  useEffect(() => {
    if (!orderId) return;
    const fetchOrder = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const res = await fetch(`${apiUrl}/contractor-work-orders/${orderId}`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });
        if (!res.ok) {
          toast.error("ไม่พบข้อมูลใบสั่งจ้าง");
          router.replace("/contractor-work-orders");
          return;
        }
        const json = await res.json();
        setOrder(json.data || json);
      } catch (e) {
        toast.error("ข้อผิดพลาดในการเชื่อมต่อ");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  if (loading) return <AppLoading />;
  if (!order) return null;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-md font-bold tracking-tight text-foreground">
              {order.order_number}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            สร้างเมื่อ {dayjs(order.created_at).format("DD/MM/YYYY HH:mm")}
            {order.creator?.name ? ` โดย ${order.creator.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/contractor-work-orders">
            <button className="flex justify-center h-10 px-5 gap-2 text-sm font-medium items-center text-foreground bg-card hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all">
              <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
            </button>
          </Link>
          {canEdit && order.status === "Pending" && (
            <Link href={`/contractor-work-orders/${order.id}/edit`}>
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
              ผู้รับเหมา
            </h3>
            <div className="text-lg font-bold text-foreground">
              {order.contact?.business_name || order.contact?.contact_name || "-"}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {order.contact?.address || "ไม่มีข้อมูลที่อยู่"}
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
                  {order.order_date ? dayjs(order.order_date).format("DD/MM/YYYY") : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">โครงการ</div>
                <div className="font-medium text-foreground">{order.project?.name || "-"}</div>
              </div>
              {order.site_reference && (
                <div>
                  <div className="text-xs text-muted-foreground">อ้างอิงสถานที่</div>
                  <div className="font-medium text-foreground">{order.site_reference}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        <div className="p-4 border-b border-border bg-muted/50">
          <h3 className="font-bold text-foreground">รายการจ้างงาน</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-card text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-6 py-4">รายการ</th>
                <th className="px-6 py-4 text-center">จำนวน</th>
                <th className="px-6 py-4 text-right">ราคาต่อหน่วย</th>
                <th className="px-6 py-4 text-right">ส่วนลด</th>
                <th className="px-6 py-4 text-right">ราคารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.items?.map((item: any) => (
                <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-foreground">{item.description}</td>
                  <td className="px-6 py-4 text-center font-bold text-foreground">
                    {Number(item.quantity)} {item.unit_name}
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">{money(item.unit_price)}</td>
                  <td className="px-6 py-4 text-right text-red-500">
                    {Number(item.discount_amount) > 0 ? money(item.discount_amount) : "-"}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">{money(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-6 bg-muted/50 border-t border-border flex justify-end">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>รวมเป็นเงิน</span>
              <span>{money(order.subtotal)}</span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>หักส่วนลด</span>
                <span>{money(order.discount_amount)}</span>
              </div>
            )}
            {Number(order.wht_amount) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>หัก ณ ที่จ่าย ({Number(order.wht_rate)}%)</span>
                <span>{money(order.wht_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
              <span>ยอดรวมทั้งสิ้น</span>
              <span>{money(order.grand_total)}</span>
            </div>
          </div>
        </div>
      </div>

      {order.note && (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">หมายเหตุ</h3>
          <p className="text-sm text-foreground whitespace-pre-line">{order.note}</p>
        </div>
      )}
    </div>
  );
}
