// สูตรกลางคำนวณ subtotal/VAT/WHT/grand_total ของใบสั่งซื้อ (Purchase Order)
// รวมมาจาก 3 จุดเดิมที่เคยเขียนซ้ำ (list/create/edit) — ให้มีจุดคำนวณจริงจุดเดียว
// รองรับ override subtotal/vat_amount เอง (กรณีปัดเศษ/ให้ตรงกับผู้ขาย) ผ่าน subtotalOverride/vatAmountOverride

export interface POFinanceItem {
  total_price: number;
  wht_rate: number;
}

export interface POFinanceInput {
  items: POFinanceItem[];
  taxType: string; // "include" | "exclude" | "none"
  discountAmount: number;
  subtotalOverride?: number | null;
  vatAmountOverride?: number | null;
}

export interface POFinanceResult {
  itemSubtotal: number; // ผลรวมดิบจากรายการสินค้า (ไม่ผ่าน override)
  subtotal: number; // ค่าจริงที่ใช้คำนวณต่อ (= override ถ้ามี ไม่งั้น = itemSubtotal)
  discount: number;
  after_discount: number;
  computedVatAmount: number; // VAT ที่คำนวณได้ตามสูตร (ไม่ผ่าน override)
  vat_amount: number; // ค่าจริงที่ใช้ต่อ (= override ถ้ามี ไม่งั้น = computedVatAmount)
  wht_amount: number;
  grand_total: number; // ไม่หัก WHT ออก (WHT เป็นแค่ "ยอดสุทธิที่ต้องจ่าย" แยกต่างหาก)
  net_payable: number; // grand_total - wht_amount (display-only)
  subtotalDiffersSignificantly: boolean;
  vatDiffersSignificantly: boolean;
}

const DIFF_PERCENT_THRESHOLD = 0.01; // 1%
const DIFF_ABS_THRESHOLD = 5; // บาท

function differsSignificantly(computed: number, actual: number): boolean {
  const diff = Math.abs(computed - actual);
  const percentThreshold = Math.abs(computed) * DIFF_PERCENT_THRESHOLD;
  return diff > Math.max(percentThreshold, DIFF_ABS_THRESHOLD);
}

export function calculatePurchaseOrderFinance({
  items,
  taxType,
  discountAmount,
  subtotalOverride,
  vatAmountOverride,
}: POFinanceInput): POFinanceResult {
  let itemSubtotal = 0;
  let wht_amount = 0;
  items.forEach((item) => {
    const total = Number(item.total_price) || 0;
    const whtRate = Number(item.wht_rate) || 0;
    itemSubtotal += total;
    if (whtRate > 0) wht_amount += total * (whtRate / 100);
  });

  const subtotal =
    subtotalOverride !== undefined && subtotalOverride !== null
      ? subtotalOverride
      : itemSubtotal;

  const discount = Number(discountAmount) || 0;
  let after_discount = subtotal - discount;
  if (after_discount < 0) after_discount = 0;

  let computedVatAmount = 0;
  if (taxType === "exclude") {
    computedVatAmount = after_discount * 0.07;
  } else if (taxType === "include") {
    computedVatAmount = after_discount - after_discount / 1.07;
  }

  const vat_amount =
    vatAmountOverride !== undefined && vatAmountOverride !== null
      ? vatAmountOverride
      : computedVatAmount;

  // grand_total ไม่หัก WHT ออก — ตรงกับสูตร backend และหน้าจอที่แสดง
  let grand_total = after_discount;
  if (taxType === "exclude") {
    grand_total = after_discount + vat_amount;
  }
  // taxType === "include": vat_amount ซ่อนอยู่ใน after_discount แล้ว ไม่บวกซ้ำ
  // taxType === "none": grand_total = after_discount ตรงๆ

  const net_payable = grand_total - wht_amount;

  return {
    itemSubtotal,
    subtotal,
    discount,
    after_discount,
    computedVatAmount,
    vat_amount,
    wht_amount,
    grand_total,
    net_payable,
    subtotalDiffersSignificantly: differsSignificantly(itemSubtotal, subtotal),
    vatDiffersSignificantly: differsSignificantly(computedVatAmount, vat_amount),
  };
}
