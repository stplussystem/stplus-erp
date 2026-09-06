// ค่ากลางของ layout การพิมพ์เฉพาะกลุ่ม (tax_invoice / receipt) — แยกอิสระจาก letterLayoutDefaults.ts เดิม
// (ของเดิมยังใช้ร่วมกันสำหรับ quotation/billing_invoice/cash/credit_note/debit_note ต่อไป ไม่แตะ)
// หน่วยเป็น pt ตรงกับ @react-pdf/renderer เหมือนไฟล์เดิม — เพจกระดาษ Letter ขนาดเท่ากัน (612x792pt)
//
// 🖨️ ปรับใหญ่: delivery_note ย้ายออกจากไฟล์นี้ไปเป็นกลุ่มใหม่ใน letterLayoutDefaults.ts แล้ว (ดูที่นั่น)
// เหลือแค่ tax_invoice/receipt ที่ยังพิมพ์ทับกระดาษหัวจดหมายเดิม (ไม่มีเส้นกรอบ/พื้นหลังที่ระบบวาดเอง)
// กล่องรวมเดิม (customerInfo/metaInfo/itemsTable/summary) ถูกแยกเป็นกล่องย่อยอิสระทั้งหมดตามคำขอ

export type PrintLayoutBox = { x: number; y: number; width: number; height: number; visible?: boolean };
export type PrintLayoutConfig = Record<string, PrintLayoutBox>;

// 🖨️ ขนาดกระดาษต่อเนื่อง 9x11 จริงเหมือน LETTER_PAGE_WIDTH/HEIGHT ใน letterLayoutDefaults.ts (ตัวเอกสารกว้าง
// 8 นิ้ว สูง 11 นิ้ว = 576x792pt ไม่ใช่ Letter มาตรฐาน 8.5x11 — ดูคอมเมนต์เต็มที่ letterLayoutDefaults.ts)
export const PRINT_PAGE_WIDTH = 576;
export const PRINT_PAGE_HEIGHT = 792;

export type PrintLayoutGroup = "tax_invoice" | "receipt";

export const PRINT_LAYOUT_GROUPS: { key: PrintLayoutGroup; label: string }[] = [
  { key: "tax_invoice", label: "ใบกำกับภาษี / ใบส่งสินค้า" },
  { key: "receipt", label: "ใบเสร็จรับเงิน" },
];

// 🧩 คีย์ไหนเป็น "คอลัมน์ตาราง" ที่ต้องใช้ y/height ร่วมกันเสมอ (แยกอิสระได้แค่ x/ความกว้าง)
// ระดับโค้ดเท่านั้น ไม่เก็บลง DB — ใช้คู่กับ normalizeColumnGroups() ทั้งตอนแก้ไขและตอน render จริง
export const COLUMN_GROUPS: Record<PrintLayoutGroup, string[][]> = {
  tax_invoice: [["colNo", "colCode", "colDesc", "colQty", "colUnitPrice", "colAmount"]],
  receipt: [["colNo", "colInvoiceNumber", "colDate", "colDueDate", "colAmount", "colOutstanding", "colPayment"]],
};

