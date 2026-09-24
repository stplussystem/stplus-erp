// 🖨️ ระบบจัดวางเอกสารสำหรับกระดาษ A4 โดยเฉพาะ (โมดูลที่ 1/3 ของการแยกหน้าตั้งค่ากระดาษ) — แยกอิสระจาก
// letterLayoutDefaults.ts เดิมโดยสิ้นเชิง (ไฟล์นั้นยังใช้กับ Letter/Half Letter ต่อไปตามปกติ ไม่ถูกแตะ)
// จัดกลุ่มเอกสารใหม่ทั้งหมด 9 กลุ่ม (ต่างจาก 7 กลุ่มเดิมของ letterLayoutDefaults.ts) ตามที่ผู้ใช้ระบุไว้
// สำหรับหน้าตั้งค่า A4 โดยเฉพาะ — เอกสารประเภทเดียวกันอาจอยู่คนละกลุ่มระหว่างระบบ A4 นี้กับระบบ Letter เดิม
// (เช่น delivery_note อยู่กลุ่มตัวเองใน Letter แต่มารวมกับ tax_invoice/invoice ในกลุ่ม A4 นี้)
//
// พิกัดคำนวณตรงบนพื้นที่ A4 จริง (595x842pt) ไม่ผ่านการ rescale จากฐาน 612pt แบบไฟล์เดิม เพราะกลุ่มทั้งหมด
// เป็นของใหม่ ไม่มีค่าเดิมต้องรักษาความเข้ากันได้
//
// 🛡️ ตั้งใจไม่ import จาก letterLayoutDefaults.ts (แม้ค่า A4_PAGE_WIDTH/HEIGHT/absoluteStyle จะซ้ำกัน) เพราะ
// letterLayoutDefaults.ts เองต้อง import กลับมาจากไฟล์นี้ (getA4LayoutConfig/DOC_TYPE_TO_A4_GROUP) — import
// วนกลับไปกลับมาระหว่าง 2 ไฟล์เสี่ยงปัญหาลำดับโหลดโมดูล (module init order) จึง copy ค่าคงที่เล็กๆ นี้แยกไว้เอง

// A4 = 210 x 297 มม. ที่ 72 pt/นิ้ว (ค่ามาตรฐานของ react-pdf เมื่อ size="A4") — ค่าเดียวกับ letterLayoutDefaults.ts
export const A4_PAGE_WIDTH = 595;
export const A4_PAGE_HEIGHT = 842;

export type LetterLayoutBox = { x: number; y: number; width: number; height: number; visible?: boolean; showFill?: boolean };
export type LetterLayoutConfig = Record<string, LetterLayoutBox>;

// 🎨 helper วาง View แบบ absolute ตามกล่อง layout — ก๊อปจาก letterLayoutDefaults.ts ทุกประการ (ดูเหตุผลไม่ import ด้านบน)
export function absoluteStyle(box?: LetterLayoutBox): {
  position: "absolute";
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const b = box || { x: 0, y: 0, width: 100, height: 20 };
  return { position: "absolute", left: b.x, top: b.y, width: b.width, height: b.height };
}

export type A4LayoutGroup =
  | "quotation"
  | "po_contractor"
  | "tax_invoice_delivery"
  | "receipt"
  | "billing_cash_notes"
  | "goods_packing"
  | "stock_movement"
  | "custom_quotation"
  | "custom_cash";

export const A4_LAYOUT_GROUPS: { key: A4LayoutGroup; label: string }[] = [
  { key: "quotation", label: "ใบเสนอราคา" },
  { key: "po_contractor", label: "ใบสั่งซื้อ / ใบสั่งซื้อ-สั่งจ้าง (ผู้รับเหมา)" },
  { key: "tax_invoice_delivery", label: "ใบกำกับภาษี / ใบส่งสินค้าชั่วคราว / ใบแจ้งหนี้" },
  { key: "receipt", label: "ใบเสร็จรับเงิน" },
  { key: "billing_cash_notes", label: "ใบวางบิล / บิลเงินสด / ใบลดหนี้ / ใบเพิ่มหนี้" },
  { key: "goods_packing", label: "ใบรับสินค้า / ใบจัดสินค้า" },
  { key: "stock_movement", label: "เอกสารเคลื่อนไหวสต๊อก (ใบเบิก/คืนสินค้า)" },
  { key: "custom_quotation", label: "ใบเสนอราคา (แบบกำหนดเอง)" },
  { key: "custom_cash", label: "บิลเงินสด (แบบกำหนดเอง)" },
];

