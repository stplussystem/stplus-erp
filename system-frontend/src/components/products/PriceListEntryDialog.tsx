"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { Loader2, Tags } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";
import { VendorSearchDropdown } from "@/components/products/VendorSearchDropdown";

type VendorOption = { id: number; business_name?: string; contact_person_name?: string };

interface PriceListEntryDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  vendors: VendorOption[];
  entry?: any | null; // null/undefined = โหมดเพิ่มใหม่
}

// 🚀 ฟอร์มเพิ่ม/แก้ไขรายการ Price List ทีละแถวด้วยมือ (คู่กับการนำเข้า Excel แบบเยอะๆ ใน
// PriceListExcelActions.tsx) — แก้ไขได้แค่ ราคา/ส่วนลด/สถานะ/วันสิ้นสุดราคา/หมายเหตุ ส่วนสินค้า+ผู้จำหน่าย
// ล็อกไว้ตอนแก้ไข (เปลี่ยนไม่ได้ เพราะคีย์ unique คือคู่นี้ — ถ้าอยากเปลี่ยนสินค้า/ผู้จำหน่ายให้ลบแล้วสร้างใหม่)
export function PriceListEntryDialog({ open, onClose, onSaved, vendors, entry }: PriceListEntryDialogProps) {
  const isEdit = !!entry;
  const [productId, setProductId] = useState("");
  const [productSku, setProductSku] = useState("");
  const [productName, setProductName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [price, setPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [priceTrend, setPriceTrend] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (entry) {
      setProductId(String(entry.product_id));
      setProductSku(entry.product?.sku || "");
      setProductName(entry.product?.name || "");
      setVendorId(String(entry.contact_id));
      setPrice(String(entry.price ?? ""));
      setDiscountPercent(entry.discount_percent != null ? String(entry.discount_percent) : "");
      setPriceTrend(entry.price_trend || "");
      setExpiryDate(entry.expiry_date ? String(entry.expiry_date).slice(0, 10) : "");
      setNote(entry.note || "");
    } else {
      setProductId("");
      setProductSku("");
      setProductName("");
      setVendorId("");
      setPrice("");
      setDiscountPercent("");
      setPriceTrend("");
      setExpiryDate("");
      setNote("");
    }
  }, [open, entry]);

  const trendOptions = [
    { value: "up", label: "ราคาขึ้น" },
    { value: "down", label: "ราคาลง" },
    { value: "stable", label: "ราคาคงที่" },
  ];

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!productId) newErrors.product_id = "กรุณาเลือกสินค้า";
    if (!vendorId) newErrors.contact_id = "กรุณาเลือกผู้จำหน่าย";
    if (!price || isNaN(Number(price)) || Number(price) < 0) newErrors.price = "กรุณากรอกราคาที่ถูกต้อง";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        product_id: Number(productId),
        contact_id: Number(vendorId),
        price: Number(price),
        discount_percent: discountPercent ? Number(discountPercent) : null,
        price_trend: priceTrend || null,
        expiry_date: expiryDate || null,
        note: note || null,
      };

      if (isEdit) {
        await apiFetch(`/product-price-lists/${entry.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await apiFetch("/product-price-lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }

      toast.success("บันทึกราคาสำเร็จ");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Tags className="w-4 h-4 text-purple-600" />
            {isEdit ? "แก้ไขรายการ Price List" : "เพิ่มรายการ Price List"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">สินค้า</Label>
            {isEdit ? (
              <div className="h-10 px-4 flex items-center rounded-xl border border-border bg-muted/50 text-sm">
                <span className="font-bold text-blue-600 mr-2">[{productSku}]</span> {productName}
              </div>
            ) : (
              <ProductSearchDropdown
                value={productId}
                selectedSku={productSku}
                selectedName={productName}
                hasError={!!errors.product_id}
                onChange={(id, data) => {
                  setProductId(id);
                  setProductSku(data.sku);
                  setProductName(data.name);
                  setErrors((prev) => ({ ...prev, product_id: "" }));
                }}
              />
            )}
            {errors.product_id && <p className="text-red-500 text-xs font-medium mt-1">{errors.product_id}</p>}
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">ผู้จำหน่าย</Label>
            {isEdit ? (
              <div className="h-10 px-4 flex items-center rounded-xl border border-border bg-muted/50 text-sm">
                {vendors.find((v) => String(v.id) === vendorId)?.business_name || "-"}
              </div>
            ) : (
              <VendorSearchDropdown
                value={vendorId}
                vendors={vendors}
                onChange={(v) => {
                  setVendorId(v);
                  setErrors((prev) => ({ ...prev, contact_id: "" }));
                }}
                hasError={!!errors.contact_id}
              />
            )}
            {errors.contact_id && <p className="text-red-500 text-xs font-medium mt-1">{errors.contact_id}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1 block">ราคาที่ผู้จำหน่ายตั้ง</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setErrors((prev) => ({ ...prev, price: "" }));
                }}
                className={cn(
                  "w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm",
                  errors.price && "border-red-500 focus:border-red-500 focus:ring-red-100",
                )}
              />
              {errors.price && <p className="text-red-500 text-xs font-medium mt-1">{errors.price}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1 block">ส่วนลด (%) — แสดงผลอย่างเดียว</Label>
              <Input
                type="number"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะ (ว่าง = คำนวณอัตโนมัติ)</Label>
              <AppSelect
                value={priceTrend}
                onValueChange={setPriceTrend}
                options={trendOptions}
                placeholder="-- คำนวณอัตโนมัติ --"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1 block">วันสิ้นสุดราคา</Label>
              <AppDatePicker value={expiryDate} onChange={setExpiryDate} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">หมายเหตุ</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              rows={2}
            />
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "บันทึก"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
