"use client";

import { useCallback, useState } from "react";

// 📦 แถวสินค้าในตารางเอกสารขาย — รองรับ "สินค้าชุด (Bundle)":
// แถวแม่ (is_bundle=true) ขายเป็น 1 บรรทัดราคาเดียว ชื่อแก้ไขได้ (item_name)
// แถวลูก/ส่วนประกอบ (_parentRowId ชี้ไปแถวแม่) ราคา/ส่วนลด/ภาษีเป็น 0 เสมอ ใช้แค่ตัดสต๊อกจริงตอนอนุมัติ
export interface SaleDocumentItemRow {
  _rowId: string;
  _parentRowId?: string | null;
  // จำนวนส่วนประกอบต่อสินค้าชุด 1 หน่วย — ใช้คำนวณ quantity ของแถวลูกใหม่เมื่อแถวแม่แก้จำนวน
  _componentQtyPerUnit?: number;
  product_id: string;
  product_name: string;
  sku: string;
  item_name?: string;
  quantity: number;
  unit_name: string;
  unit_price: number;
  discount_amount: number;
  discount_percent?: number | null;
  wht_rate: number;
  total_price: number;
  has_serial_number?: boolean;
  serials?: string[];
  is_bundle?: boolean;
}

let clientRowSeq = 0;
function newRowId() {
  clientRowSeq += 1;
  return `c${Date.now()}_${clientRowSeq}`;
}

export function emptyItemRow(): SaleDocumentItemRow {
  return {
    _rowId: newRowId(),
    product_id: "",
    product_name: "",
    sku: "",
    quantity: 1,
    unit_name: "ชิ้น",
    unit_price: 0,
    discount_amount: 0,
    wht_rate: 0,
    total_price: 0,
    has_serial_number: false,
    serials: [],
  };
}

function recalcTotal(item: SaleDocumentItemRow): SaleDocumentItemRow {
  return {
    ...item,
    total_price: item.quantity * item.unit_price - (Number(item.discount_amount) || 0),
  };
}