// 🗺️ ประเภทเอกสารจริง (document_type) แต่ละตัวอยู่กลุ่ม A4 ไหน — คนละชุดกับ DOC_TYPE_TO_LAYOUT_GROUP ใน
// letterLayoutDefaults.ts (ใช้เฉพาะ Letter/Half Letter) โดยตั้งใจ
export const DOC_TYPE_TO_A4_GROUP: Record<string, A4LayoutGroup> = {
  quotation: "quotation",
  purchase_order: "po_contractor",
  contractor_work_order: "po_contractor",
  tax_invoice: "tax_invoice_delivery",
  delivery_note: "tax_invoice_delivery",
  invoice: "tax_invoice_delivery",
  receipt: "receipt",
  billing_invoice: "billing_cash_notes",
  cash: "billing_cash_notes",
  credit_note: "billing_cash_notes",
  debit_note: "billing_cash_notes",
  goods_receipt: "goods_packing",
  packing_list: "goods_packing",
  stock_issue: "stock_movement",
  stock_return: "stock_movement",
  rental_stock_return: "stock_movement",
  material_issue: "stock_movement",
  // 🐛 [2026-09-24] ใบยืม/ใบคืนสินค้ายืมไม่มีราคา/VAT — ใช้กลุ่มเดียวกับเอกสารเคลื่อนไหวสต๊อก (เดิมตกไปใช้ layout shared)
  loan_issue: "stock_movement",
  loan_return: "stock_movement",
  custom_quotation: "custom_quotation",
  custom_cash: "custom_cash",
};

// 🧩 คีย์ไหนเป็น "คอลัมน์ตาราง" ต้องใช้ y/height ร่วมกันเสมอ — ทุกกลุ่มในระบบนี้ใช้ itemsTable กล่องเดียว (ไม่มี
// คอลัมน์แยกย่อยแบบ delivery_note เดิม) จึงไม่มีกลุ่มคอลัมน์ให้ sync เลย
export const A4_COLUMN_GROUPS: Record<A4LayoutGroup, string[][]> = {
  quotation: [], po_contractor: [], tax_invoice_delivery: [], receipt: [], billing_cash_notes: [],
  goods_packing: [], stock_movement: [], custom_quotation: [], custom_cash: [],
};

// 💰 กลุ่มที่ไม่มีราคา/VAT เลย (เอกสารเคลื่อนไหวสต๊อกล้วนๆ) — ไม่มี summary/grandTotalText
const NO_PRICE_GROUPS: A4LayoutGroup[] = ["goods_packing", "stock_movement"];
export const isNoPriceA4Group = (group: A4LayoutGroup) => NO_PRICE_GROUPS.includes(group);

// ✍️ ชุดลายเซ็นต่อกลุ่ม (แตกต่างกันตามลักษณะงานของเอกสารในกลุ่มนั้น)
type SigSet = "money" | "delivery" | "receipt" | "warehouse";
const SIGNATURE_SET: Record<A4LayoutGroup, SigSet> = {
  quotation: "money",
  po_contractor: "money",
  tax_invoice_delivery: "delivery",
  receipt: "receipt",
  billing_cash_notes: "money",
  goods_packing: "warehouse",
  stock_movement: "warehouse",
  custom_quotation: "money",
  custom_cash: "money",
};

