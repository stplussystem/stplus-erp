"use client";

import React, { useEffect, useState } from "react";
import { Tags, XCircle, AlertTriangle, TrendingUp, TrendingDown, Minus, Boxes } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import { Badge } from "@/components/ui/badge";

// 🚀 ปุ่ม "ดู Price List ผู้จำหน่าย" ต่อแถวสินค้า (หน้าอนุมัติใบเสนอราคา) — โครงสร้างมิเรอร์
// SalesHistoryModal.tsx ทุกประการ (fetch-on-open/clear-on-close) แต่ดึงราคาที่ผู้จำหน่ายแต่ละรายตั้งไว้
// (โมดูล Price List) แทนประวัติการขาย
// 🆕 ถ้าเป็นสินค้าชุด (bundle/SET) แม่ไม่มี Price List ของตัวเอง — backend จะส่ง groups มาเป็นรายสินค้าลูก
// แทน (1 กลุ่มต่อ 1 ลูก) แสดงแยกเป็นตารางย่อยต่อรายการ ไม่ใช่สินค้าชุดก็ยังใช้โครงสร้าง groups เดิม แค่มีกลุ่มเดียว
type ViewPriceListDialogProps = {
  open: boolean;
  onClose: () => void;
  productId: string | number | null;
  productName?: string;
};

type PriceListGroup = {
  product_id: number;
  product_name: string;
  sku: string;
  rows: any[];
};

const TREND_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  up: { label: "ราคาขึ้น", className: "bg-red-50 text-red-600 border-red-200", icon: TrendingUp },
  down: { label: "ราคาลง", className: "bg-green-50 text-green-600 border-green-200", icon: TrendingDown },
  stable: { label: "ราคาคงที่", className: "bg-muted text-muted-foreground border-border", icon: Minus },
};

export function ViewPriceListDialog({ open, onClose, productId, productName }: ViewPriceListDialogProps) {
  const [groups, setGroups] = useState<PriceListGroup[]>([]);
  const [isBundle, setIsBundle] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productId) {
      fetchPriceLists();
    }
    if (!open) {
      setGroups([]);
      setIsBundle(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  const fetchPriceLists = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/products/${productId}/price-lists`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const json = await res.json();
        setGroups(json.data?.groups || []);
        setIsBundle(!!json.data?.is_bundle);
      }
    } catch (err) {
      toast.error("ดึงข้อมูล Price List ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);

  const renderTable = (rows: any[]) => (
    <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
          <tr>
            <th className="px-4 py-3">ผู้จำหน่าย</th>
            <th className="px-4 py-3 text-right">ราคา</th>
            <th className="px-4 py-3 text-right">ส่วนลด</th>
            <th className="px-4 py-3 text-right">ราคาสั่งซื้อ</th>
            <th className="px-4 py-3 text-center">สถานะ</th>
            <th className="px-4 py-3">อัพเดทล่าสุด</th>
            <th className="px-4 py-3">วันสิ้นสุดราคา</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => {
            const trend = TREND_BADGE[row.price_trend] || TREND_BADGE.stable;
            const TrendIcon = trend.icon;
            return (
              <tr key={i} className={`hover:bg-muted/50 transition-colors ${row.is_expired ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-bold text-foreground">{row.vendor_name}</td>
                <td className="px-4 py-3 text-right font-bold text-foreground">
                  {Number(row.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {row.discount_percent != null ? `${row.discount_percent}%` : "-"}
                </td>
                <td className="px-4 py-3 text-right text-red-600 font-bold">
                  {(Number(row.price) * (1 - (Number(row.discount_percent) || 0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant="outline" className={`text-[10px] gap-1 ${trend.className}`}>
                    <TrendIcon className="w-3 h-3" /> {trend.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.updated_at}</td>
                <td className="px-4 py-3">
                  {row.expiry_date ? (
                    <span className={row.is_expired ? "text-red-600 font-bold flex items-center gap-1" : "text-muted-foreground"}>
                      {row.is_expired && <AlertTriangle className="w-3.5 h-3.5" />}
                      {row.expiry_date}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border flex justify-between items-center bg-muted/50 shrink-0">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Tags className="w-5 h-5 text-purple-600" />
            Price List ผู้จำหน่าย :{" "}
            <span className="text-purple-600">{productName}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-red-500 cursor-pointer"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <AppLoading text="กำลังค้นหาข้อมูลจากฐานข้อมูล..." minHeight="min-h-[160px]" />
          ) : groups.length === 0 || totalRows === 0 ? (
            <div className="py-10 text-center text-muted-foreground font-medium bg-muted rounded-xl border border-dashed border-border">
              {isBundle
                ? "สินค้าชุดนี้ยังไม่มีข้อมูล Price List ของสินค้าลูกเลย"
                : "ยังไม่มีข้อมูล Price List ของสินค้านี้"}
            </div>
          ) : (
            <div className="space-y-5">
              {isBundle && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 rounded-lg px-3 py-2">
                  <Boxes className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  สินค้านี้เป็นสินค้าชุด (SET) — แสดง Price List ของสินค้าลูกแต่ละรายการแทน
                </div>
              )}
              {groups.map((group) => (
                <div key={group.product_id}>
                  {isBundle && (
                    <div className="mb-2 font-bold text-sm text-foreground flex items-center gap-2">
                      {group.product_name}
                      <span className="text-xs font-normal text-muted-foreground">{group.sku}</span>
                    </div>
                  )}
                  {group.rows.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground bg-muted/50 rounded-xl border border-dashed border-border">
                      ยังไม่มีข้อมูล Price List ของสินค้านี้
                    </div>
                  ) : (
                    renderTable(group.rows)
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