export function useSaleDocumentItems(initial?: SaleDocumentItemRow[]) {
  const [items, setItems] = useState<SaleDocumentItemRow[]>(
    initial && initial.length > 0 ? initial : [emptyItemRow()],
  );

  // โหลดข้อมูลจากเอกสารที่มีอยู่แล้ว (หน้าแก้ไข) — ใช้ id จริงจาก backend เป็น _rowId ตรงๆ
  // เพื่อให้ parent_item_id ที่มีอยู่แล้วแมปกลับมาเป็น _parentRowId ได้ถูกต้องทันทีโดยไม่ต้องคำนวณใหม่
  const loadFromDocument = useCallback((docItems: any[]) => {
    if (!docItems || docItems.length === 0) {
      setItems([emptyItemRow()]);
      return;
    }
    const rows: SaleDocumentItemRow[] = docItems.map((item: any) => ({
      _rowId: String(item.id),
      _parentRowId: item.parent_item_id ? String(item.parent_item_id) : null,
      product_id: item.product_id?.toString() || "",
      product_name: item.product?.name || "",
      sku: item.product?.sku || "",
      item_name: item.item_name || "",
      quantity: Number(item.quantity) || 1,
      unit_name: item.unit_name || "ชิ้น",
      unit_price: Number(item.unit_price) || 0,
      discount_amount: Number(item.discount_amount) || 0,
      wht_rate: Number(item.wht_rate) || 0,
      total_price: Number(item.total_price) || 0,
      has_serial_number: !!item.product?.has_serial_number,
      serials: (item.serials || []).map((s: any) => s.serial_number || s),
      is_bundle: !!item.product?.is_bundle,
    }));
    setItems(rows);
  }, []);

  // เลือกสินค้าในแถว index — ถ้าเป็นสินค้าชุด (bundle) จะขยายแถวลูก/ส่วนประกอบอัตโนมัติต่อจากแถวนี้ทันที
  const selectProduct = useCallback((index: number, productData: any) => {
    setItems((prev) => {
      const current = prev[index];
      const rowId = current._rowId;
      const isBundle =
        !!productData.is_bundle &&
        Array.isArray(productData.bundle_items) &&
        productData.bundle_items.length > 0;

      const updatedParent: SaleDocumentItemRow = recalcTotal({
        ...current,
        product_id: String(productData.id),
        product_name: productData.name,
        sku: productData.sku,
        // 🚀 ดึงหน่วยที่ตั้งไว้ในสินค้ามาเติมให้อัตโนมัติ (ProductController::index() eager-load
        // relation "unit" มาด้วยอยู่แล้ว) — ยังแก้ไขเองได้ตามปกติผ่านช่องหน่วยที่เป็น input ข้อความอยู่แล้ว
        unit_name: productData.unit?.name || current.unit_name || "ชิ้น",
        unit_price: Number(productData.price || 0),
        has_serial_number: !!productData.has_serial_number,
        serials: [],
        is_bundle: isBundle,
        item_name: isBundle ? productData.name : "",
      });

      // ลบแถวลูกเดิมของแถวนี้ทิ้งก่อน (เผื่อเคยเลือกสินค้าชุดอื่นมาก่อน) แล้วค่อยแทรกชุดใหม่ถ้าจำเป็น
      const withoutOldChildren = prev.filter((it) => it._parentRowId !== rowId);
      const parentIndexInFiltered = withoutOldChildren.findIndex((it) => it._rowId === rowId);
      const next = [...withoutOldChildren];
      next[parentIndexInFiltered] = updatedParent;

      if (isBundle) {
        const childRows: SaleDocumentItemRow[] = productData.bundle_items.map((bi: any) => ({
          _rowId: newRowId(),
          _parentRowId: rowId,
          _componentQtyPerUnit: Number(bi.quantity) || 0,
          product_id: String(bi.component_product_id),
          product_name: bi.name || "",
          sku: bi.sku || "",
          quantity: (Number(bi.quantity) || 0) * (Number(updatedParent.quantity) || 1),
          unit_name: bi.unit_name || "ชิ้น",
          unit_price: 0,
          discount_amount: 0,
          wht_rate: 0,
          total_price: 0,
          has_serial_number: !!bi.has_serial_number,
          serials: [],
        }));
        next.splice(parentIndexInFiltered + 1, 0, ...childRows);
      }

      return next;
    });
  }, []);

  // แก้ไขค่าฟิลด์ของแถว index — ถ้าเป็นแถวแม่สินค้าชุดและแก้ quantity จะคำนวณ quantity แถวลูกในกลุ่มเดียวกันใหม่ให้อัตโนมัติ
  const updateItem = useCallback((index: number, field: string, value: string | number) => {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const val =
        field === "product_id" || field === "unit_name" || field === "item_name"
          ? value
          : Number(value) || 0;
      let updated = recalcTotal({ ...current, [field]: val } as SaleDocumentItemRow);
      // 🔢 แก้จำนวนของแถวที่คุม S/N ต้องเลือก S/N ใหม่เสมอ (ของเดิมอาจไม่ครบ/เกินจำนวนใหม่แล้ว)
      if (field === "quantity" && current.has_serial_number) {
        updated = { ...updated, serials: [] };
      }
      const next = [...prev];
      next[index] = updated;

      if (field === "quantity" && current.is_bundle) {
        const rowId = current._rowId;
        const newQty = Number(value) || 0;
        return next.map((it) =>
          it._parentRowId === rowId
            ? recalcTotal({ ...it, quantity: (it._componentQtyPerUnit || 0) * newQty })
            : it,
        );
      }
      return next;
    });
  }, []);

  const updateItemSerials = useCallback((index: number, serials: string[]) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], serials };
      return next;
    });
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItemRow()]);
  }, []);

  // ลบแถว index — ถ้าเป็นแถวแม่สินค้าชุด ลบแถวลูกทั้งกลุ่มไปด้วย
  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const target = prev[index];
      if (!target) return prev;
      return prev.filter((it, i) => i !== index && it._parentRowId !== target._rowId);
    });
  }, []);

  // แปลง state เป็น payload สำหรับส่งเข้า backend — แปลง _parentRowId (client-only) เป็น parent_index (ตำแหน่งใน array)
  const buildPayload = useCallback(() => {
    return items.map((item) => {
      const payload: Record<string, any> = {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_name: item.unit_name,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent ?? null,
        discount_amount: item.discount_amount,
        wht_rate: item.wht_rate,
        wht_amount: item.total_price * (item.wht_rate / 100),
        total_price: item.total_price,
        serials: item.serials || [],
      };
      if (item.item_name) payload.item_name = item.item_name;
      if (item._parentRowId) {
        const parentIndex = items.findIndex((it) => it._rowId === item._parentRowId);
        if (parentIndex >= 0) payload.parent_index = parentIndex;
      }
      return payload;
    });
  }, [items]);

  return {
    items,
    setItems,
    loadFromDocument,
    selectProduct,
    updateItem,
    updateItemSerials,
    addItem,
    removeItem,
    buildPayload,
  };
}