const SIGNATURE_SECTIONS: Record<SigSet, { key: string; label: string }[]> = {
  money: [
    { key: "signatureLeft", label: "ลายเซ็นผู้รับสินค้า / ผู้รับวางบิล" },
    { key: "signatureRight", label: "ลายเซ็นผู้มีอำนาจลงนาม / ผู้รับเงิน" },
  ],
  // 🎗️ ใบส่งสินค้าชั่วคราวต้องการชุดลายเซ็น 4 ช่องของตัวเอง แต่ยังรวมกลุ่มกับใบกำกับภาษี/ใบแจ้งหนี้ที่ปกติใช้
  // แค่ signatureLeft/signatureRight — ใส่ไว้ทั้งคู่ (union) แล้วให้แอดมินติ๊กเปิด/ปิดเองตามจริงว่าใช้ชุดไหน
  delivery: [
    { key: "signatureLeft", label: "ลายเซ็นผู้รับสินค้า / ผู้รับวางบิล (สำหรับใบกำกับภาษี/ใบแจ้งหนี้)" },
    { key: "signatureRight", label: "ลายเซ็นผู้มีอำนาจลงนาม / ผู้รับเงิน (สำหรับใบกำกับภาษี/ใบแจ้งหนี้)" },
    { key: "signatureReceiver", label: "ลายเซ็นผู้รับของ (สำหรับใบส่งสินค้าชั่วคราว)" },
    { key: "signatureDelivered", label: "ลายเซ็นผู้ส่งของ (สำหรับใบส่งสินค้าชั่วคราว)" },
    { key: "signatureChecked", label: "ลายเซ็นผู้ตรวจสอบ (สำหรับใบส่งสินค้าชั่วคราว)" },
    { key: "companyStamp", label: "ตรา/ลายเซ็นบริษัทผู้ขาย" },
  ],
  receipt: [
    { key: "signaturePreparedBy", label: "ลายเซ็นผู้ออกเอกสาร" },
    { key: "signatureCollector", label: "ลายเซ็นผู้รับเงิน" },
    { key: "companyStamp", label: "ตรา/ลายเซ็นบริษัทผู้ขาย" },
  ],
  warehouse: [
    { key: "signatureLeft", label: "ลายเซ็นผู้เบิก/ผู้จัดสินค้า/ผู้รับสินค้า" },
    { key: "signatureRight", label: "ลายเซ็นผู้อนุมัติ/ผู้ส่งมอบสินค้า" },
  ],
};

// 📋 ส่วนประกอบเอกสารต่อกลุ่ม — โครงร่างเดียวกันทุกกลุ่ม (companyInfo → title → headerDivider → customerInfo →
// metaInfo → itemsTable → notes → customText → [summary + grandTotalText เฉพาะกลุ่มมีราคา] → ลายเซ็นตามชุดของกลุ่ม)
function buildSections(group: A4LayoutGroup): { key: string; label: string }[] {
  const base = [
    { key: "companyInfo", label: "ข้อมูลบริษัท (โลโก้/ชื่อ/ที่อยู่)" },
    { key: "title", label: "ชื่อเอกสาร" },
    { key: "headerDivider", label: "แถบสีคั่นหัวเอกสาร" },
    { key: "customerInfo", label: "ข้อมูลลูกค้า" },
    { key: "metaInfo", label: "เลขที่ / วันที่เอกสาร" },
    { key: "itemsTable", label: isNoPriceA4Group(group) ? "ตารางรายการสินค้า (ไม่มีราคา)" : "ตารางรายการสินค้า" },
    { key: "notes", label: "หมายเหตุ" },
    { key: "customText", label: "ข้อความแสดงเอง (กรอกเนื้อหาได้อิสระ)" },
  ];
  const summary = isNoPriceA4Group(group)
    ? []
    : [
        { key: "summary", label: "สรุปยอดเงิน" },
        { key: "grandTotalText", label: "จำนวนเงินเป็นตัวอักษร" },
      ];
  // 📝 ข้อความแจ้งลงชื่ออนุมัติสั่งซื้อ — เฉพาะใบเสนอราคา (ปกติ/แบบกำหนดเอง) เดิม hardcode ตำแหน่งลอยอิสระ ไม่มีกล่อง
  // ให้ลากได้ ตอนนี้ทำเป็นกล่องแยกให้ปรับตำแหน่งเองได้เหมือนส่วนอื่น
  const validityNote =
    group === "quotation" || group === "custom_quotation"
      ? [{ key: "quotationValidityNote", label: "ข้อความแจ้งลงชื่ออนุมัติสั่งซื้อ" }]
      : [];
  return [...base, ...summary, ...validityNote, ...SIGNATURE_SECTIONS[SIGNATURE_SET[group]]];
}

export const A4_LAYOUT_SECTIONS: Record<A4LayoutGroup, { key: string; label: string }[]> = Object.fromEntries(
  A4_LAYOUT_GROUPS.map((g) => [g.key, buildSections(g.key)]),
) as Record<A4LayoutGroup, { key: string; label: string }[]>;

