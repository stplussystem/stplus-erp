"use client";

import React from "react";
import {
  Plus,
  Trash2,
  History,
  CheckCircle2,
  AlertCircle,
  ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";
import { AppSelect } from "@/components/ui/app-select";
import { AppTooltip } from "@/components/ui/app-tooltip";
import type { SaleDocumentItemRow } from "@/hooks/useSaleDocumentItems";

interface SaleDocumentItemsTableProps {
  items: SaleDocumentItemRow[];
  onSelectProduct: (index: number, productData: any) => void;
  onChangeField: (index: number, field: string, value: string | number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  hasError?: boolean;

  // 🔢 ปุ่มเลือก S/N ต่อแถว — มีเฉพาะโมดูลที่บังคับเลือก S/N จริง (cash-sales/tax-invoices/receipts/delivery-notes)
  showSerialPicker?: boolean;
  onOpenSerialPicker?: (index: number) => void;

  // 📜 ปุ่ม "ดูรายการขายล่าสุด" ต่อแถวสินค้า — มีเฉพาะโมดูล quotations
  showHistoryButton?: boolean;
  onOpenHistory?: (index: number) => void;
  historyEnabled?: boolean;

  // 🧾 ลำดับคอลัมน์ — "standard" (เริ่มต้น): quotation/billing_invoice/cash/credit_note/debit_note มีคอลัมน์ "ราคาก่อนลด" ด้วย
  // "compact": tax_invoice/receipt/delivery_note (template แยกที่ทำไปก่อนหน้า) — ไม่มีคอลัมน์ "ราคาก่อนลด" ลำดับคอลัมน์
  // ต่างกัน (จำนวน/หน่วยมาก่อนราคา/หน่วย) คงไว้ตามเดิม ไม่ใช่ scope ของงานสินค้าชุดที่จะไปเปลี่ยนเลย์เอาต์ตารางเดิม
  variant?: "standard" | "compact";

  // 🔒 ล็อกทุกแถวเป็นแสดงผลอย่างเดียว — ใช้เมื่อเอกสารดึงรายการมาจากใบเบิกสินค้า (material_issue) ที่อนุมัติแล้ว
  // ห้ามแก้ไขตัวเลขใดๆ เลย (จำนวน/ราคา/ส่วนลด/หัก ณ ที่จ่าย) ซ่อนปุ่มลบแถว/เพิ่มแถว/เลือก S/N ทั้งหมด
  readOnly?: boolean;

  // 💰 คอลัมน์ "ราคาต้นทุน" — มีเฉพาะโมดูล quotations/custom-quotations (ไว้คำนวณกำไร-ขาดทุน ไม่พิมพ์ในเอกสาร)
  // isCostEditable ให้ parent กำหนดเงื่อนไขว่าแถวไหนแก้ไขได้ (ปกติ: เอกสารเป็นงานเช่า + สินค้าเช่า/บริการ)
  // ค่าเริ่มต้น false = แสดงเป็นตัวเลข read-only เสมอ
  showCostPrice?: boolean;
  isCostEditable?: (item: SaleDocumentItemRow) => boolean;
}

// 📦 ตารางรายการสินค้าที่ใช้ร่วมกันทุกเอกสารขาย — รองรับแถวแม่/แถวลูกของ "สินค้าชุด (Bundle)":
// แถวลูกเยื้อง + พื้นหลังจาง + ไม่มีปุ่มลบ/ช่องราคาเป็นของตัวเอง (ราคา/ส่วนลด/หัก ณ ที่จ่าย = 0 เสมอ ควบคุมจากแถวแม่)
export function SaleDocumentItemsTable({
  items,
  onSelectProduct,
  onChangeField,
  onAdd,
  onRemove,
  hasError,
  showSerialPicker,
  onOpenSerialPicker,
  showHistoryButton,
  onOpenHistory,
  historyEnabled,
  variant = "standard",
  readOnly = false,
  showCostPrice = false,
  isCostEditable,
}: SaleDocumentItemsTableProps) {
  const isCompact = variant === "compact";

  const productNameCell = (item: SaleDocumentItemRow, index: number) => {
    if (readOnly) {
      return (
        <td className="px-4 py-3">
          <div className="font-bold text-foreground">
            {item.product_name || item.item_name}
          </div>
          {item.sku && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {item.sku}
            </div>
          )}
          {item.has_serial_number && (item.serials?.length || 0) > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold bg-muted text-muted-foreground w-fit">
              <ListOrdered className="w-3 h-3" /> S/N:{" "}
              {item.serials?.length || 0} รายการ
            </div>
          )}
        </td>
      );
    }
    return (
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <ProductSearchDropdown
              value={item.product_id}
              selectedSku={item.sku}
              selectedName={item.product_name}
              hasError={!!hasError && !item.product_id}
              onChange={(_val, productData) =>
                onSelectProduct(index, productData)
              }
            />
          </div>
          {showHistoryButton && (
            <AppTooltip label="ดูรายการขายล่าสุด">
              <button
                type="button"
                disabled={!historyEnabled || !item.product_id}
                onClick={() => onOpenHistory?.(index)}
                className="p-1.5 text-indigo-400 border border-border hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 rounded-lg shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <History className="w-4 h-4" />
              </button>
            </AppTooltip>
          )}
        </div>
        {item.is_bundle && (
          <input
            type="text"
            placeholder="ชื่อรายการที่แสดงในเอกสาร"
            className="mt-1.5 w-full h-9 px-3 border border-blue-200 bg-blue-50/40 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={item.item_name || ""}
            onChange={(e) => onChangeField(index, "item_name", e.target.value)}
          />
        )}
        {showSerialPicker && item.has_serial_number && (
          <button
            type="button"
            onClick={() => onOpenSerialPicker?.(index)}
            className={cn(
              "mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all",
              (item.serials?.length || 0) === item.quantity
                ? "bg-green-50 text-green-600 hover:bg-green-100"
                : "bg-amber-50 text-amber-600 hover:bg-amber-100",
            )}
          >
            {(item.serials?.length || 0) === item.quantity ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            <ListOrdered className="w-3 h-3" /> S/N: {item.serials?.length || 0}
            /{item.quantity}
          </button>
        )}
      </td>
    );
  };

  const quantityCell = (item: SaleDocumentItemRow, index: number) =>
    readOnly ? (
      <td className="px-4 py-3 text-center text-muted-foreground">
        {item.quantity}
      </td>
    ) : (
      <td className="px-4 py-3">
        <input
          type="number"
          min="0.1"
          step="any"
          className="w-full h-10 text-center border border-border rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          value={item.quantity}
          onChange={(e) => onChangeField(index, "quantity", e.target.value)}
        />
      </td>
    );

  const unitNameCell = (item: SaleDocumentItemRow, index: number) =>
    readOnly ? (
      <td className="px-4 py-3 text-center text-muted-foreground">
        {item.unit_name}
      </td>
    ) : (
      <td className="px-4 py-3">
        <input
          type="text"
          className="w-full h-10 text-center border border-border rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          value={item.unit_name}
          onChange={(e) => onChangeField(index, "unit_name", e.target.value)}
        />
      </td>
    );

  const unitPriceCell = (item: SaleDocumentItemRow, index: number) =>
    readOnly ? (
      <td className="px-4 py-3 text-right text-muted-foreground">
        {Number(item.unit_price).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        })}
      </td>
    ) : (
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          className="w-full h-10 text-right border border-border rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          value={item.unit_price}
          onChange={(e) => onChangeField(index, "unit_price", e.target.value)}
        />
      </td>
    );

  // 💰 ราคาต้นทุน — read-only เสมอ (แสดงค่าที่ดึงจากต้นทุนถัวเฉลี่ยอัตโนมัติ) ยกเว้นกรณีที่ parent อนุญาตให้แก้
  // (isCostEditable คืน true) ผ่าน readOnly ของทั้งตาราง ก็ยังบังคับ read-only เสมอเหมือนคอลัมน์อื่น
  const costPriceCell = (item: SaleDocumentItemRow, index: number) => {
    const editable = !readOnly && !!isCostEditable?.(item);
    return editable ? (
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          className="w-full h-10 text-right border border-amber-300 bg-amber-50/40 rounded-xl text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          value={item.cost_price ?? 0}
          onChange={(e) => onChangeField(index, "cost_price", e.target.value)}
        />
      </td>
    ) : (
      <td className="px-4 py-3 text-right text-muted-foreground">
        {Number(item.cost_price ?? 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        })}
      </td>
    );
  };

  const discountCell = (item: SaleDocumentItemRow, index: number) =>
    readOnly ? (
      <td className="px-4 py-3 text-right text-red-400">
        {Number(item.discount_amount).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        })}
      </td>
    ) : (
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          className="w-full h-10 text-right border border-border rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-red-500"
          value={item.discount_amount}
          onChange={(e) =>
            onChangeField(index, "discount_amount", e.target.value)
          }
        />
      </td>
    );

  const whtCell = (item: SaleDocumentItemRow, index: number) =>
    readOnly ? (
      <td className="px-4 py-3 text-center text-muted-foreground">
        {Number(item.wht_rate) > 0 ? `หัก ${item.wht_rate}%` : "ไม่หัก"}
      </td>
    ) : (
      <td className="px-4 py-3 text-center">
        <AppSelect
          value={String(item.wht_rate)}
          onValueChange={(v) => onChangeField(index, "wht_rate", v)}
          options={[
            { value: "0", label: "ไม่หัก" },
            { value: "1", label: "หัก 1%" },
            { value: "3", label: "หัก 3%" },
            { value: "5", label: "หัก 5%" },
          ]}
        />
      </td>
    );

  const totalCell = (item: SaleDocumentItemRow) => (
    <td className="px-4 py-3 text-right font-bold text-foreground bg-muted/50">
      {item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
    </td>
  );

  const removeCell = (index: number) => (
    <td className="px-4 py-3 text-center">
      <button
        onClick={() => onRemove(index)}
        disabled={items.length === 1}
        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 cursor-pointer transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </td>
  );

  const childDash = (extraClass?: string) => (
    <td className={cn("px-4 py-2.5 text-muted-foreground/50", extraClass)}>
      -
    </td>
  );

  return (
    <div className="border border-border rounded-2xl overflow-hidden mb-6 z-10 relative">
      <div className="overflow-x-auto hide-scrollbar">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
            <tr>
              <th className="px-4 py-3 w-10 text-center font-bold">#</th>
              <th className="px-4 py-3 font-bold min-w-[250px]">ชื่อสินค้า</th>
              {isCompact ? (
                <>
                  <th className="px-4 py-3 w-24 text-center font-bold">
                    จำนวน
                  </th>
                  <th className="px-4 py-3 w-24 text-center font-bold">
                    หน่วย
                  </th>
                  <th className="px-4 py-3 w-32 text-right font-bold">
                    ราคา/หน่วย
                  </th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 w-32 text-right font-bold">
                    ราคาต่อหน่วย
                  </th>
                  <th className="px-4 py-3 w-24 text-center font-bold">
                    จำนวน
                  </th>
                  <th className="px-4 py-3 w-24 text-center font-bold">
                    หน่วย
                  </th>
                  <th className="px-4 py-3 w-32 text-right font-bold">
                    ราคาก่อนลด
                  </th>
                </>
              )}
              {showCostPrice && (
                <th className="px-4 py-3 w-32 text-right font-bold text-amber-600">
                  ต้นทุน/หน่วย
                </th>
              )}
              <th className="px-4 py-3 w-28 text-right font-bold">ส่วนลด</th>
              <th className="px-4 py-3 w-28 text-center font-bold">
                หัก ณ ที่จ่าย
              </th>
              <th className="px-4 py-3 w-32 text-right font-bold">ราคารวม</th>
              <th className="px-4 py-3 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, index) => {
              const isChild = !!item._parentRowId;
              if (isChild) {
                return (
                  <tr key={item._rowId} className="bg-muted/40">
                    <td className="px-4 py-2.5 text-center text-muted-foreground/50">
                      <span className="text-xs">↳</span>
                    </td>
                    <td className="px-4 py-2.5 pl-8">
                      <span className="text-muted-foreground text-sm">
                        {item.product_name}
                      </span>
                      {item.sku && (
                        <span className="text-muted-foreground text-xs ml-2">
                          ({item.sku})
                        </span>
                      )}
                      {/* 🚀 จำนวน+หน่วยของแถวลูก ย้ายมารวมในชื่อรายการแทนคอลัมน์แยก (คอลัมน์จำนวน/หน่วยด้านล่างเลยแสดง "-" แทน) */}
                      <span className="text-muted-foreground text-xs ml-2">
                        — {item.quantity} {item.unit_name}
                      </span>
                      {!readOnly &&
                        showSerialPicker &&
                        item.has_serial_number && (
                          <button
                            type="button"
                            onClick={() => onOpenSerialPicker?.(index)}
                            className={cn(
                              "mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all",
                              (item.serials?.length || 0) === item.quantity
                                ? "bg-green-50 text-green-600 hover:bg-green-100"
                                : "bg-amber-50 text-amber-600 hover:bg-amber-100",
                            )}
                          >
                            {(item.serials?.length || 0) === item.quantity ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            <ListOrdered className="w-3 h-3" /> S/N:{" "}
                            {item.serials?.length || 0}/{item.quantity}
                          </button>
                        )}
                    </td>
                    {isCompact ? (
                      <>
                        {childDash("text-center")}
                        {childDash("text-center")}
                        {childDash("text-right")}
                      </>
                    ) : (
                      <>
                        {childDash("text-right")}
                        {childDash("text-center")}
                        {childDash("text-center")}
                        {childDash("text-right")}
                      </>
                    )}
                    {showCostPrice && childDash("text-right")}
                    {childDash("text-right")}
                    {childDash("text-center")}
                    {childDash("text-right")}
                    <td className="px-4 py-2.5 text-center"></td>
                  </tr>
                );
              }

              return (
                <tr key={item._rowId} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {index + 1}
                  </td>
                  {productNameCell(item, index)}
                  {isCompact ? (
                    <>
                      {quantityCell(item, index)}
                      {unitNameCell(item, index)}
                      {unitPriceCell(item, index)}
                    </>
                  ) : (
                    <>
                      {unitPriceCell(item, index)}
                      {quantityCell(item, index)}
                      {unitNameCell(item, index)}
                      <td className="px-4 py-3 text-right text-muted-foreground bg-muted/30">
                        {(item.quantity * item.unit_price).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                          },
                        )}
                      </td>
                    </>
                  )}
                  {showCostPrice && costPriceCell(item, index)}
                  {discountCell(item, index)}
                  {whtCell(item, index)}
                  {totalCell(item)}
                  {readOnly ? <td className="px-4 py-3" /> : removeCell(index)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="p-3 border-t border-border bg-muted/50">
          <button
            onClick={onAdd}
            className="text-blue-600 text-sm font-bold flex items-center gap-1.5 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> เพิ่มแถวสินค้า
          </button>
        </div>
      )}
    </div>
  );
}