// tax_invoice/receipt: พิมพ์เฉพาะข้อความลงกระดาษหัวจดหมายที่มีอยู่แล้ว (ไม่มีเส้นกรอบ/เส้นใต้ที่ระบบวาดเอง)
export const PRINT_LAYOUT_SECTIONS: Record<PrintLayoutGroup, { key: string; label: string }[]> = {
  tax_invoice: [
    { key: "title", label: "ชื่อเอกสาร / ต้นฉบับ" },
    { key: "customerName", label: "ข้อมูลลูกค้า: ชื่อบริษัท" },
    { key: "customerAddress", label: "ข้อมูลลูกค้า: ที่อยู่" },
    { key: "customerTaxId", label: "ข้อมูลลูกค้า: เลขประจำตัวผู้เสียภาษี" },
    { key: "metaDocNumber", label: "เลขที่เอกสาร" },
    { key: "metaDate", label: "วันที่ (กดเพิ่มจุดซ้ำได้)" },
    { key: "metaPaymentTerm", label: "เงื่อนไขการชำระเงิน" },
    { key: "metaDueDate", label: "กำหนดชำระ" },
    { key: "metaTransportation", label: "การขนส่ง" },
    { key: "metaSalesman", label: "รหัสพนักงานขาย" },
    { key: "metaPoNumber", label: "เลขที่ใบสั่งซื้อ" },
    { key: "colNo", label: "ตารางสินค้า: ลำดับ" },
    { key: "colCode", label: "ตารางสินค้า: รหัสสินค้า" },
    { key: "colDesc", label: "ตารางสินค้า: รายละเอียด" },
    { key: "colQty", label: "ตารางสินค้า: จำนวน/หน่วย" },
    { key: "colUnitPrice", label: "ตารางสินค้า: ราคา/หน่วย" },
    { key: "colAmount", label: "ตารางสินค้า: จำนวนเงิน" },
    { key: "remark", label: "หมายเหตุ" },
    { key: "summarySubtotal", label: "สรุปยอด: รวมเป็นเงิน" },
    { key: "summaryDiscount", label: "สรุปยอด: หักส่วนลด" },
    { key: "summaryAfterDiscount", label: "สรุปยอด: หลังหักส่วนลด/มัดจำ" },
    { key: "summaryVat", label: "สรุปยอด: ภาษีมูลค่าเพิ่ม" },
    { key: "summaryGrandTotal", label: "สรุปยอด: รวมทั้งสิ้น" },
    { key: "summaryGrandTotalText", label: "สรุปยอด: จำนวนเงินเป็นตัวอักษร" },
    { key: "signatureReceiver", label: "ลายเซ็นผู้รับสินค้า" },
    { key: "signatureDelivered", label: "ลายเซ็นผู้ส่งของ" },
    { key: "signatureChecked", label: "ลายเซ็นผู้ตรวจสอบ" },
    { key: "companyStamp", label: "ตรา/ลายเซ็นบริษัทผู้ขาย" },
  ],
  receipt: [
    { key: "title", label: "ชื่อเอกสาร / ต้นฉบับ" },
    { key: "customerName", label: "ข้อมูลลูกค้า: ชื่อบริษัท" },
    { key: "customerAddress", label: "ข้อมูลลูกค้า: ที่อยู่" },
    { key: "customerTaxId", label: "ข้อมูลลูกค้า: เลขประจำตัวผู้เสียภาษี" },
    { key: "metaDocNumber", label: "เลขที่ใบเสร็จ" },
    { key: "metaDate", label: "วันที่ (กดเพิ่มจุดซ้ำได้)" },
    { key: "colNo", label: "ตารางอ้างอิง: ลำดับ" },
    { key: "colInvoiceNumber", label: "ตารางอ้างอิง: เลขที่ใบกำกับ" },
    { key: "colDate", label: "ตารางอ้างอิง: วันที่" },
    { key: "colDueDate", label: "ตารางอ้างอิง: วันครบกำหนด" },
    { key: "colAmount", label: "ตารางอ้างอิง: จำนวนเงิน" },
    { key: "colOutstanding", label: "ตารางอ้างอิง: ยอดคงค้าง" },
    { key: "colPayment", label: "ตารางอ้างอิง: ยอดชำระ" },
    { key: "remark", label: "หมายเหตุ" },
    { key: "summaryTotal", label: "สรุปยอด: รวมจำนวนเงิน" },
    { key: "summaryVat", label: "สรุปยอด: ภาษีมูลค่าเพิ่ม" },
    { key: "summaryGrandTotal", label: "สรุปยอด: รวมทั้งสิ้น" },
    { key: "summaryGrandTotalText", label: "สรุปยอด: จำนวนเงินเป็นตัวอักษร" },
    { key: "signaturePreparedBy", label: "ลายเซ็นผู้ออกเอกสาร" },
    { key: "signatureCollector", label: "ลายเซ็นผู้รับเงิน" },
    { key: "companyStamp", label: "ตรา/ลายเซ็นบริษัทผู้ขาย" },
  ],
};

