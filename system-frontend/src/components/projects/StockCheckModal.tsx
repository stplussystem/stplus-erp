"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  PackageSearch,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";

interface QuotationOption {
  id: number;
  document_number: string;
}

interface StockCheckRow {
  product_id: number;
  product_name: string | null;
  sku: string | null;
  requested_qty: number;
  available_qty: number;
  in_stock: boolean;
  shortfall_qty: number;
  warehouses: {
    warehouse_id: number;
    warehouse_name: string | null;
    qty: number;
  }[];
}

interface StockCheckModalProps {
  projectId: string;
  quotations: QuotationOption[];
  onClose: () => void;
}

export function StockCheckModal({
  projectId,
  quotations,
  onClose,
}: StockCheckModalProps) {
  const router = useRouter();
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>(
    quotations[0] ? String(quotations[0].id) : "",
  );
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StockCheckRow[] | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);

  useEffect(() => {
    if (selectedQuotationId) {
      checkStock(selectedQuotationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuotationId]);

  const checkStock = async (quotationId: string) => {
    setLoading(true);
    setRows(null);
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const docRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/sale-documents/${quotationId}`,
        { headers },
      );
      if (!docRes.ok) throw new Error("โหลดใบเสนอราคาไม่สำเร็จ");
      const docData = await docRes.json();
      const doc = docData.data || docData;
      // 📦 สินค้าชุด (Bundle/SET): แถวแม่ไม่มีสต๊อกของตัวเอง ไม่ต้องเช็ค — เช็คแค่แถวลูก/ส่วนประกอบ
      // ที่ไหลผ่านมาเป็นแถวปกติอยู่แล้ว (pattern เดียวกับที่ SaleDocumentController.php ใช้ตัด/คืนสต๊อกจริง)
      const items = (doc.items || [])
        .filter((item: any) => !item.product?.is_bundle)
        .map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }));

      if (items.length === 0) {
        setRows([]);
        return;
      }

      const checkRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/stock-balances/check`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        },
      );
      if (!checkRes.ok) throw new Error("เช็คสต๊อกไม่สำเร็จ");
      const checkData = await checkRes.json();
      setRows(checkData.data || []);
    } catch (error) {
      console.error("Error checking stock:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const hasShortfall = rows?.some((r) => !r.in_stock) ?? false;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl w-full max-w-5xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-indigo-500" />{" "}
            เช็คสินค้าตามใบเสนอราคา
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-background rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {quotations.length === 0 ? (
            <div className="text-center py-10">
              <PackageSearch className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium mb-4">
                ยังไม่มีใบเสนอราคาในโครงการนี้ กรุณาสร้างใบเสนอราคาก่อน
              </p>
              <button
                onClick={() =>
                  router.push(
                    `/sales/quotations/create?project_id=${projectId}`,
                  )
                }
                className="h-10 px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-800 text-white text-sm font-medium shadow-sm shadow-blue-600/20 transition-all hover:scale-102 transition-transform cursor-pointer"
              >
                สร้างใบเสนอราคา
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  เลือกใบเสนอราคา
                </label>
                <AppSelect
                  value={selectedQuotationId}
                  onValueChange={setSelectedQuotationId}
                  options={quotations.map((q) => ({
                    value: String(q.id),
                    label: q.document_number,
                  }))}
                />
              </div>

              {loading ? (
                <div className="text-center py-10 text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> กำลังเช็คสต๊อก...
                </div>
              ) : rows && rows.length > 0 ? (
                <div className="border border-border rounded-xl overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">
                          สินค้า
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          ต้องการ
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          มีในสต๊อก
                        </th>
                        <th className="px-4 py-2 text-center font-medium">
                          สถานะ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => (
                        <React.Fragment key={row.product_id}>
                          <tr
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() =>
                              setExpandedProduct(
                                expandedProduct === row.product_id
                                  ? null
                                  : row.product_id,
                              )
                            }
                          >
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-foreground">
                                {row.product_name}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <ChevronDown
                                  className={`w-3 h-3 transition-transform ${
                                    expandedProduct === row.product_id
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                                {row.sku}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {row.requested_qty}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {row.available_qty}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {row.in_stock ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                  <CheckCircle2 className="w-3 h-3" />{" "}
                                  มีสต๊อกเพียงพอ
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                  <AlertTriangle className="w-3 h-3" /> ขาด{" "}
                                  {row.shortfall_qty}
                                </span>
                              )}
                            </td>
                          </tr>
                          {expandedProduct === row.product_id && (
                            <tr className="bg-muted/50">
                              <td
                                colSpan={4}
                                className="px-4 py-2 text-xs text-muted-foreground"
                              >
                                {row.warehouses.length === 0 ? (
                                  <span>ไม่มีสต๊อกในคลังใดเลย</span>
                                ) : (
                                  <div className="flex flex-wrap gap-3">
                                    {row.warehouses.map((w) => (
                                      <span key={w.warehouse_id}>
                                        {w.warehouse_name}: <b>{w.qty}</b>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : rows && rows.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  ใบเสนอราคานี้ยังไม่มีรายการสินค้า
                </div>
              ) : null}

              {hasShortfall && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() =>
                      router.push(
                        `/purchase-orders/create?project_id=${projectId}`,
                      )
                    }
                    className="h-10 px-5 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium shadow-sm shadow-orange-600/20 transition-all hover:scale-102 transition-transform cursor-pointer"
                  >
                    สร้างใบสั่งซื้อ
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