const box = (
  x: number,
  y: number,
  width: number,
  height: number,
  visible = true,
  showFill = true,
): LetterLayoutBox => ({
  x, y, width, height, visible, showFill,
});

// 🎨 โครงพิกัดฐานร่วมกันทุกกลุ่ม (มีราคา) — ต่างกันแค่ชุดลายเซ็นด้านล่างสุด คำนวณตรงบนพื้นที่ A4 จริงเลย
// (595x842pt) ไม่ผ่าน rescale เหมือนไฟล์เดิม เพราะเป็นกลุ่มใหม่ทั้งหมด ไม่มีค่าเดิมต้องเข้ากันได้
function buildDefaultBoxes(group: A4LayoutGroup): LetterLayoutConfig {
  const w = A4_PAGE_WIDTH; // 595
  const common: LetterLayoutConfig = {
    companyInfo: box(30, 25, 300, 70),
    title: box(340, 25, w - 340 - 25, 46),
    headerDivider: box(0, 100, w, 8),
    customerInfo: box(30, 108, 330, 92),
    metaInfo: box(370, 108, w - 370 - 25, 92),
    itemsTable: box(30, 216, w - 60, isNoPriceA4Group(group) ? 400 : 270),
    notes: box(30, isNoPriceA4Group(group) ? 630 : 500, 330, 80),
    customText: box(30, isNoPriceA4Group(group) ? 720 : 590, w - 60, 40, false),
  };

  if (isNoPriceA4Group(group)) {
    return {
      ...common,
      // 🖨️ [2026-09-17] ผู้ใช้ยืนยันให้เอากรอบเส้นล้อมกล่องลายเซ็นออกทั้งหมดในกลุ่ม print-layouts-a4 (เฉพาะกรอบ
      // ลายเซ็น จุดอื่นไม่แตะ) — ใช้ showFill:false เหมือนกันทุกกลุ่มด้านล่าง แอดมินยังเปิดกลับได้เองจากหน้าตั้งค่า
      signatureLeft: box(60, 760, 200, 60, true, false),
      signatureRight: box(w - 260, 760, 200, 60, true, false),
    };
  }

  const withSummary: LetterLayoutConfig = {
    ...common,
    summary: box(370, 500, w - 370 - 25, 110),
    grandTotalText: box(370, 614, w - 370 - 25, 16),
    // 📝 ข้อความแจ้งลงชื่ออนุมัติสั่งซื้อ — เฉพาะใบเสนอราคา (ปกติ/แบบกำหนดเอง) วางต่อท้าย grandTotalText พอดี
    // (ประมาณตำแหน่งเดิมที่เคยคำนวณลอยอิสระใน SalesPdfTemplate.tsx)
    ...(group === "quotation" || group === "custom_quotation"
      ? { quotationValidityNote: box(30, 636, w - 60, 30) }
      : {}),
  };

  switch (SIGNATURE_SET[group]) {
    case "receipt":
      return {
        ...withSummary,
        signaturePreparedBy: box(60, 700, 180, 60, true, false),
        signatureCollector: box(w - 240, 700, 180, 60, true, false),
        companyStamp: box(w - 240, 764, 180, 50, false, false),
      };
    case "delivery":
      return {
        ...withSummary,
        // 🖨️ กลุ่มใบกำกับภาษี/ใบแจ้งหนี้ (A4) พิมพ์ทับกระดาษหัวจดหมายที่มีอยู่แล้ว — ไม่ควรมีเส้นกรอบล้อมกล่องลายเซ็น
        // (เหมือนกล่องลายเซ็นของกลุ่ม isPrintLayoutGroup โหมด Letter ที่ปิดเส้นกรอบไปแล้วก่อนหน้านี้) แอดมินยังเปิด
        // กลับได้เองจากหน้าตั้งค่า (showFill) ถ้าต้องการ
        signatureLeft: box(50, 700, 160, 55, true, false),
        signatureRight: box(w - 210, 700, 160, 55, true, false),
        signatureReceiver: box(30, 700, 130, 50, false, false),
        signatureDelivered: box(170, 700, 130, 50, false, false),
        signatureChecked: box(310, 700, 130, 50, false, false),
        companyStamp: box(w - 180, 758, 150, 50, false, false),
      };
    default:
      return {
        ...withSummary,
        // 🖨️ [2026-09-17] ผู้ใช้ยืนยันให้เอากรอบเส้นล้อมกล่องลายเซ็นออกทั้งหมดในกลุ่ม print-layouts-a4 (เฉพาะกรอบ
        // ลายเซ็น จุดอื่นไม่แตะ) — เดิมกลุ่มนี้ (money SigSet: quotation/po_contractor/billing_cash_notes/
        // custom_quotation/custom_cash) ยังมีกรอบอยู่ ตอนนี้ปิดให้เหมือนกลุ่มอื่นทั้งหมด
        signatureLeft: box(60, 700, 180, 60, true, false),
        signatureRight: box(w - 240, 700, 180, 60, true, false),
      };
  }
}