const box = (x: number, y: number, width: number, height: number): PrintLayoutBox => ({ x, y, width, height, visible: true });

// 🖨️ พิกัดด้านล่างออกแบบไว้ตอนกระดาษกว้าง 612pt (Letter มาตรฐานเดิม) — ตอนนี้กระดาษต่อเนื่องจริงกว้างแค่ 576pt
// (ดู PRINT_PAGE_WIDTH ด้านบน) ย่อ x/width ตามสัดส่วนอัตโนมัติตอนประกาศ DEFAULT_PRINT_LAYOUTS ด้านล่าง ไม่พิมพ์
// พิกัดใหม่เอง (เสี่ยงพิมพ์ผิด) เหมือนวิธีที่ใช้กับ letterLayoutDefaults.ts
const RAW_PRINT_PAGE_WIDTH = 612;
const RAW_PRINT_LAYOUTS: Record<PrintLayoutGroup, PrintLayoutConfig> = {
  tax_invoice: {
    title: box(400, 30, 182, 50),
    customerName: box(30, 130, 330, 16),
    customerAddress: box(30, 148, 330, 26),
    customerTaxId: box(30, 176, 330, 16),
    metaDocNumber: box(370, 130, 212, 14),
    metaDate: box(370, 146, 212, 14),
    metaPaymentTerm: box(370, 162, 212, 14),
    metaDueDate: box(370, 178, 212, 14),
    metaTransportation: box(370, 194, 106, 14),
    metaSalesman: box(476, 194, 106, 14),
    metaPoNumber: box(370, 210, 212, 14),
    colNo: box(30, 245, 33, 250),
    colCode: box(63, 245, 77, 250),
    colDesc: box(140, 245, 215, 250),
    colQty: box(355, 245, 77, 250),
    colUnitPrice: box(432, 245, 71, 250),
    colAmount: box(503, 245, 79, 250),
    remark: box(30, 505, 330, 60),
    summarySubtotal: box(370, 505, 212, 14),
    summaryDiscount: box(370, 521, 212, 14),
    summaryAfterDiscount: box(370, 537, 212, 14),
    summaryVat: box(370, 553, 212, 14),
    summaryGrandTotal: box(370, 569, 212, 16),
    // 🛡️ height 16pt (เดิม 14pt) กันข้อความ "จำนวนเงินเป็นตัวอักษร" ถูก react-pdf ตัดทิ้งถ้ากล่องเตี้ยเกินไป
    summaryGrandTotalText: box(370, 587, 212, 16),
    signatureReceiver: box(30, 615, 170, 55),
    signatureDelivered: box(215, 615, 170, 55),
    signatureChecked: box(400, 615, 170, 55),
    companyStamp: box(400, 680, 182, 80),
  },
  receipt: {
    title: box(400, 30, 182, 50),
    customerName: box(30, 130, 330, 16),
    customerAddress: box(30, 148, 330, 26),
    customerTaxId: box(30, 176, 330, 16),
    metaDocNumber: box(370, 130, 212, 14),
    metaDate: box(370, 146, 212, 14),
    colNo: box(30, 230, 28, 220),
    colInvoiceNumber: box(58, 230, 138, 220),
    colDate: box(196, 230, 72, 220),
    colDueDate: box(268, 230, 72, 220),
    colAmount: box(340, 230, 83, 220),
    colOutstanding: box(423, 230, 83, 220),
    colPayment: box(506, 230, 76, 220),
    remark: box(30, 460, 330, 60),
    summaryTotal: box(370, 460, 212, 14),
    summaryVat: box(370, 476, 212, 14),
    summaryGrandTotal: box(370, 492, 212, 16),
    // 🛡️ height 16pt (เดิม 14pt) กันข้อความ "จำนวนเงินเป็นตัวอักษร" ถูก react-pdf ตัดทิ้งถ้ากล่องเตี้ยเกินไป
    summaryGrandTotalText: box(370, 510, 212, 16),
    signaturePreparedBy: box(60, 610, 180, 55),
    signatureCollector: box(260, 610, 180, 55),
    companyStamp: box(400, 675, 182, 80),
  },
};