export const DEFAULT_A4_V2_LAYOUTS: Record<A4LayoutGroup, LetterLayoutConfig> = Object.fromEntries(
  A4_LAYOUT_GROUPS.map((g) => [g.key, buildDefaultBoxes(g.key)]),
) as Record<A4LayoutGroup, LetterLayoutConfig>;

// 🎨 สีแถบ headerDivider เริ่มต้นต่อกลุ่ม
export const DEFAULT_A4_V2_ACCENT_COLORS: Record<A4LayoutGroup, string> = {
  quotation: "#2563eb",
  po_contractor: "#f59e0b",
  tax_invoice_delivery: "#2563eb",
  receipt: "#7c3aed",
  billing_cash_notes: "#2563eb",
  goods_packing: "#10b981",
  stock_movement: "#0891b2",
  custom_quotation: "#2563eb",
  custom_cash: "#2563eb",
};

function normalizeColumnGroupsA4(layout: LetterLayoutConfig, group: A4LayoutGroup): LetterLayoutConfig {
  const groups = A4_COLUMN_GROUPS[group] || [];
  let result = layout;
  for (const columns of groups) {
    const anchorKey = columns[0];
    const anchor = result[anchorKey];
    if (!anchor) continue;
    for (const key of columns) {
      const current = result[key];
      if (!current) continue;
      if (current.y !== anchor.y || current.height !== anchor.height) {
        result = { ...result, [key]: { ...current, y: anchor.y, height: anchor.height } };
      }
    }
  }
  return result;
}

function parseDocSettings(companySettings: any): any {
  let docSettings = companySettings?.document_settings;
  if (typeof docSettings === "string") {
    try {
      docSettings = JSON.parse(docSettings);
    } catch (e) {
      docSettings = null;
    }
  }
  return docSettings;
}

// อ่าน layout ของกลุ่มหนึ่งๆ จาก companySettings.document_settings.a4v2_layout_groups.<group> — namespace ใหม่
// ทั้งหมด (a4v2_...) แยกขาดจาก a4_layout_groups เดิมที่ letter-layout/page.tsx ใช้ กันชนกันเด็ดขาด
//
// 🎯 ค่าเริ่มต้นของทุกกลุ่ม (ยกเว้น quotation เอง) ยึดตามค่าที่บันทึกไว้ล่าสุดของกลุ่ม "quotation" ก่อน (ถ้ามีคีย์
// กล่องนั้นตรงกัน) แล้วค่อย fallback ไปที่ default เดิมของกลุ่มนั้นๆ เอง — ทำให้ปรับ quotation ให้สวยแล้วกลุ่มอื่น
// ที่ยังไม่เคยปรับเองได้ค่าเริ่มต้นที่ดีตามไปด้วย (คีย์ลายเซ็นเฉพาะกลุ่มที่ quotation ไม่มีจะข้ามไป fallback
// ตามปกติ ไม่ต้องเช็คพิเศษ เพราะ quotationStored[key] จะเป็น undefined อยู่แล้ว)
export function getA4LayoutConfig(
  companySettings: any,
  group: A4LayoutGroup,
): { layout: LetterLayoutConfig; backgroundPath: string | null } {
  const docSettings = parseDocSettings(companySettings);
  const storedGroups = docSettings?.a4v2_layout_groups || {};
  const ownStored: LetterLayoutConfig = storedGroups[group] || {};
  const quotationStored: LetterLayoutConfig = group !== "quotation" ? storedGroups["quotation"] || {} : {};

  const merged: LetterLayoutConfig = {};
  for (const { key } of A4_LAYOUT_SECTIONS[group]) {
    merged[key] = ownStored[key] ?? quotationStored[key] ?? DEFAULT_A4_V2_LAYOUTS[group][key];
  }

  return {
    layout: normalizeColumnGroupsA4(merged, group),
    backgroundPath: docSettings?.a4v2_layout_background_paths?.[group] || null,
  };
}

export function getA4AccentColorV2(companySettings: any, group: A4LayoutGroup): string {
  const docSettings = parseDocSettings(companySettings);
  return docSettings?.a4v2_accent_colors?.[group] || DEFAULT_A4_V2_ACCENT_COLORS[group];
}

// อ่านค่าข้อความ "แสดงเอง" (customText) ที่แอดมินกรอกไว้ต่อกลุ่ม — เนื้อหาคงที่ ไม่ผูกกับเอกสารจริงแต่ละใบ
export function getA4CustomText(companySettings: any, group: A4LayoutGroup): string {
  const docSettings = parseDocSettings(companySettings);
  return docSettings?.a4v2_custom_texts?.[group] || "";
}

// 🎨 สีพื้นหลังกล่อง — ตั้งค่าเดียวใช้ร่วมกันทั้งเอกสาร A4 ทุกประเภท/ทุกกลุ่ม (ไม่แยกต่อกลุ่มเหมือนสีแถบหัวเอกสาร)
// 🛡️ เดิมเป็น "เส้นขอบกล่อง" (border stroke) แต่เส้นเดินขอบตรงมุมฉากไปชนกับกล่อง...BoxFull/supBox/sumBox เดิม
// ที่มีอยู่แล้ว (มุมโค้ง borderRadius:8) ทำให้เกิดเส้นซ้อนทับกันที่มุมกล่อง (บั๊กที่ผู้ใช้แจ้งมาพร้อมรูป) เปลี่ยนมาใช้
// พื้นหลังสี (fill) แทนตามที่ผู้ใช้ขอ — พื้นสีไม่มีเส้นขอบให้ไปชนกับกล่องด้านในเลย แก้บั๊กไปในตัว
export type A4FillOptions = { enabled: boolean; color: string };

// มุมโค้งคงที่ ไม่ให้ผู้ใช้ปรับ — กันมุมกล่องพื้นหลังเหลี่ยมโผล่ทะลุกรอบมนของกล่องเนื้อหาด้านใน (customerBoxFull ฯลฯ เดิม)
export const A4_BOX_FILL_RADIUS = 6;

export function getA4BoxFillStyle(
  box: LetterLayoutBox | undefined,
  opts: A4FillOptions,
): { backgroundColor?: string; borderRadius?: number } {
  if (!opts.enabled) return {};
  // 🛡️ ต้องเช็คแค่ === false เท่านั้น (undefined/ไม่มีคีย์นี้ = แสดงสีพื้นหลัง) เพราะ getA4LayoutConfig merge เป็น
  // ระดับกล่องทั้งก้อน กล่องเก่าที่บันทึกไว้ก่อนมี showFill จะไม่มีคีย์นี้เลย ต้องถือว่า "แสดง" เป็นค่าเริ่มต้นเสมอ
  if (box?.showFill === false) return {};
  return { backgroundColor: opts.color, borderRadius: A4_BOX_FILL_RADIUS };
}

export function getA4BoxFillColor(companySettings: any): string {
  const docSettings = parseDocSettings(companySettings);
  return docSettings?.a4v2_box_fill_color || "#ffffff";
}

// 🌫️ ขนาดของพื้นหลังจางเต็มหน้า (watermark) — ปรับได้เหมือนความจาง เดิมยึดเต็มกล่องตารางรายการสินค้าตายตัวเสมอ
export function getA4WatermarkSize(companySettings: any): number {
  const docSettings = parseDocSettings(companySettings);
  return typeof docSettings?.a4_watermark_size === "number" ? docSettings.a4_watermark_size : 100;
}

// 🌫️ ความจางของพื้นหลังจางเต็มหน้า (watermark) — เดิม hardcode opacity:0.08 ตายตัว ตอนนี้ปรับได้ที่หน้าตั้งค่า
export function getA4WatermarkOpacity(companySettings: any): number {
  const docSettings = parseDocSettings(companySettings);
  return typeof docSettings?.a4_watermark_opacity === "number" ? docSettings.a4_watermark_opacity : 8;
}