function rescalePrintWidthRaw(config: PrintLayoutConfig): PrintLayoutConfig {
  const sx = PRINT_PAGE_WIDTH / RAW_PRINT_PAGE_WIDTH;
  return Object.fromEntries(
    Object.entries(config).map(([key, b]) => [key, { ...b, x: b.x * sx, width: b.width * sx }]),
  );
}

export const DEFAULT_PRINT_LAYOUTS: Record<PrintLayoutGroup, PrintLayoutConfig> = {
  tax_invoice: rescalePrintWidthRaw(RAW_PRINT_LAYOUTS.tax_invoice),
  receipt: rescalePrintWidthRaw(RAW_PRINT_LAYOUTS.receipt),
};

// 🧩 คืนรายชื่อคีย์วันที่ทั้งหมดที่มีอยู่จริงในกลุ่มนี้ (metaDate หลัก + metaDate_2, metaDate_3, ... ที่ผู้ใช้กดเพิ่ม)
// ใช้ทั้งตอน render จริง (วนแสดงค่าเดียวกันหลายตำแหน่ง) และตอน editor แสดงรายการ section ในแถบด้านข้าง
export function getRepeatableDateKeys(layout: PrintLayoutConfig, baseKey: string = "metaDate"): string[] {
  const pattern = new RegExp(`^${baseKey}(_\\d+)?$`);
  return Object.keys(layout)
    .filter((k) => pattern.test(k))
    .sort((a, b) => {
      const numA = a === baseKey ? 0 : parseInt(a.split("_")[1], 10);
      const numB = b === baseKey ? 0 : parseInt(b.split("_")[1], 10);
      return numA - numB;
    });
}

// 🧩 บังคับให้ y/height ของทุกคอลัมน์ในกลุ่มเดียวกันตรงกันเสมอ (อิงจากคอลัมน์แรกในกลุ่มเป็นค่าตั้งต้น)
// เรียกทั้งตอนแก้ไขใน editor (ทุกครั้งที่ setLayouts) และตอนโหลด/render จริงใน getPrintLayoutConfig()
// กันข้อมูลเพี้ยนจากการแก้ JSON มือหรือโค้ดจุดอื่นที่ไม่ผ่าน editor นี้ในอนาคต
export function normalizeColumnGroups(layout: PrintLayoutConfig, group: PrintLayoutGroup): PrintLayoutConfig {
  const groups = COLUMN_GROUPS[group] || [];
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

// อ่าน layout + รูปพื้นหลังอ้างอิงของกลุ่มเอกสารหนึ่งๆ จาก companySettings.document_settings.print_layouts[group]
// (key ใหม่ แยกจาก letter_layout เดิมโดยสิ้นเชิง — ไม่ปนกับ quotation/billing_invoice/ฯลฯ)
export function getPrintLayoutConfig(
  companySettings: any,
  group: PrintLayoutGroup,
): { layout: PrintLayoutConfig; backgroundPath: string | null } {
  let docSettings = companySettings?.document_settings;
  if (typeof docSettings === "string") {
    try {
      docSettings = JSON.parse(docSettings);
    } catch (e) {
      docSettings = null;
    }
  }
  const stored = docSettings?.print_layouts?.[group];
  const merged = { ...DEFAULT_PRINT_LAYOUTS[group], ...(stored?.sections || {}) };
  return {
    layout: normalizeColumnGroups(merged, group),
    backgroundPath: stored?.background_path || null,
  };
}

// ประเภทเอกสารกลุ่มนี้ใช้ดีไซน์นี้เฉพาะตอนเลือกกระดาษ Letter เท่านั้น (ดู isLetter && isPrintLayoutGroup(...) ใน SalesPdfTemplate.tsx) — ตอน A4 ใช้ดีไซน์เต็มรูปแบบร่วมกับเอกสารประเภทอื่น
// 🖨️ delivery_note ย้ายออกไปใช้ letter-layout แล้ว ไม่ใช่กลุ่มนี้อีกต่อไป
export function isPrintLayoutGroup(docType: string): docType is PrintLayoutGroup {
  return docType === "tax_invoice" || docType === "receipt";
}
