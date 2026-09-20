import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import dayjs from "dayjs";
import { bahtText } from "@/lib/thaiBahtText";
import {
  DEFAULT_LETTER_LAYOUT,
  DEFAULT_LETTER_LAYOUTS,
  DEFAULT_A4_LAYOUTS,
  DEFAULT_HALF_LETTER_LAYOUTS,
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  LETTER_PAGE_WIDTH,
  LETTER_PAGE_HEIGHT,
  HALF_LETTER_PAGE_WIDTH,
  HALF_LETTER_PAGE_HEIGHT,
  LetterLayoutConfig,
  LetterLayoutGroup,
  PaperSize,
  computeStretchedItemsTableHeight,
  getA4AccentColor,
} from "@/lib/letterLayoutDefaults";
import {
  DEFAULT_PRINT_LAYOUTS,
  DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE,
  PRINT_PAGE_DIMENSIONS,
  PrintLayoutConfig,
  PrintLayoutGroup,
  isPrintLayoutGroup,
  getRepeatableDateKeys,
} from "@/lib/printLayoutDefaults";
import {
  getA4BoxFillStyle,
  getA4BoxFillColor,
  getA4WatermarkOpacity,
  getA4WatermarkSize,
  type A4FillOptions,
} from "@/lib/a4LayoutDefaults";

// 🇹🇭 ลงทะเบียนฟอนต์ภาษาไทย (อิงจากโครงสร้างมาตรฐาน ST PLUS)
// หมายเหตุ: เช็ค path ฟอนต์ให้ตรงกับโปรเจคของพี่เคด้วยนะครับ
Font.register({
  family: "THSarabunNew",
  fonts: [
    { src: "/fonts/THSarabunNew.ttf" },
    { src: "/fonts/THSarabunNew-Bold.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    paddingVertical: 30,
    paddingHorizontal: 24,
    fontFamily: "THSarabunNew",
    fontSize: 12,
    color: "#1e293b",
  },
  pageLetter: { fontFamily: "THSarabunNew", fontSize: 12, color: "#1e293b" },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6, // ลดช่องว่างระหว่าง Header กับกล่องข้อมูลลูกค้า
  },
  companyLogo: { width: 70, height: 70, objectFit: "contain" }, // เปลี่ยนขนาด Logo
  companyInfo: { flex: 1, marginLeft: 15 },
  companyName: { fontSize: 18, fontWeight: "bold", color: "#0f172a" },
  documentTitleContainer: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  documentTitle: { fontSize: 22, fontWeight: "bold", color: "#2563eb" },
  // 🖨️ หัวเอกสาร A4 แบบเดิม (ทุกประเภทเอกสารในกลุ่ม shared/delivery_note) — ไทยตัวใหญ่มีเส้นคั่นด้านล่าง
  // อังกฤษเล็กกว่า 40% (fontSize × 0.6) อยู่ใต้เส้นคั่น ตาม docTitleTh/En ของ POPdfTemplate/GRPdfTemplate เดิม
  // 🎨 borderBottom ใส่แบบ dynamic ตอน render (สีตาม getA4AccentColor ต่อกลุ่ม) ไม่ hardcode สีไว้ในนี้
  documentTitleTh: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2563eb",
    paddingBottom: 2,
  },
  documentTitleEn: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 3,
  },
  documentCopy: { fontSize: 10, color: "#64748b", marginTop: 2 },
  // 🚀 ใบเสนอราคา A4: โลโก้+ชื่อ+ที่อยู่กิน 60% ของความกว้างเอกสาร ฝั่งหัวข้อเป็นกล่องขนาดคงที่ (แนะนำรูปพื้นหลัง 220x90pt — ดูคำอธิบายที่หน้าตั้งค่า)
  headerLeftBlockQuotation: { flexDirection: "row", width: "60%" },
  documentTitleContainerQuotation: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    width: 220,
    height: 80, // เดิม 90 — ลดพื้นที่ว่างใต้หัวใบเสนอราคา
    position: "relative",
  },
  // พื้นหลังอยู่ชั้นล่างสุด เต็มกล่อง — ข้อความหัวข้อ (render หลัง) จะลอยทับด้านหน้าเสมอ
  quotationHeaderBgImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 220,
    height: 80, // ให้พื้นหลังสัมพันธ์กับความสูงกล่องหัวใบเสนอราคา
    objectFit: "contain",
  },

  infoSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  customerBox: { width: "60%" },
  customerBoxFull: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  metaBox: { width: "35%" },
  metaBoxFull: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748b",
    marginBottom: 4,
  },
  boldText: { fontWeight: "bold" },

  // 🚀 ใบเสนอราคา A4: กลับไปใช้กล่องเดียวรวมลูกค้า+เลขที่เอกสารแบบเดิม เพิ่มแค่แถบสีบางๆ ติดขอบมุมโค้งด้านบน (ไม่มีข้อความในแถบ)
  infoSectionQuotation: {
    marginBottom: 8, // ลดช่องว่างก่อนตารางสินค้า

    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  quotationInfoColorStrip: {
    height: 11,
    backgroundColor: "#2563eb",
    width: "100%",
  },
  quotationInfoBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
  },

  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 0, // ระยะห่างควบคุมจาก infoSection ด้านบนแล้ว
  },
  tableNoMargin: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  // 🚀 ตารางแบบยืดเต็มพื้นที่ (ใช้เฉพาะใบเสนอราคา A4 — ดันหมายเหตุ/ลายเซ็นให้ชิดขอบล่างสุดแบบใบสั่งซื้อ)
  tableContainerGrow: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    marginTop: 0, // เดิม 10 — ลดช่องว่างระหว่างข้อมูลลูกค้ากับตาราง
  },
  tableGrow: {
    flexGrow: 1,
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
  },
  tableRowStretch: { flexDirection: "row", flexGrow: 1 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0, // เส้นระหว่างบรรทัด 1,0
    borderColor: "#f1f5f9",
    paddingVertical: 4,
  },
  // 🚀 โหมด A4 เท่านั้น (ItemsTableContent) — ตัวอักษร/ระยะห่างบรรทัดกระชับขึ้นกว่าเดิม ไม่กระทบโหมด Letter
  tableHeaderA4: { fontSize: 10 },
  tableRowA4: { fontSize: 12, paddingVertical: 0 }, //ระยะห่างของบรรทัด
  colNo: { width: "5%", textAlign: "center", padding: 4 },
  colName: { width: "26%", padding: 4, lineHeight: 1.15 },
  // 🔢 บรรทัดย่อยแสดง S/N ที่เลือกไว้ ใต้ชื่อสินค้าในคอลัมน์เดียวกัน — ใช้ nested <Text> ขึ้นบรรทัดใหม่ด้วย \n
  // 🆙 [2026-09-16] ขนาดใกล้เคียงชื่อรายการ (เดิม 7pt เล็กเกินไป/ไม่เท่ากันระหว่างแถวแม่-แถวลูก) + บรรทัดชิดขึ้น
  snNote: { fontSize: 10, color: "#64748b", lineHeight: 1.15 },
  colPrice: { width: "11%", textAlign: "right", padding: 4 },
  // 💰 ราคาทุน — เฉพาะใบเบิกวัสดุติดตั้ง (installation_issue) เท่านั้น ไม่มีเอกสารอื่นใช้คอลัมน์นี้
  colCostPrice: { width: "11%", textAlign: "right", padding: 4, color: "#64748b" },
  colQty: { width: "8%", textAlign: "center", padding: 4 },
  colUnit: { width: "8%", textAlign: "center", padding: 4 },
  colQtyMerged: { width: "16%", textAlign: "center", padding: 4 },
  colBeforeDiscount: { width: "13%", textAlign: "right", padding: 4 },
  colDiscount: {
    width: "10%",
    textAlign: "right",
    padding: 4,
    color: "#ef4444",
  },
  colWht: { width: "7%", textAlign: "center", padding: 4 },
  colTotal: { width: "12%", textAlign: "right", padding: 4 },
  colTotalWide: { width: "19%", textAlign: "right", padding: 4 },

  summarySection: { flexDirection: "row", marginTop: 10 },
  noteBox: {
    width: "60%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    minHeight: 80,
  },
  noteBoxFull: {
    width: "100%",
    height: "100%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
  },
  financeBox: { width: "40%", paddingLeft: 10 },
  // 🖼️ เพิ่มเส้นขอบให้เห็นขอบเขตกล่องเสมอ (มาตรฐานเดียวกับ customerBoxFull/metaBoxFull ด้านบน) แม้เอกสารบางประเภท
  // จะยังพิมพ์เปล่าไม่มีข้อมูลเติมในบางช่อง ก็ยังเห็นกรอบว่างแทนที่จะเป็นพื้นที่ว่างมองไม่เห็นเลย
  financeBoxFull: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  financeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end", // จัดข้อความ Grand Total ให้ชิดฐานล่างเดียวกับตัวเลข
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    fontWeight: "bold",
    fontSize: 14,
  },

  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
    paddingHorizontal: 20,
  },
  sigBox: { width: "30%", alignItems: "center" },
  // 🖼️ เพิ่มเส้นขอบให้เห็นขอบเขตกล่องเสมอ (มาตรฐานเดียวกับ customerBoxFull/metaBoxFull/financeBoxFull ด้านบน)
  // — ค่าเริ่มต้นเป็นแบบนี้เสมอทั้ง 12 จุดที่ใช้สไตล์นี้ ยกเว้น signatureLeft/signatureRight ของกลุ่ม A4 shared
  // (2 จุดด้านล่าง) ที่ปิดเส้นได้ผ่านสวิทช์ "แสดงสีพื้นหลังกล่องนี้" เดิม (ดู sigBoxBorderOverride ที่จุดเรียกใช้)
  sigBoxFull: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  // 🖨️ กลุ่ม tax_invoice/receipt/invoice (print-layouts) และ delivery_note (company/letter-layout) พิมพ์ทับ
  // กระดาษหัวจดหมายที่มีอยู่แล้ว/ไม่ต้องการกรอบ — ไม่ควรมีเส้นกรอบล้อมกล่องลายเซ็น/ตราประทับเลย ใช้ตัวนี้แทนเฉพาะ
  // กิ่ง isPrintLayoutGroup และกิ่ง delivery_note ด้านล่างเท่านั้น จุดอื่นที่ใช้ sigBoxFull เดิมไม่กระทบ
  sigBoxFullNoBorder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    padding: 10,
  },
  sigLine: {
    width: "100%",
    borderBottomWidth: 1, // เส้นระหว่างบรรทัด 1,0
    borderColor: "#94a3b8",
    marginBottom: 4,
  },

  // 🖨️ โหมด Letter — วางตำแหน่งอิสระตาม layout ที่ตั้งค่าไว้ (พิมพ์ทับกระดาษหัวจดหมายที่มีอยู่แล้ว ไม่มีโลโก้/หัวกระดาษของระบบ)
  letterAbsolute: { position: "absolute" },
  letterTitle: { fontSize: 20, fontWeight: "bold", color: "#2563eb" },

  // 🖨️ ดีไซน์เฉพาะกลุ่ม tax_invoice/receipt/delivery_note — ไม่มีเส้นกรอบ/เส้นใต้เลย (ยกเว้น printBorderedSection ที่ยังใช้กับ
  // conditionsText ของ delivery_note เท่านั้น ตามข้อยกเว้นเดียวของงานนี้)
  printBorderedSection: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 6,
  },
  printPlainSection: { width: "100%", height: "100%" },
  printTableHeaderPlain: {
    flexDirection: "row",
    fontWeight: "bold",
    fontSize: 9,
    paddingBottom: 2,
    marginBottom: 2,
  },
  printTableRowPlain: { flexDirection: "row", fontSize: 9, paddingVertical: 2 },
  pColNo: { width: "6%", textAlign: "center" },
  pColCode: { width: "14%", textAlign: "center" },
  pColDesc: { width: "39%", paddingHorizontal: 3, lineHeight: 1.15 },
  pColQty: { width: "14%", textAlign: "center" },
  pColUPrice: { width: "13%", textAlign: "right" },
  pColAmount: { width: "14%", textAlign: "right" },
  pMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  pSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 9,
  },
  // 🖨️ ไม่มีเส้นบนอีกต่อไป (ของเดิมมี borderTopWidth) — เว้นระยะห่างด้วย marginTop/paddingTop เฉยๆ ให้ตัวหนา/ใหญ่กว่าเด่นพอ
  pGrandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 2,
    fontWeight: "bold",
    fontSize: 11,
  },
  pSigLabel: { fontSize: 9, textAlign: "center" },
  pSigDate: {
    fontSize: 8,
    textAlign: "center",
    color: "#64748b",
    marginTop: 2,
  },
});

// 🔢 แปลง item.serials เป็นข้อความ S/N คั่นด้วยจุลภาค — รองรับทั้ง string[] (จาก useSaleDocumentItems ตอนพรีวิว
// จากหน้าสร้างเอกสาร) และ {serial_number, ...}[] (จาก fullDoc.items ดิบตอนพิมพ์จากหน้ารายการเอกสาร)
const formatSerials = (serials: any[]): string =>
  serials.map((s) => (typeof s === "string" ? s : s.serial_number)).join(", ");

// 🧠 ฟังก์ชันแปลประเภทเอกสารเป็นชื่อหัวบิล
const getDocumentName = (type: string) => {
  switch (type) {
    case "quotation":
      return "ใบเสนอราคา (Quotation)";
    case "custom_quotation":
      return "ใบเสนอราคา (Quotation)";
    case "billing_invoice":
      return "ใบแจ้งหนี้ / ใบวางบิล";
    case "tax_invoice":
      return "ใบกำกับภาษี / ใบแจ้งหนี้";
    case "cash":
      return "ใบเสร็จรับเงิน (บิลเงินสด)";
    case "custom_cash":
      return "ใบเสร็จรับเงิน (บิลเงินสด)";
    case "receipt":
      return "ใบเสร็จรับเงิน (Receipt)";
    case "credit_note":
      return "ใบลดหนี้ (Credit Note)";
    case "debit_note":
      return "ใบเพิ่มหนี้ (Debit Note)";
    case "delivery_note":
      return "ใบส่งสินค้า (Delivery Note)";
    case "material_issue":
      return "ใบเบิกสินค้า (Material Issue)";
    case "installation_issue":
      return "ใบเบิกวัสดุติดตั้ง (Installation Issue)";
    case "stock_issue":
      return "ใบเบิกสินค้า (งานเช่า)";
    case "stock_return":
      return "ใบคืนสินค้า (Stock Return)";
    case "rental_stock_return":
      return "ใบคืนสินค้าเช่า (Rental Stock Return)";
    case "loan_issue":
      return "ใบยืมสินค้า";
    case "loan_return":
      return "ใบคืนสินค้ายืม";
    case "invoice":
      return "ใบแจ้งหนี้ (Invoice)";
    case "packing_list":
      return "ใบจัดสินค้า (Packing List)";
    default:
      return "เอกสารการขาย";
  }
};

// 🖨️ หัวเอกสาร A4 แบบเดิม (2 บรรทัด: ไทยด้านบน มีเส้นคั่น, อังกฤษเล็กกว่าด้านล่าง) — ใช้เฉพาะ paperSize==="A4"
// (Letter/Half Letter ใช้ getDocumentName บรรทัดเดียวเหมือนเดิม) ครอบคลุมทุกประเภทเอกสารในกลุ่ม shared/delivery_note
const getDocumentTitleParts = (type: string): { th: string; en: string } => {
  switch (type) {
    case "quotation":
    case "custom_quotation":
      return { th: "ใบเสนอราคา", en: "Quotation" };
    case "billing_invoice":
      return { th: "ใบแจ้งหนี้ / ใบวางบิล", en: "Billing Invoice" };
    case "tax_invoice":
      return { th: "ใบกำกับภาษี / ใบแจ้งหนี้", en: "Tax Invoice" };
    case "cash":
    case "custom_cash":
      return { th: "ใบเสร็จรับเงิน (บิลเงินสด)", en: "Cash Sale" };
    case "receipt":
      return { th: "ใบเสร็จรับเงิน", en: "Receipt" };
    case "credit_note":
      return { th: "ใบลดหนี้", en: "Credit Note" };
    case "debit_note":
      return { th: "ใบเพิ่มหนี้", en: "Debit Note" };
    case "delivery_note":
      return { th: "ใบส่งสินค้า", en: "Delivery Note" };
    case "invoice":
      return { th: "ใบแจ้งหนี้", en: "Invoice" };
    case "packing_list":
      return { th: "ใบจัดสินค้า", en: "Packing List" };
    case "material_issue":
      return { th: "ใบเบิกสินค้า", en: "Material Issue" };
    case "installation_issue":
      return { th: "ใบเบิกวัสดุติดตั้ง", en: "Installation Issue" };
    case "stock_issue":
      return { th: "ใบเบิกสินค้า (งานเช่า)", en: "Stock Issue" };
    case "stock_return":
      return { th: "ใบคืนสินค้า", en: "Stock Return" };
    case "rental_stock_return":
      return { th: "ใบคืนสินค้าเช่า", en: "Rental Stock Return" };
    default:
      return { th: "เอกสารการขาย", en: "Sales Document" };
  }
};

// 🇹🇭 ประเภทเอกสารที่แสดงคำอ่านภาษาไทยของยอดเงินในโหมด A4 — เฉพาะเอกสารขาย/การเงินจริงเท่านั้น
// ไม่รวมเอกสารเคลื่อนไหวสต๊อกภายใน (material_issue/loan_issue/loan_return) เพราะไม่ใช่รายการซื้อขายจริง
const A4_BAHT_TEXT_TYPES = [
  "quotation",
  "custom_quotation",
  "billing_invoice",
  "tax_invoice",
  "cash",
  "custom_cash",
  "receipt",
  "credit_note",
  "debit_note",
  "invoice",
  "delivery_note",
];

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
};
// วาง View ตำแหน่งสัมบูรณ์ตาม box ที่ตั้งค่าไว้ (ใช้เฉพาะโหมด Letter)
const absoluteStyle = (box: Box) => ({
  position: "absolute" as const,
  left: box.x,
  top: box.y,
  width: box.width,
  height: box.height,
});

// 🧩 คำนวณกรอบรวม (bounding box) จากกล่องคอลัมน์หลายกล่อง — ใช้เฉพาะ fallback ของใบเสร็จแบบเก่า (ไม่มี invoice_refs)
// ที่ยังต้องแสดงตารางสินค้าแบบรวมกล่องเดียวเหมือนเดิม แม้ตำแหน่งกล่องจริงจะถูกแยกเป็นคอลัมน์อ้างอิงใบกำกับไปแล้ว
const getColumnsBoundingBox = (
  layout: Record<string, Box | undefined>,
  keys: string[],
): Box => {
  const boxes = keys.map((k) => layout[k]).filter((b): b is Box => !!b);
  if (boxes.length === 0) return { x: 30, y: 230, width: 552, height: 220 };
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
};

export default function SalesPdfTemplate({ data }: { data: any }) {
  const {
    companySettings,
    formData,
    selectedContact,
    items,
    invoiceRefs,
    finance,
    documentNumber,
    customLogoUrl,
    paperSize,
    letterLayout,
    quotationHeaderBackgroundUrl,
    printLayout,
    deliveryNoteLetterLayout,
  } = data;

  // 🔖 ติ๊กแสดง/ไม่แสดงเลข S/N ต่อท้ายรายการสินค้า (ใบกำกับภาษี/ใบส่งสินค้า) — default แสดง (undefined/null = true)
  // เอกสารประเภทอื่นที่ไม่มี checkbox นี้ในฟอร์มก็ไม่กระทบ เพราะคอลัมน์ show_serials ที่ backend default ไว้เป็น true เสมอ
  const showSerials = formData?.show_serials !== false;

  const isLetter = paperSize === "Letter";
  const isHalfLetter = paperSize === "HalfLetter";
  // 🖨️ react-pdf ขนาด "LETTER" แบบ string เป็นค่ามาตรฐานตายตัวของ library (612x792 เสมอ) ไม่ผูกกับ
  // LETTER_PAGE_WIDTH/HEIGHT ของระบบนี้ที่เป็นกระดาษต่อเนื่อง 8x11" (576x792) — ต้องส่ง tuple เองเสมอ
  const pdfPageSize: "A4" | [number, number] = isLetter
    ? [LETTER_PAGE_WIDTH, LETTER_PAGE_HEIGHT]
    : isHalfLetter
      ? [HALF_LETTER_PAGE_WIDTH, HALF_LETTER_PAGE_HEIGHT]
      : "A4";
  // 🖨️ fallback ต้องเลือกชุด default ให้ตรงกับกระดาษจริง — เดิม hardcode เป็น Letter เสมอ (บั๊กแฝง
  // ที่ไม่เคยเห็นผลเพราะ letterLayout ที่ส่งมาจาก getPaperSizeConfig() มี key ครบอยู่แล้วแทบทุกกรณี)
  // 🖨️ isLetter ยังคงเป็น boolean 2 ทางเหมือนเดิม (คุมสไตล์ตารางกระชับ/กว้างที่เหลือทั้งไฟล์) — Half Letter ตกบัคเก็ต
  // เดียวกับ A4 โดยเจตนา (หน้าแคบกว่า A4 ด้วยซ้ำ สไตล์กระชับของ A4 เหมาะกว่าสไตล์ Letter ที่กว้างกว่า)
  const layout: LetterLayoutConfig = {
    ...(isLetter
      ? DEFAULT_LETTER_LAYOUTS.shared
      : isHalfLetter
        ? DEFAULT_HALF_LETTER_LAYOUTS.shared
        : DEFAULT_A4_LAYOUTS.shared),
    ...(letterLayout || {}),
  };

  // 🎨 สีพื้นหลังกล่อง — ตั้งค่าเดียวใช้ร่วมกันทั้งเอกสาร A4 ทุกประเภท (ไม่มีผลกับ Letter/Half Letter)
  const a4FillOpts: A4FillOptions = {
    enabled: paperSize === "A4",
    color: getA4BoxFillColor(companySettings),
  };

  // แปลงที่อยู่ลูกค้าให้อ่านง่าย
  const contactAddress = selectedContact
    ? `${selectedContact.address || ""} ${selectedContact.province || ""} ${selectedContact.zip_code || ""}`.trim()
    : "-";

  // 🧾 ซ่อนคอลัมน์ "หัก ณ ที่จ่าย" ในโหมด A4 เมื่อไม่มีรายการใดถูกหักเลย (โหมด Letter คงแสดงเสมอเหมือนเดิม)
  const hasWht = items.some((item: any) => Number(item.wht_rate) > 0);
  const showWht = isLetter || hasWht;

  // 🎨 ใบเสนอราคาแบบกำหนดเอง — ใช้โลโก้/ชื่อบริษัทที่ตั้งเฉพาะเอกสารนี้ก่อน ถ้าไม่ได้ตั้งค่อย fallback ไปที่ค่าบริษัทปกติ
  // 🛡️ ใช้ logo_base64 ก่อนเสมอ — companySettings.logo เป็น URL ข้าม origin (frontend :3000 → backend :8000)
  // ที่ <Image> ของ react-pdf fetch ตรงๆ ฝั่ง browser แล้วโดน CORS บล็อกเงียบๆ (โลโก้เลยไม่ขึ้นใน PDF)
  const displayLogo =
    customLogoUrl || companySettings?.logo_base64 || companySettings?.logo;

  // 🖼️ พื้นหลังจางเต็มหน้า (watermark) ของเอกสารขาย A4 ทุกประเภท — ใช้รูปแยกต่างหาก
  // จากพื้นหลังหัวกระดาษใบเสนอราคา (อัปโหลดคนละช่องที่หน้า /company แท็บ "แก้ไขใบเสนอราคา")
  // อ่านตรงจาก companySettings เอง (ไม่พึ่ง prop ที่ส่งมาต่อหน้า เพราะเอกสารทุกประเภทต้องเห็นเหมือนกัน)
  const documentWatermarkUrl =
    companySettings?.a4_watermark_background_base64 || null;
  const displayCompanyName =
    formData?.custom_company_name ||
    companySettings?.name ||
    "บริษัท XXXXXXX จำกัด";
  const displayCompanyAddress =
    formData?.custom_company_address || companySettings?.address || "-";

  // --- เนื้อหาแต่ละส่วน (reuse ได้ทั้งโหมด A4 flow ปกติ และโหมด Letter ที่วาง absolute) ---

  const CustomerBodyContent = () => (
    <>
      <Text style={styles.boldText}>
        {selectedContact?.business_name || selectedContact?.contact_name || "-"}
      </Text>
      <Text>{contactAddress}</Text>
      <Text>เลขประจำตัวผู้เสียภาษี: {selectedContact?.tax_id || "-"}</Text>
    </>
  );

  const CustomerContent = () => (
    <>
      <Text style={styles.sectionTitle}>ลูกค้า (Customer)</Text>
      <CustomerBodyContent />
    </>
  );

  // 🧩 ข้อมูลลูกค้าแยกเป็น 3 ชิ้นอิสระ (ชื่อ/ที่อยู่/เลขผู้เสียภาษี) — ใช้กับกล่องอิสระของกลุ่ม print-layout/letter-layout ใหม่
  const CustomerNameOnly = () => (
    <Text style={styles.boldText}>
      {selectedContact?.business_name || selectedContact?.contact_name || "-"}
    </Text>
  );
  const CustomerAddressOnly = () => (
    <Text style={{ fontSize: 9 }}>{contactAddress}</Text>
  );
  const CustomerTaxIdOnly = () => (
    <Text style={{ fontSize: 9 }}>
      เลขประจำตัวผู้เสียภาษี: {selectedContact?.tax_id || "-"}
    </Text>
  );

  const MetaContent = () => (
    <>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <Text style={styles.sectionTitle}>เลขที่เอกสาร:</Text>
        <Text style={styles.boldText}>
          {documentNumber || formData.document_number}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text style={styles.sectionTitle}>วันที่ออกเอกสาร:</Text>
        <Text>{dayjs(formData.issue_date).format("DD/MM/YYYY")}</Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text style={styles.sectionTitle}>เงื่อนไขการชำระเงิน:</Text>
        <Text>
          {formData.credit_days > 0 ? `${formData.credit_days} วัน` : "เงินสด"}
        </Text>
      </View>
      {/* 💳 วิธีการชำระเงิน — เฉพาะใบเสนอราคาเท่านั้น (ตามที่ระบุ) แสดงเฉพาะเมื่อมีค่า ไม่ใช่ default */}
      {formData?.document_type === "quotation" && formData.payment_method && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Text style={styles.sectionTitle}>วิธีการชำระเงิน:</Text>
          <Text>{formData.payment_method}</Text>
        </View>
      )}
      {formData.reference_number && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Text style={styles.sectionTitle}>อ้างอิงเอกสาร:</Text>
          <Text>{formData.reference_number}</Text>
        </View>
      )}
      {formData.transportation && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Text style={styles.sectionTitle}>การขนส่ง:</Text>
          <Text>{formData.transportation}</Text>
        </View>
      )}
      {formData.saleman_code && (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={styles.sectionTitle}>รหัสพนักงานขาย:</Text>
          <Text>{formData.saleman_code}</Text>
        </View>
      )}
    </>
  );

  // 🚀 โหมด A4 เท่านั้น (ไม่แตะโหมด Letter เลย): รวมคอลัมน์ "ราคา/หน่วย" เข้ากับ "รายการสินค้า" (26%+11%=37%)
  // แล้วจัดสัดส่วนคอลัมน์ที่เหลือใหม่ให้รวม 100% พอดีทั้ง 2 กรณี (มี/ไม่มีคอลัมน์หัก ณ ที่จ่าย)
  // 🛡️ react-pdf's Style[] ไม่รับ `undefined`/`false` เป็นสมาชิก array (ต่างจาก React Native) ต้อง merge
  // เป็น object เดียวก่อนเสมอ ใช้ mergeStyle() แทน array แบบมีเงื่อนไข
  const mergeStyle = (...parts: any[]): any => Object.assign({}, ...parts);
  // 🚀 คอลัมน์ "ราคา/หน่วย" กลับมาแสดงในโหมด A4 ด้วยตามที่ผู้ใช้ยืนยัน (ของเดิมเคยรวมเข้ากับคอลัมน์นี้ชั่วคราว)
  // ความกว้างจึงเท่ากับฐานเดิม (26%) ไม่ขยายอีกต่อไป
  // const a4NameWidth = { width: "26%" };
  // const a4QtyWidth = { width: "14%" };
  // const a4BeforeDiscountWidth = { width: "14%" };
  // const a4DiscountWidth = { width: "10%" };
  // const a4WhtWidth = { width: "8%" };
  // const a4TotalWidth = { width: hasWht ? "12%" : "20%" };
  const a4NameWidth = { width: "45%" };
  const a4QtyWidth = { width: "10%" };
  const a4BeforeDiscountWidth = { width: "12%" };
  const a4DiscountWidth = { width: "8%" };
  const a4WhtWidth = { width: "5%" };
  const a4TotalWidth = { width: hasWht ? "12%" : "12%" };

  // 🔢 เลขลำดับสินค้า: นับเฉพาะแถวแม่ (Bundle child ไม่เพิ่มเลขลำดับ)
  const getParentItemNumber = (index: number) =>
    items
      .slice(0, index + 1)
      .filter((row: any) => !(row.parent_item_id || row._parentRowId)).length;

  // 🆕 [2026-09-15] เอกสารกลุ่มนี้ไม่มีราคา/ส่วนลด/ภาษีเกี่ยวข้องเลย (แค่บอกว่าต้องจัดการสินค้าอะไรจำนวนเท่าไหร่) —
  // ตรงกับกลุ่ม "goods_packing"/"stock_movement" ใน company/print-layouts-a4 พอดี (ดูคอมเมนต์ DOC_TYPE_TO_LAYOUT_GROUP
  // ใน letterLayoutDefaults.ts บรรทัด 562 ที่ย้ายกลุ่มนี้ออกจาก "shared" ด้วยเหตุผลเดียวกัน) ซ่อนคอลัมน์ราคา/ก่อนลด/
  // ส่วนลด/หัก ณ ที่จ่าย/รวมทั้งหมด แล้วขยายคอลัมน์รายการ/จำนวนที่เหลือให้เต็มพื้นที่แทน — ยืนยันกับผู้ใช้แล้วให้ครอบคลุม
  // ทั้ง 4 เอกสารของกลุ่ม stock_movement (material_issue/stock_issue/stock_return/rental_stock_return) ด้วย
  const NO_PRICING_DOC_TYPES = new Set([
    "packing_list",
    "material_issue",
    "installation_issue",
    "stock_issue",
    "stock_return",
    "rental_stock_return",
  ]);
  const isNoPriceDoc = NO_PRICING_DOC_TYPES.has(formData?.document_type);
  // 💰 [2026-09-18] ใบเบิกวัสดุติดตั้ง (installation_issue) ยังอยู่ใน NO_PRICING_DOC_TYPES เดิม (ไม่กระทบ
  // เอกสาร no-price อื่นอีก 5 ประเภท) แต่ต้องแสดงราคาขาย/ราคาทุน/จำนวนเงินรวม/สรุปยอดเงินเป็นกรณีพิเศษเฉพาะเอกสารนี้
  const isInstallationIssue = formData?.document_type === "installation_issue";
  const usePkgWidth = isNoPriceDoc && !isInstallationIssue;
  const showPriceCols = !isNoPriceDoc || isInstallationIssue;
  const pkgNameWidth = { width: "55%" };
  const pkgQtyWidth = { width: "20%" };
  const pkgUnitWidth = { width: "20%" };
  const pkgA4NameWidth = { width: "75%" };
  const pkgA4QtyWidth = { width: "20%" };

  const ItemsTableContent = () => (
    <>
      <View
        style={mergeStyle(
          styles.tableHeader,
          !isLetter && styles.tableHeaderA4,
        )}
      >
        <Text style={styles.colNo}>ลำดับ</Text>
        <Text
          style={mergeStyle(
            styles.colName,
            usePkgWidth
              ? isLetter
                ? pkgNameWidth
                : pkgA4NameWidth
              : !isLetter && a4NameWidth,
          )}
        >
          รายการสินค้า
        </Text>
        {showPriceCols && <Text style={styles.colPrice}>ราคาขาย/หน่วย</Text>}
        {isInstallationIssue && (
          <Text style={styles.colCostPrice}>ราคาทุน/หน่วย</Text>
        )}
        {isLetter ? (
          <>
            <Text style={mergeStyle(styles.colQty, usePkgWidth && pkgQtyWidth)}>
              จำนวน
            </Text>
            <Text style={mergeStyle(styles.colUnit, usePkgWidth && pkgUnitWidth)}>
              หน่วย
            </Text>
          </>
        ) : (
          <Text
            style={mergeStyle(
              styles.colQtyMerged,
              usePkgWidth ? pkgA4QtyWidth : a4QtyWidth,
            )}
          >
            จำนวน
          </Text>
        )}
        {!isNoPriceDoc && (
          <>
            <Text
              style={mergeStyle(
                styles.colBeforeDiscount,
                !isLetter && a4BeforeDiscountWidth,
              )}
            >
              ราคาก่อนลด
            </Text>
            <Text
              style={mergeStyle(styles.colDiscount, !isLetter && a4DiscountWidth)}
            >
              ส่วนลด
            </Text>
            {showWht && (
              <Text style={mergeStyle(styles.colWht, !isLetter && a4WhtWidth)}>
                หัก ณ ที่จ่าย
              </Text>
            )}
            <Text
              style={mergeStyle(
                !isLetter && !hasWht ? styles.colTotalWide : styles.colTotal,
                !isLetter && a4TotalWidth,
              )}
            >
              ราคารวม
            </Text>
          </>
        )}
        {isInstallationIssue && (
          <Text
            style={mergeStyle(
              !isLetter && !hasWht ? styles.colTotalWide : styles.colTotal,
              !isLetter && a4TotalWidth,
            )}
          >
            จำนวนเงินรวม
          </Text>
        )}
      </View>

      {items.map((item: any, index: number) => {
        // 📦 แถวลูก/ส่วนประกอบของสินค้าชุด (Bundle) — เยื้อง + ไม่มีราคาเป็นของตัวเอง (ควบคุมจากแถวแม่ทั้งหมด)
        // จำนวน+หน่วยของแถวลูกย้ายไปต่อท้ายชื่อรายการแทนคอลัมน์แยก (ใช้ทุกโหมด A4/Letter ตามที่ยืนยันแล้ว)
        const isChildRow = !!(item.parent_item_id || item._parentRowId);
        const displayName =
          item.item_name || item.product_name || item.product?.name || "";
        const mergedQtyUnit = `${item.quantity} ${item.unit_name}`;
        if (isChildRow) {
          return (
            <View
              key={index}
              style={mergeStyle(
                styles.tableRow,
                !isLetter && styles.tableRowA4,
              )}
            >
              <Text style={styles.colNo}></Text>
              <Text
                wrap={false}
                style={mergeStyle(
                  styles.colName,
                  usePkgWidth
                    ? isLetter
                      ? pkgNameWidth
                      : pkgA4NameWidth
                    : !isLetter && a4NameWidth,
                  {
                    paddingLeft: 12,
                    // ใช้สีเดียวกับบรรทัดแม่ ไม่ทำให้รายการย่อยจางลง
                  },
                )}
              >
                {"- "}
                {displayName}
                {" — "}
                {mergedQtyUnit}
                {showSerials && item.serials?.length > 0 && (
                  <Text style={styles.snNote}>
                    {"\n"}S/N: {formatSerials(item.serials)}
                  </Text>
                )}
              </Text>
              {showPriceCols && <Text style={styles.colPrice}>-</Text>}
              {isInstallationIssue && (
                <Text style={styles.colCostPrice}>-</Text>
              )}
              {isLetter ? (
                <>
                  <Text style={mergeStyle(styles.colQty, usePkgWidth && pkgQtyWidth)}>
                    -
                  </Text>
                  <Text style={mergeStyle(styles.colUnit, usePkgWidth && pkgUnitWidth)}>
                    -
                  </Text>
                </>
              ) : (
                <Text
                  style={mergeStyle(
                    styles.colQtyMerged,
                    usePkgWidth ? pkgA4QtyWidth : a4QtyWidth,
                  )}
                >
                  -
                </Text>
              )}
              {!isNoPriceDoc && (
                <>
                  <Text
                    style={mergeStyle(
                      styles.colBeforeDiscount,
                      !isLetter && a4BeforeDiscountWidth,
                    )}
                  >
                    -
                  </Text>
                  <Text
                    style={mergeStyle(
                      styles.colDiscount,
                      !isLetter && a4DiscountWidth,
                    )}
                  >
                    -
                  </Text>
                  {showWht && (
                    <Text
                      style={mergeStyle(styles.colWht, !isLetter && a4WhtWidth)}
                    >
                      -
                    </Text>
                  )}
                  <Text
                    style={mergeStyle(
                      !isLetter && !hasWht ? styles.colTotalWide : styles.colTotal,
                      !isLetter && a4TotalWidth,
                    )}
                  >
                    -
                  </Text>
                </>
              )}
              {isInstallationIssue && (
                <Text
                  style={mergeStyle(
                    !isLetter && !hasWht ? styles.colTotalWide : styles.colTotal,
                    !isLetter && a4TotalWidth,
                  )}
                >
                  -
                </Text>
              )}
            </View>
          );
        }
        return (
          <View
            key={index}
            style={mergeStyle(styles.tableRow, !isLetter && styles.tableRowA4)}
          >
            <Text style={styles.colNo}>{getParentItemNumber(index)}</Text>
            <Text
              style={mergeStyle(
                styles.colName,
                usePkgWidth
                  ? isLetter
                    ? pkgNameWidth
                    : pkgA4NameWidth
                  : !isLetter && a4NameWidth,
              )}
            >
              {displayName}
              {showSerials && item.serials?.length > 0 && (
                <Text style={styles.snNote}>
                  {"\n"}S/N: {formatSerials(item.serials)}
                </Text>
              )}
            </Text>
            {showPriceCols && (
              <Text style={styles.colPrice}>
                {Number(item.unit_price).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            )}
            {isInstallationIssue && (
              <Text style={styles.colCostPrice}>
                {Number(item.cost_price || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            )}
            {isLetter ? (
              <>
                <Text style={mergeStyle(styles.colQty, usePkgWidth && pkgQtyWidth)}>
                  {item.quantity}
                </Text>
                <Text style={mergeStyle(styles.colUnit, usePkgWidth && pkgUnitWidth)}>
                  {item.unit_name}
                </Text>
              </>
            ) : (
              <Text
                style={mergeStyle(
                  styles.colQtyMerged,
                  usePkgWidth ? pkgA4QtyWidth : a4QtyWidth,
                )}
              >
                {mergedQtyUnit}
              </Text>
            )}
            {!isNoPriceDoc && (
              <>
                <Text
                  style={mergeStyle(
                    styles.colBeforeDiscount,
                    !isLetter && a4BeforeDiscountWidth,
                  )}
                >
                  {(Number(item.quantity) * Number(item.unit_price)).toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )}
                </Text>
                <Text
                  style={mergeStyle(
                    styles.colDiscount,
                    !isLetter && a4DiscountWidth,
                  )}
                >
                  {Number(item.discount_amount) > 0
                    ? Number(item.discount_amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })
                    : "-"}
                </Text>
                {showWht && (
                  <Text style={mergeStyle(styles.colWht, !isLetter && a4WhtWidth)}>
                    {Number(item.wht_rate) > 0 ? `${item.wht_rate}%` : "-"}
                  </Text>
                )}
                <Text
                  style={mergeStyle(
                    !isLetter && !hasWht ? styles.colTotalWide : styles.colTotal,
                    !isLetter && a4TotalWidth,
                  )}
                >
                  {Number(item.total_price).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </>
            )}
            {isInstallationIssue && (
              <Text
                style={mergeStyle(
                  !isLetter && !hasWht ? styles.colTotalWide : styles.colTotal,
                  !isLetter && a4TotalWidth,
                )}
              >
                {Number(item.total_price).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            )}
          </View>
        );
      })}
      {/* 📐 แถวว่างยืดเต็ม (flexGrow) — เติมพื้นที่ที่เหลือให้ดูเป็นตารางเต็มกรอบเสมอ แม้มีแค่ 1-2 รายการ */}
      <View style={styles.tableRowStretch} />
    </>
  );

  // 🧾 ใบวางบิล/ใบเสร็จรับเงินโหมด "อ้างอิงใบกำกับภาษีหลายใบ" — แสดงตารางอ้างอิงแทนตารางรายการสินค้าปกติ
  const hasInvoiceRefs = Array.isArray(invoiceRefs) && invoiceRefs.length > 0;
  const showPaymentCol = formData?.document_type === "receipt";
  const refColWidths = showPaymentCol
    ? {
        no: "5%",
        number: "20%",
        date: "13%",
        due: "13%",
        amount: "15%",
        outstanding: "15%",
        payment: "19%",
      }
    : {
        no: "5%",
        number: "25%",
        date: "15%",
        due: "15%",
        amount: "20%",
        outstanding: "20%",
        payment: "0%",
      };

  const InvoiceRefsTableContent = () => (
    <>
      <View style={styles.tableHeader}>
        <Text style={[styles.colNo, { width: refColWidths.no }]}>ลำดับ</Text>
        <Text style={[styles.colName, { width: refColWidths.number }]}>
          เลขที่ใบกำกับภาษี
        </Text>
        <Text
          style={{ width: refColWidths.date, textAlign: "center", padding: 4 }}
        >
          วันที่
        </Text>
        <Text
          style={{ width: refColWidths.due, textAlign: "center", padding: 4 }}
        >
          ครบกำหนด
        </Text>
        <Text
          style={{ width: refColWidths.amount, textAlign: "right", padding: 4 }}
        >
          จำนวนเงิน
        </Text>
        <Text
          style={{
            width: refColWidths.outstanding,
            textAlign: "right",
            padding: 4,
          }}
        >
          ยอดค้างชำระ
        </Text>
        {showPaymentCol && (
          <Text
            style={{
              width: refColWidths.payment,
              textAlign: "right",
              padding: 4,
            }}
          >
            ยอดชำระ
          </Text>
        )}
      </View>
      {(invoiceRefs || []).map((row: any, index: number) => (
        <View key={index} style={styles.tableRow}>
          <Text style={[styles.colNo, { width: refColWidths.no }]}>
            {index + 1}
          </Text>
          <Text style={[styles.colName, { width: refColWidths.number }]}>
            {row.document_number}
          </Text>
          <Text
            style={{
              width: refColWidths.date,
              textAlign: "center",
              padding: 4,
            }}
          >
            {row.issue_date ? dayjs(row.issue_date).format("DD/MM/YYYY") : "-"}
          </Text>
          <Text
            style={{ width: refColWidths.due, textAlign: "center", padding: 4 }}
          >
            {row.due_date ? dayjs(row.due_date).format("DD/MM/YYYY") : "-"}
          </Text>
          <Text
            style={{
              width: refColWidths.amount,
              textAlign: "right",
              padding: 4,
            }}
          >
            {Number(row.grand_total).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
          <Text
            style={{
              width: refColWidths.outstanding,
              textAlign: "right",
              padding: 4,
            }}
          >
            {Number(row.outstanding_balance).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
          {showPaymentCol && (
            <Text
              style={{
                width: refColWidths.payment,
                textAlign: "right",
                padding: 4,
              }}
            >
              {Number(row.payment_amount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          )}
        </View>
      ))}
      {/* 📐 แถวว่างยืดเต็ม (flexGrow) — เติมพื้นที่ที่เหลือให้ดูเป็นตารางเต็มกรอบเสมอ แม้มีแค่ 1-2 รายการ */}
      <View style={styles.tableRowStretch} />
    </>
  );

  const NotesContent = () => (
    <>
      <Text style={styles.sectionTitle}>หมายเหตุ (Remarks):</Text>
      <Text>{formData.note || "-"}</Text>
    </>
  );

  // 🧾 ใบกำกับภาษี A4: แสดงมัดจำแยกต่างหาก (คำนวณในเทมเพลตเอง เหมือนที่ print-layout-group ทำอยู่แล้ว — ไม่แตะ finance ที่ส่งเข้ามา)
  const deposit =
    formData?.document_type === "tax_invoice"
      ? Number(formData.deposit_amount) || 0
      : 0;
  const netBeforeVat = finance.subtotal - finance.discount - deposit;
  // 💰 สรุปยอดเงิน เฉพาะใบเบิกวัสดุติดตั้ง (installation_issue) — รวมราคาทุนของทุกรายการ (ไม่มีเอกสารอื่นใช้ค่านี้)
  const installCostTotal = isInstallationIssue
    ? (items || []).reduce(
        (sum: number, item: any) =>
          sum + Number(item.quantity || 0) * Number(item.cost_price || 0),
        0,
      )
    : 0;

  const SummaryContent = () => (
    <>
      {isInstallationIssue ? (
        <>
          <View style={styles.financeRow}>
            <Text>มูลค่ารวม (ราคาขาย)</Text>
            <Text>
              {finance.subtotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
          <View style={styles.financeRow}>
            <Text>รวมต้นทุน (ราคาทุน)</Text>
            <Text>
              {installCostTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.financeRow}>
            <Text>รวมเป็นเงิน (Subtotal)</Text>
            <Text>
              {finance.subtotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
          {(finance.discount > 0 || formData?.document_type === "quotation") && (
            <View style={styles.financeRow}>
              <Text>หักส่วนลด (Discount)</Text>
              <Text>
                {finance.discount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          )}
          {/* 🧾 ยอดหลังหักส่วนลด (ไม่รวมมัดจำ) — แสดงเสมอก่อนภาษี ตาม pattern เดียวกับ POPdfTemplate.tsx เดิม
              ใช้ finance.after_discount ถ้ามี (คำนวณมาจากหน้าฟอร์มแล้ว) ไม่มีก็ fallback คำนวณเอง (เช่น sample data พรีวิว) */}
          <View style={styles.financeRow}>
            <Text>ยอดหลังหักส่วนลด</Text>
            <Text>
              {(finance.after_discount ?? finance.subtotal - finance.discount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        </>
      )}
      {deposit > 0 && (
        <View style={styles.financeRow}>
          <Text>หัก มัดจำ (Deposit)</Text>
          <Text>
            {deposit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </View>
      )}
      {deposit > 0 && (
        <View style={styles.financeRow}>
          <Text>จำนวนเงินหลังหักส่วนลด/มัดจำ</Text>
          <Text>
            {netBeforeVat.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>
      )}
      {!isInstallationIssue && formData.tax_type !== "none" && (
        <View style={styles.financeRow}>
          <Text>
            ภาษีมูลค่าเพิ่ม{" "}
            {formData.tax_type === "include" ? "(Vat รวมใน)" : "7%"}
          </Text>
          <Text>
            {finance.vat_amount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>
      )}
      {/* 🚀 ตัวเลขยอดรวมขยายใหญ่ขึ้นเฉพาะโหมด A4 (SummaryContent ถูก reuse กับโหมด Letter ด้วย ไม่แตะของเดิม) */}
      <View
        style={mergeStyle(styles.grandTotalRow, !isLetter && { fontSize: 16 })}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "bold",
            position: "relative",
            top: 0,
          }}
        >
          ยอดรวมทั้งสิ้น (Grand Total)
        </Text>
        <Text style={{ fontSize: 16, fontWeight: "bold" }}>
          {finance.grand_total.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      </View>
    </>
  );

  // ✍️ ชื่อตำแหน่งผู้ลงนามให้เหมาะกับเอกสารแต่ละประเภท
  const signatureLabels = (() => {
    switch (formData?.document_type) {
      case "quotation":
      case "custom_quotation":
        return {
          left: "ผู้สั่งซื้อ / Buyer",
          right: "ผู้อนุมัติ / Approved By",
        };
      case "billing_invoice":
        return {
          left: "ผู้รับวางบิล / Received By",
          right: "ผู้วางบิล / Submitted By",
        };
      case "cash":
      case "custom_cash":
      case "receipt":
        return {
          left: "ผู้ชำระเงิน / Paid By",
          right: "ผู้รับเงิน / Received By",
        };
      case "invoice":
        return {
          left: "ผู้รับเอกสาร / Received By",
          right: "ผู้ออกเอกสาร / Issued By",
        };
      case "tax_invoice":
        return {
          left: "ผู้รับสินค้า / Received By",
          right: "ผู้มีอำนาจลงนาม / Authorized By",
        };
      case "delivery_note":
        return {
          left: "ผู้รับสินค้า / Received By",
          right: "ผู้ส่งสินค้า / Delivered By",
        };
      case "credit_note":
      case "debit_note":
        return {
          left: "ผู้รับเอกสาร / Received By",
          right: "ผู้อนุมัติ / Approved By",
        };
      case "material_issue":
      case "installation_issue":
      case "stock_issue":
        return {
          left: "ผู้รับสินค้า / Received By",
          right: "ผู้อนุมัติเบิก / Approved By",
        };
      case "loan_issue":
        return {
          left: "ผู้ยืม / Borrower",
          right: "ผู้อนุมัติ / Approved By",
        };
      case "loan_return":
      case "stock_return":
      case "rental_stock_return":
        return {
          left: "ผู้คืนสินค้า / Returned By",
          right: "ผู้รับคืน / Received By",
        };
      case "packing_list":
        return {
          left: "ผู้จัดสินค้า / Packed By",
          right: "ผู้ตรวจสอบ / Checked By",
        };
      default:
        return {
          left: "ผู้รับเอกสาร / Received By",
          right: "ผู้อนุมัติ / Approved By",
        };
    }
  })();

  // ชื่อบุคคลที่กรอกเองยังคงแสดงได้ แต่ไม่ใช้แทนชื่อตำแหน่งผู้ลงนาม
  const customSignerName =
    ["custom_quotation", "custom_cash"].includes(formData?.document_type) &&
    formData?.custom_quoter_name
      ? formData.custom_quoter_name
      : "";

  // 👁️ ส่วนที่ปิด checkbox "แสดง" ไว้ในหน้าจัดวาง จะไม่ถูกพิมพ์ลง PDF จริง (undefined ถือว่าแสดงเสมอ เพื่อ backward-compat กับ config เก่า)
  const isVisible = (key: string) => layout[key]?.visible !== false;

  // --- ตัวช่วยกลาง (reuse ได้ทั้งกิ่ง tax_invoice/receipt และกิ่ง delivery_note ใหม่) ---

  const MetaRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.pMetaRow}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={{ fontSize: 9 }}>{value}</Text>
    </View>
  );

  const SummaryRow = ({ label, value }: { label: string; value: number }) => (
    <View style={styles.pSummaryRow}>
      <Text>{label}</Text>
      <Text>
        {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );

  const GrandTotalRow = ({
    label,
    value,
  }: {
    label: string;
    value: number;
  }) => (
    <View style={styles.pGrandTotalRow}>
      <Text>{label}</Text>
      <Text>
        {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );

  const GrandTotalTextRow = ({ value, center }: { value: number; center?: boolean }) => (
    <Text style={{ fontSize: 12, fontWeight: "bold", textAlign: center ? "center" : undefined }}>
      ({bahtText(value)})
    </Text>
  );

  // 🧩 ตารางสินค้าแบบกล่องรวมเดิม (ใช้เป็น fallback ของใบเสร็จแบบเก่าที่ยังไม่มี invoice_refs เท่านั้น
  // — ใบกำกับภาษี/ใบส่งสินค้าชั่วคราวเปลี่ยนไปใช้คอลัมน์อิสระแทนแล้ว ไม่เรียกฟังก์ชันนี้อีก)
  const PrintItemsTable = ({ bordered }: { bordered: boolean }) => (
    <>
      <View
        style={
          bordered ? styles.printTableHeaderPlain : styles.printTableHeaderPlain
        }
      >
        <Text style={styles.pColNo}>No.</Text>
        <Text style={styles.pColCode}>รหัสสินค้า</Text>
        <Text style={styles.pColDesc}>รายละเอียด</Text>
        <Text style={styles.pColQty}>จำนวน</Text>
        <Text style={styles.pColUPrice}>ราคา/หน่วย</Text>
        <Text style={styles.pColAmount}>จำนวนเงิน</Text>
      </View>
      {items.map((item: any, index: number) => {
        const isChildRow = !!(item.parent_item_id || item._parentRowId);
        const displayName =
          item.item_name || item.product_name || item.product?.name || "";
        if (isChildRow) {
          return (
            <View key={index} style={styles.printTableRowPlain}>
              <Text style={styles.pColNo}></Text>
              <Text style={styles.pColCode}>{item.sku || "-"}</Text>
              <Text style={[styles.pColDesc, { paddingLeft: 10 }]}>
                {"- "}
                {displayName}
                {showSerials && item.serials?.length > 0 && (
                  <Text style={styles.snNote}>
                    {"\n"}S/N: {formatSerials(item.serials)}
                  </Text>
                )}
              </Text>
              <Text style={styles.pColQty}>
                {item.quantity} {item.unit_name}
              </Text>
              <Text style={styles.pColUPrice}>-</Text>
              <Text style={styles.pColAmount}>-</Text>
            </View>
          );
        }
        return (
          <View key={index} style={styles.printTableRowPlain}>
            <Text style={styles.pColNo}>{getParentItemNumber(index)}</Text>
            <Text style={styles.pColCode}>{item.sku || "-"}</Text>
            <Text style={styles.pColDesc}>
              {displayName}
              {showSerials && item.serials?.length > 0 && (
                <Text style={styles.snNote}>
                  {"\n"}S/N: {formatSerials(item.serials)}
                </Text>
              )}
            </Text>
            <Text style={styles.pColQty}>
              {item.quantity} {item.unit_name}
            </Text>
            <Text style={styles.pColUPrice}>
              {Number(item.unit_price).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
            <Text style={styles.pColAmount}>
              {Number(item.total_price).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        );
      })}
    </>
  );

  const SignatureBox = ({ label }: { label: string }) => (
    <>
      <View style={styles.sigLine}></View>
      <Text style={styles.pSigLabel}>{label}</Text>
      <Text style={styles.pSigDate}>วันที่: _____/_____/_____</Text>
    </>
  );

  const CompanyStampBox = () => (
    <>
      <Text style={{ fontSize: 9, textAlign: "center" }}>
        ในนามบริษัท {displayCompanyName}
      </Text>
      <Text style={{ fontSize: 9, textAlign: "center", marginBottom: 6 }}>
        For {displayCompanyName}
      </Text>
      <View style={styles.sigLine}></View>
      <Text style={styles.pSigLabel}>
        ผู้มีอำนาจลงนาม / Authorized Signature
      </Text>
      <Text style={styles.pSigDate}>วันที่: _____/_____/_____</Text>
    </>
  );

  const isChildItemRow = (item: any) =>
    !!(item.parent_item_id || item._parentRowId);
  const itemDisplayName = (item: any) =>
    item.item_name || item.product_name || item.product?.name || "";

  // 🧩 คอลัมน์ตารางสินค้า (No./รหัส/รายละเอียด/จำนวน+หน่วย/ราคา-หน่วย/จำนวนเงิน) — ใช้ร่วมกันทั้งใบกำกับภาษีและใบส่งสินค้าชั่วคราว
  type ColDef = {
    header: string;
    align?: "center" | "right";
    render: (item: any, index: number) => string;
  };
  const PRODUCT_COLS: Record<string, ColDef> = {
    colNo: {
      header: "No.",
      align: "center",
      render: (item, index) =>
        isChildItemRow(item) ? "" : String(getParentItemNumber(index)),
    },
    colCode: {
      header: "รหัสสินค้า",
      align: "center",
      render: (item) => item.sku || "-",
    },
    colDesc: {
      header: "รายละเอียด",
      // 🔄 [2026-09-15] ย้าย S/N ไปขึ้นบรรทัดใหม่ของตัวเอง (เดิมต่อท้ายในบรรทัดเดียวกันเพื่อเลี่ยงปัญหาความสูงแถว
      // ไม่ตรงกันระหว่างคอลัมน์ — ตอนนี้แก้ที่ต้นตอแล้วด้วยการคำนวณตำแหน่ง Y ของแต่ละแถวล่วงหน้าแทน ดู
      // computeProductRowOffsets()/renderProductColumn() จึงขึ้นบรรทัดใหม่ได้อย่างปลอดภัย)
      render: (item) => {
        const name = isChildItemRow(item)
          ? `- ${itemDisplayName(item)}`
          : itemDisplayName(item);
        return showSerials && item.serials?.length > 0
          ? `${name}\nS/N: ${formatSerials(item.serials)}`
          : name;
      },
    },
    colQty: {
      header: "จำนวน",
      align: "center",
      render: (item) => `${item.quantity} ${item.unit_name}`,
    },
    colUnitPrice: {
      header: "ราคา/หน่วย",
      align: "right",
      render: (item) =>
        isChildItemRow(item)
          ? "-"
          : Number(item.unit_price).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            }),
    },
    colAmount: {
      header: "จำนวนเงิน",
      align: "right",
      render: (item) =>
        isChildItemRow(item)
          ? "-"
          : Number(item.total_price).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            }),
    },
  };

  // 🧩 คอลัมน์ตารางอ้างอิงใบกำกับภาษี (ของใบเสร็จ) — ลำดับ/เลขที่ใบกำกับ/วันที่/วันครบกำหนด/จำนวนเงิน/ยอดคงค้าง/ยอดชำระ
  type RefColDef = {
    header: string;
    align?: "center" | "right";
    render: (row: any, index: number) => string;
  };
  const REF_COLS: Record<string, RefColDef> = {
    colNo: {
      header: "ลำดับ",
      align: "center",
      render: (_row, index) => String(index + 1),
    },
    colInvoiceNumber: {
      header: "เลขที่ใบกำกับภาษี",
      render: (row) => row.document_number || "-",
    },
    colDate: {
      header: "วันที่",
      align: "center",
      render: (row) =>
        row.issue_date ? dayjs(row.issue_date).format("DD/MM/YYYY") : "-",
    },
    colDueDate: {
      header: "วันครบกำหนด",
      align: "center",
      render: (row) =>
        row.due_date ? dayjs(row.due_date).format("DD/MM/YYYY") : "-",
    },
    colAmount: {
      header: "จำนวนเงิน",
      align: "right",
      render: (row) =>
        Number(row.grand_total).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
    },
    colOutstanding: {
      header: "ยอดคงค้าง",
      align: "right",
      render: (row) =>
        Number(row.outstanding_balance).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
    },
    colPayment: {
      header: "ยอดชำระ",
      align: "right",
      render: (row) =>
        Number(row.payment_amount).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
    },
  };

  // 🆕 [2026-09-15] ตารางสินค้ากลุ่มนี้ (ใบกำกับภาษี/ใบเสร็จ/ใบส่งสินค้าชั่วคราว) วางแต่ละคอลัมน์เป็นกล่อง
  // absolute-position อิสระต่อกัน (ไม่ใช่ตาราง flex แถวเดียวกันเหมือน ItemsTableContent) — เดิมแต่ละคอลัมน์ปล่อยให้
  // Text ไหลต่อกันเองด้วย paddingVertical คงที่ ทำให้พอคอลัมน์ "รายละเอียด" ขึ้นบรรทัดใหม่ (ชื่อยาว/มี S/N) แถวถัดไป
  // ของคอลัมน์อื่นจะไม่ตรงแนวกับคอลัมน์นี้อีกต่อไป (เลื่อนขึ้นทับกัน) — แก้ด้วยการคำนวณ "ความสูงแถว" ของทุกแถวล่วงหน้า
  // จากค่าประมาณจำนวนบรรทัดของคอลัมน์รายละเอียด (ซึ่งเป็นคอลัมน์เดียวที่ความยาวข้อความแปรผันได้มาก) แล้ววางทุกคอลัมน์
  // ที่ตำแหน่ง Y สะสมเดียวกันเป๊ะด้วย position:absolute แทนการปล่อยไหลเอง
  const PRODUCT_ROW_LINE_HEIGHT = 11; // px ต่อบรรทัดโดยประมาณที่ fontSize 9
  const PRODUCT_ROW_V_PADDING = 6; // paddingVertical เดิม (3 บน + 3 ล่าง) รวมเป็นค่าคงที่ต่อแถว
  // ⚠️ react-pdf ไม่มี API วัดความกว้างข้อความจริงก่อน render จึงประมาณจากความกว้างตัวอักษรเฉลี่ยคร่าวๆ พอให้ระยะห่าง
  // แถวเพียงพอในเคสทั่วไป (S/N ยาวมากๆ หลายสิบตัวยังเสี่ยงประมาณคลาดได้ แต่ดีกว่าเดิมมาก ซึ่งไม่เผื่อเลย)
  const estimateLineCount = (text: string, widthPt: number) => {
    const avgCharWidth = 9 * 0.55;
    const charsPerLine = Math.max(10, Math.floor(widthPt / avgCharWidth));
    return Math.max(1, Math.ceil(text.length / charsPerLine));
  };
  const computeProductRowOffsets = (boxLayout: Record<string, Box | undefined>) => {
    const descWidthPt = boxLayout.colDesc?.width ?? 200;
    const offsets: number[] = [];
    let acc = 0;
    items.forEach((item: any) => {
      const namePart = isChildItemRow(item)
        ? `- ${itemDisplayName(item)}`
        : itemDisplayName(item);
      let lines = estimateLineCount(namePart, descWidthPt);
      if (showSerials && item.serials?.length > 0) {
        lines += estimateLineCount(`S/N: ${formatSerials(item.serials)}`, descWidthPt);
      }
      offsets.push(acc);
      acc += lines * PRODUCT_ROW_LINE_HEIGHT + PRODUCT_ROW_V_PADDING;
    });
    return offsets;
  };

  const renderProductColumn = (
    key: string,
    col: ColDef,
    boxLayout: Record<string, Box | undefined>,
    rowOffsets: number[],
  ) => {
    const box = boxLayout[key];
    if (!box || box.visible === false) return null;
    const headerHeight = 13; // fontSize 9 + marginBottom 2 โดยประมาณ
    return (
      <View key={key} style={[absoluteStyle(box), styles.letterAbsolute]}>
        <Text
          style={{
            fontWeight: "bold",
            fontSize: 9,
            marginBottom: 2,
            textAlign: col.align || "left",
          }}
        >
          {col.header}
        </Text>
        {items.map((item: any, index: number) => (
          <Text
            key={index}
            style={{
              position: "absolute",
              top: headerHeight + rowOffsets[index] + 3,
              left: 0,
              right: 0,
              fontSize: 9,
              textAlign: col.align || "left",
              // รายการย่อยใช้สีเดียวกับรายการแม่
              color: "#0f172a",
              paddingLeft: isChildItemRow(item) && key === "colDesc" ? 10 : 0,
            }}
          >
            {col.render(item, index)}
          </Text>
        ))}
      </View>
    );
  };

  const renderRefColumn = (
    key: string,
    col: RefColDef,
    boxLayout: Record<string, Box | undefined>,
  ) => {
    const box = boxLayout[key];
    if (!box || box.visible === false) return null;
    return (
      <View key={key} style={[absoluteStyle(box), styles.letterAbsolute]}>
        <Text
          style={{
            fontWeight: "bold",
            fontSize: 9,
            marginBottom: 2,
            textAlign: col.align || "left",
          }}
        >
          {col.header}
        </Text>
        {(invoiceRefs || []).map((row: any, index: number) => (
          <Text
            key={index}
            style={{
              fontSize: 9,
              paddingVertical: 3,
              textAlign: col.align || "left",
            }}
          >
            {col.render(row, index)}
          </Text>
        ))}
      </View>
    );
  };

  // 🖨️ tax_invoice/receipt ใช้ดีไซน์เฉพาะกลุ่มนี้บน Letter/Half Letter เท่านั้น — แยก layout อิสระต่อประเภท
  // เอกสารผ่าน printLayoutDefaults.ts คนละชุดกับ letter_layout ที่ใช้ร่วมกันสำหรับ quotation ฯลฯ
  // 🆕 [โมดูล A4] บน A4 ทั้ง 2 ประเภทนี้ย้ายไปใช้ระบบกล่องแบบเดียวกับ quotation/invoice (กิ่ง else ด้านล่าง) แทน
  // ผ่านกลุ่มใหม่ "tax_invoice_delivery"/"receipt" ใน a4LayoutDefaults.ts แล้ว (getPaperSizeConfig ส่ง layout
  // ของกลุ่มใหม่มาให้ผ่าน prop letterLayout อยู่แล้วเมื่อ paperSize==="A4") — ไม่กระทบ Letter/Half Letter เดิมเลย
  // delivery_note ย้ายออกไปใช้ letter-layout แล้ว ไม่เข้ากิ่งนี้อีกต่อไป (isPrintLayoutGroup ไม่รวม delivery_note แล้ว)
  if (isPrintLayoutGroup(formData?.document_type) && paperSize !== "A4") {
    const printGroup: PrintLayoutGroup = formData.document_type;
    const printPaperSize: PaperSize = (paperSize as PaperSize) || "Letter";
    const pLayout: PrintLayoutConfig = {
      ...DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE[printPaperSize][printGroup],
      ...(printLayout || {}),
    };
    const pVisible = (key: string) => pLayout[key]?.visible !== false;
    // 🆕 invoice (ใบแจ้งหนี้) ใช้โครงสร้างเดียวกับ tax_invoice ทุกประการ (ตารางสินค้า/สรุปยอด/ลายเซ็น 3 จุด)
    const isTax = printGroup === "tax_invoice" || printGroup === "invoice";
    const printPageDims = PRINT_PAGE_DIMENSIONS[printPaperSize];
    // 🆕 [2026-09-15] คำนวณครั้งเดียวก่อน render ตารางสินค้า (ไม่ต้องคำนวณซ้ำต่อคอลัมน์) ดู renderProductColumn()
    const productRowOffsets = isTax ? computeProductRowOffsets(pLayout) : [];

    const dueDateDisplay = formData.due_date
      ? dayjs(formData.due_date).format("DD/MM/YYYY")
      : formData.credit_days > 0 && formData.issue_date
        ? dayjs(formData.issue_date)
            .add(formData.credit_days, "day")
            .format("DD/MM/YYYY")
        : "-";

    return (
      <Document>
        <Page size={[printPageDims.width, printPageDims.height]} style={styles.pageLetter}>
          {/* 🖨️ ข้อมูลบริษัท — ซ่อน default บน Letter/Half Letter (พิมพ์ทับกระดาษหัวจดหมายที่มีอยู่แล้ว)
              แต่โชว์ default บน A4 (ไม่มีหัวจดหมายจริงให้พิมพ์ทับ) ดู DEFAULT_PRINT_LAYOUTS_A4 override ใน
              printLayoutDefaults.ts — เนื้อหาเหมือนกล่อง companyInfo ของกลุ่ม "shared" ทุกประการ */}
          {pVisible("companyInfo") && (
            <View style={[absoluteStyle(pLayout.companyInfo), styles.letterAbsolute]}>
              <View style={{ flexDirection: "row" }}>
                {displayLogo && <Image src={displayLogo} style={styles.companyLogo} />}
                <View style={styles.companyInfo}>
                  <Text style={styles.companyName}>{displayCompanyName}</Text>
                  <Text>{displayCompanyAddress}</Text>
                  <Text>
                    เลขประจำตัวผู้เสียภาษี: {companySettings?.tax_id || "-"} | โทร:{" "}
                    {companySettings?.phone || "-"}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 🎨 แถบสีคั่นหัวเอกสาร — เฉพาะ A4 เท่านั้น (Letter/Half Letter ไม่มีผล) ใช้สีเดียวกับสีฟ้าเดิมที่
              กลุ่มนี้ใช้อยู่แล้ว (styles.letterTitle) ไม่แยกระบบสีใหม่เฉพาะกลุ่มนี้ */}
          {printPaperSize === "A4" && pVisible("headerDivider") && pLayout.headerDivider && (
            <View
              style={[
                absoluteStyle(pLayout.headerDivider),
                { backgroundColor: getA4AccentColor(companySettings, "shared") },
              ]}
            />
          )}

          {pVisible("title") && (
            <View style={[absoluteStyle(pLayout.title), styles.letterAbsolute]}>
              <Text style={styles.letterTitle}>
                {getDocumentName(printGroup)}
              </Text>
              <Text style={styles.documentCopy}>ต้นฉบับ (Original)</Text>
            </View>
          )}

          {/* --- ข้อมูลลูกค้า: ชื่อ/ที่อยู่/เลขผู้เสียภาษี แยกกล่องอิสระ --- */}
          {pVisible("customerName") && (
            <View
              style={[
                absoluteStyle(pLayout.customerName),
                styles.letterAbsolute,
              ]}
            >
              <CustomerNameOnly />
            </View>
          )}
          {pVisible("customerAddress") && (
            <View
              style={[
                absoluteStyle(pLayout.customerAddress),
                styles.letterAbsolute,
              ]}
            >
              <CustomerAddressOnly />
            </View>
          )}
          {pVisible("customerTaxId") && (
            <View
              style={[
                absoluteStyle(pLayout.customerTaxId),
                styles.letterAbsolute,
              ]}
            >
              <CustomerTaxIdOnly />
            </View>
          )}

          {/* --- เลขที่/วันที่/เงื่อนไข ฯลฯ แยกกล่องอิสระ (ต่างกันตามใบกำกับภาษี/ใบเสร็จ) --- */}
          {isTax ? (
            <>
              {pVisible("metaDocNumber") && (
                <View
                  style={[
                    absoluteStyle(pLayout.metaDocNumber),
                    styles.letterAbsolute,
                  ]}
                >
                  <MetaRow
                    label={
                      printGroup === "invoice"
                        ? "เลขที่ใบแจ้งหนี้ / Invoice No.:"
                        : "เลขที่ใบกำกับภาษี / Tax Invoice No.:"
                    }
                    value={documentNumber || formData.document_number}
                  />
                </View>
              )}
              {getRepeatableDateKeys(pLayout).map(
                (key) =>
                  pVisible(key) && (
                    <View
                      key={key}
                      style={[
                        absoluteStyle(pLayout[key]),
                        styles.letterAbsolute,
                      ]}
                    >
                      <MetaRow
                        label="วันที่ / Date:"
                        value={dayjs(formData.issue_date).format("DD/MM/YYYY")}
                      />
                    </View>
                  ),
              )}
              {pVisible("metaPaymentTerm") && (
                <View
                  style={[
                    absoluteStyle(pLayout.metaPaymentTerm),
                    styles.letterAbsolute,
                  ]}
                >
                  <MetaRow
                    label="เงื่อนไข / Term of Payment:"
                    value={
                      formData.credit_days > 0
                        ? `เครดิต ${formData.credit_days} วัน`
                        : "เงินสด"
                    }
                  />
                </View>
              )}
              {pVisible("metaDueDate") && (
                <View
                  style={[
                    absoluteStyle(pLayout.metaDueDate),
                    styles.letterAbsolute,
                  ]}
                >
                  <MetaRow
                    label="กำหนดชำระ / Due Date:"
                    value={dueDateDisplay}
                  />
                </View>
              )}
              {pVisible("metaTransportation") && (
                <View
                  style={[
                    absoluteStyle(pLayout.metaTransportation),
                    styles.letterAbsolute,
                  ]}
                >
                  <MetaRow
                    label="การขนส่ง / Transportation:"
                    value={formData.transportation || "-"}
                  />
                </View>
              )}
              {pVisible("metaSalesman") && (
                <View
                  style={[
                    absoluteStyle(pLayout.metaSalesman),
                    styles.letterAbsolute,
                  ]}
                >
                  <MetaRow
                    label="รหัสพนักงานขาย / Saleman No.:"
                    value={formData.saleman_code || "-"}
                  />
                </View>
              )}
              {pVisible("metaPoNumber") && (
                <View
                  style={[
                    absoluteStyle(pLayout.metaPoNumber),
                    styles.letterAbsolute,
                  ]}
                >
                  <MetaRow
                    label="เลขที่ P.O. No.:"
                    value={formData.reference_number || "-"}
                  />
                </View>
              )}
            </>
          ) : (
            <>
              {pVisible("metaDocNumber") && (
                <View
                  style={[
                    absoluteStyle(pLayout.metaDocNumber),
                    styles.letterAbsolute,
                  ]}
                >
                  <MetaRow
                    label="เลขที่ใบเสร็จ / Receipt No.:"
                    value={documentNumber || formData.document_number}
                  />
                </View>
              )}
              {getRepeatableDateKeys(pLayout).map(
                (key) =>
                  pVisible(key) && (
                    <View
                      key={key}
                      style={[
                        absoluteStyle(pLayout[key]),
                        styles.letterAbsolute,
                      ]}
                    >
                      <MetaRow
                        label="วันที่ / Date:"
                        value={dayjs(formData.issue_date).format("DD/MM/YYYY")}
                      />
                    </View>
                  ),
              )}
            </>
          )}

          {/* --- ตารางสินค้า (ใบกำกับภาษี) หรือ ตารางอ้างอิงใบกำกับ (ใบเสร็จ) — แยกคอลัมน์อิสระ --- */}
          {isTax ? (
            Object.entries(PRODUCT_COLS).map(([key, col]) =>
              renderProductColumn(key, col, pLayout, productRowOffsets),
            )
          ) : hasInvoiceRefs ? (
            Object.entries(REF_COLS).map(([key, col]) =>
              renderRefColumn(key, col, pLayout),
            )
          ) : (
            // 🛡️ fallback: ใบเสร็จรุ่นเก่าที่ยังไม่มี invoice_refs (สร้างด้วยรายการสินค้าตรงๆ แบบก่อนมีฟีเจอร์อ้างอิงหลายใบ)
            // แสดงตารางสินค้าแบบกล่องรวมเดิมในพื้นที่รวมของกล่องคอลัมน์อ้างอิง เพื่อไม่ให้พิมพ์ออกมาว่างเปล่า
            <View
              style={[
                absoluteStyle(
                  getColumnsBoundingBox(pLayout, Object.keys(REF_COLS)),
                ),
                styles.letterAbsolute,
              ]}
            >
              <PrintItemsTable bordered={false} />
            </View>
          )}

          {pVisible("remark") && (
            <View
              style={[absoluteStyle(pLayout.remark), styles.letterAbsolute]}
            >
              <Text style={styles.sectionTitle}>หมายเหตุ / Remark</Text>
              <Text style={{ fontSize: 9 }}>{formData.note || "-"}</Text>
            </View>
          )}

          {/* --- สรุปยอด: แยกบรรทัดเป็นกล่องอิสระ (5 บรรทัดของใบกำกับภาษี / 3 บรรทัดของใบเสร็จ) + จำนวนเงินเป็นตัวอักษรไทย --- */}
          {isTax ? (
            <>
              {pVisible("summarySubtotal") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summarySubtotal),
                    styles.letterAbsolute,
                  ]}
                >
                  <SummaryRow
                    label="รวมเป็นเงิน / Sub Total"
                    value={finance.subtotal}
                  />
                </View>
              )}
              {finance.discount > 0 && pVisible("summaryDiscount") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summaryDiscount),
                    styles.letterAbsolute,
                  ]}
                >
                  <SummaryRow
                    label="หัก ส่วนลด / Discount"
                    value={finance.discount}
                  />
                </View>
              )}
              {pVisible("summaryAfterDiscount") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summaryAfterDiscount),
                    styles.letterAbsolute,
                  ]}
                >
                  <SummaryRow
                    label="จำนวนเงินหลังหักส่วนลด/มัดจำ"
                    value={netBeforeVat}
                  />
                </View>
              )}
              {formData.tax_type !== "none" && pVisible("summaryVat") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summaryVat),
                    styles.letterAbsolute,
                  ]}
                >
                  <SummaryRow
                    label={`ภาษีมูลค่าเพิ่ม / Vat ${formData.tax_type === "include" ? "(รวมใน)" : "7%"}`}
                    value={finance.vat_amount}
                  />
                </View>
              )}
              {pVisible("summaryGrandTotal") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summaryGrandTotal),
                    styles.letterAbsolute,
                  ]}
                >
                  <GrandTotalRow
                    label="จำนวนเงินรวมทั้งสิ้น / Grand Total"
                    value={finance.grand_total}
                  />
                </View>
              )}
              {pVisible("summaryGrandTotalText") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summaryGrandTotalText),
                    styles.letterAbsolute,
                  ]}
                >
                  <GrandTotalTextRow value={finance.grand_total} />
                </View>
              )}
            </>
          ) : (
            <>
              {pVisible("summaryTotal") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summaryTotal),
                    styles.letterAbsolute,
                  ]}
                >
                  <SummaryRow
                    label="รวมจำนวนเงิน / Total Amount"
                    value={finance.subtotal}
                  />
                </View>
              )}
              {formData.tax_type !== "none" && pVisible("summaryVat") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summaryVat),
                    styles.letterAbsolute,
                  ]}
                >
                  <SummaryRow
                    label="ภาษีมูลค่าเพิ่ม / Vat %"
                    value={finance.vat_amount}
                  />
                </View>
              )}
              {pVisible("summaryGrandTotal") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summaryGrandTotal),
                    styles.letterAbsolute,
                  ]}
                >
                  <GrandTotalRow
                    label="รวมทั้งสิ้น / Grand Total"
                    value={finance.grand_total}
                  />
                </View>
              )}
              {pVisible("summaryGrandTotalText") && (
                <View
                  style={[
                    absoluteStyle(pLayout.summaryGrandTotalText),
                    styles.letterAbsolute,
                  ]}
                >
                  <GrandTotalTextRow value={finance.grand_total} />
                </View>
              )}
            </>
          )}

          {isTax ? (
            <>
              {pVisible("signatureReceiver") && (
                <View
                  style={[
                    absoluteStyle(pLayout.signatureReceiver),
                    styles.letterAbsolute,
                  ]}
                >
                  <View style={styles.sigBoxFullNoBorder}>
                    <SignatureBox label="ผู้รับสินค้า / Received By" />
                  </View>
                </View>
              )}
              {pVisible("signatureDelivered") && (
                <View
                  style={[
                    absoluteStyle(pLayout.signatureDelivered),
                    styles.letterAbsolute,
                  ]}
                >
                  <View style={styles.sigBoxFullNoBorder}>
                    <SignatureBox label="ผู้ส่งของ / Delivered By" />
                  </View>
                </View>
              )}
              {pVisible("signatureChecked") && (
                <View
                  style={[
                    absoluteStyle(pLayout.signatureChecked),
                    styles.letterAbsolute,
                  ]}
                >
                  <View style={styles.sigBoxFullNoBorder}>
                    <SignatureBox label="ผู้ตรวจสอบ / Checked By" />
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              {pVisible("signaturePreparedBy") && (
                <View
                  style={[
                    absoluteStyle(pLayout.signaturePreparedBy),
                    styles.letterAbsolute,
                  ]}
                >
                  <View style={styles.sigBoxFullNoBorder}>
                    <SignatureBox label="ผู้ออกเอกสาร / Prepared By" />
                  </View>
                </View>
              )}
              {pVisible("signatureCollector") && (
                <View
                  style={[
                    absoluteStyle(pLayout.signatureCollector),
                    styles.letterAbsolute,
                  ]}
                >
                  <View style={styles.sigBoxFullNoBorder}>
                    <SignatureBox label="ผู้รับเงิน / Collector" />
                  </View>
                </View>
              )}
            </>
          )}
          {pVisible("companyStamp") && (
            <View
              style={[
                absoluteStyle(pLayout.companyStamp),
                styles.letterAbsolute,
              ]}
            >
              <View style={styles.sigBoxFullNoBorder}>
                <CompanyStampBox />
              </View>
            </View>
          )}
        </Page>
      </Document>
    );
  }

  // --- ใบส่งสินค้าชั่วคราว — ย้ายมาอยู่ใต้ company/letter-layout แล้ว (กลุ่ม delivery_note แยกอิสระ ไม่กระทบกลุ่ม shared) ---
  // เอาเส้นกรอบออกทั้งหมดยกเว้นกล่อง conditionsText (ข้อยกเว้นเดียว) — ต่างจากดีไซน์เดิมที่วาดกรอบเต็มรูปแบบทุกกล่อง
  if (formData?.document_type === "delivery_note") {
    // 🖨️ กล่องของ delivery_note ละเอียด/ครบอยู่แล้ว (มีข้อมูลบริษัทของตัวเองแยก 3 กล่อง) ใช้ระบบ
    // absolute-position เดียวกันได้ทั้ง A4/Letter แค่สลับ default ตามกระดาษที่เลือก
    const dnLayout: LetterLayoutConfig = {
      ...(isLetter
        ? DEFAULT_LETTER_LAYOUTS.delivery_note
        : isHalfLetter
          ? DEFAULT_HALF_LETTER_LAYOUTS.delivery_note
          : DEFAULT_A4_LAYOUTS.delivery_note),
      ...(deliveryNoteLetterLayout || {}),
    };
    const dnVisible = (key: string) => dnLayout[key]?.visible !== false;

    return (
      <Document>
        <Page size={pdfPageSize} style={styles.pageLetter}>
          {/* --- ข้อมูลบริษัท: รวมชื่อ(+โลโก้)/ที่อยู่/เลขผู้เสียภาษี เป็นกล่องเดียว (เดิมแยก 3 กล่องย่อย) --- */}
          {dnVisible("companyInfo") && (
            <View
              style={[absoluteStyle(dnLayout.companyInfo), styles.letterAbsolute]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {displayLogo && (
                  <Image
                    src={displayLogo}
                    style={{ width: 36, height: 36, objectFit: "contain", marginRight: 8 }}
                  />
                )}
                <Text style={{ fontSize: 14, fontWeight: "bold" }}>{displayCompanyName}</Text>
              </View>
              <Text style={{ fontSize: 9, marginTop: 4 }}>{companySettings?.address || "-"}</Text>
              <Text style={{ fontSize: 9, marginTop: 2 }}>
                โทร: {companySettings?.phone || "-"} | เลขประจำตัวผู้เสียภาษี:{" "}
                {companySettings?.tax_id || "-"}
              </Text>
            </View>
          )}

          {dnVisible("title") && (
            <View
              style={[absoluteStyle(dnLayout.title), styles.letterAbsolute]}
            >
              <Text style={{ ...styles.letterTitle, textAlign: "center" }}>
                ใบส่งสินค้าชั่วคราว (Temporary Delivery Note)
              </Text>
            </View>
          )}

          {/* --- ข้อมูลลูกค้า: รวมชื่อ/ที่อยู่/เลขผู้เสียภาษี เป็นกล่องเดียว (เดิมแยก 3 กล่องย่อย) --- */}
          {dnVisible("customerInfo") && (
            <View
              style={[absoluteStyle(dnLayout.customerInfo), styles.letterAbsolute]}
            >
              <View style={styles.customerBoxFull}>
                <CustomerNameOnly />
                <CustomerAddressOnly />
                <CustomerTaxIdOnly />
              </View>
            </View>
          )}

          {/* --- ข้อมูลเอกสาร: รวมเลขที่/วันที่/เลขที่ใบสั่งซื้อ/พนักงาน/เงื่อนไข เป็นกล่องเดียว (เดิมแยก 5 กล่องย่อย) --- */}
          {dnVisible("metaInfo") && (
            <View
              style={[absoluteStyle(dnLayout.metaInfo), styles.letterAbsolute]}
            >
              <View style={styles.metaBoxFull}>
                <MetaRow
                  label="เลขที่ / No.:"
                  value={documentNumber || formData.document_number}
                />
                {/* 🛡️ เดิมกดเพิ่มวันที่ซ้ำได้หลายบรรทัด (แต่ละบรรทัดเป็นกล่องแยก) — หลังรวมเป็นกล่องเดียวไม่มีแนวคิด
                    "กล่องซ้ำ" อีกแล้ว เหลือวันที่บรรทัดเดียวพอ (เหมือน metaInfo ของกลุ่ม shared ที่ไม่มี repeatable ด้วย) */}
                <MetaRow
                  label="วันที่ / Date:"
                  value={dayjs(formData.issue_date).format("DD/MM/YYYY")}
                />
                <MetaRow
                  label="เลขที่ใบสั่งซื้อ / Order No.:"
                  value={formData.reference_number || "-"}
                />
                <MetaRow
                  label="พนักงานขาย / Salesman No.:"
                  value={formData.saleman_code || "-"}
                />
                <MetaRow
                  label="เงื่อนไข / Term:"
                  value={
                    formData.credit_days > 0
                      ? `เครดิต ${formData.credit_days} วัน`
                      : "เงินสด"
                  }
                />
              </View>
            </View>
          )}

          {/* --- ตารางสินค้า: กล่องเดียวรวมทุกคอลัมน์ (เดิมแยก 6 กล่องอิสระ — ผู้ใช้ขอให้รวมกลับเป็นกล่องเดียว
              เฉพาะหน้านี้ ไม่มีเส้นกรอบ/เส้นระหว่างแถวเหมือนเดิม) --- */}
          {dnVisible("itemsTable") && (
            <View
              style={[
                absoluteStyle(dnLayout.itemsTable),
                {
                  height: computeStretchedItemsTableHeight(
                    dnLayout,
                    isLetter ? LETTER_PAGE_HEIGHT : isHalfLetter ? HALF_LETTER_PAGE_HEIGHT : A4_PAGE_HEIGHT,
                  ),
                },
                styles.letterAbsolute,
              ]}
            >
              <PrintItemsTable bordered={false} />
            </View>
          )}

          {/* --- เงื่อนไขท้ายเอกสาร: ข้อยกเว้นเดียวที่ยังมีกรอบ --- */}
          {dnVisible("conditionsText") && (
            <View
              style={[
                absoluteStyle(dnLayout.conditionsText),
                styles.letterAbsolute,
              ]}
            >
              <View style={styles.printBorderedSection}>
                <Text style={{ fontSize: 9 }}>
                  1. กรุณาตรวจสอบสภาพและจำนวนสินค้าก่อนเซ็นรับ
                  หากพบความเสียหายกรุณาแจ้งผู้ส่งทันที
                </Text>
                <Text style={{ fontSize: 9, marginTop: 2 }}>
                  2. บริษัทจะคิดดอกเบี้ยในอัตรา 2% ต่อเดือนของยอดค้างชำระ
                </Text>
              </View>
            </View>
          )}

          {/* --- สรุปยอด: รวม 6 บรรทัด (รวมเงิน/ส่วนลด/หลังหักส่วนลด/ภาษี/ยอดสุทธิ/ตัวอักษร) เป็นกล่องเดียว
              (เดิมแยก 6 กล่องย่อย) --- */}
          {dnVisible("summary") && (
            <View
              style={[absoluteStyle(dnLayout.summary), styles.letterAbsolute]}
            >
              <View style={styles.financeBoxFull}>
                <SummaryRow label="รวมเงิน / Sub Total" value={finance.subtotal} />
                <SummaryRow label="ส่วนลด / Discount" value={finance.discount} />
                <SummaryRow
                  label="ยอดรวมหลังหักส่วนลด / Net Amount"
                  value={finance.subtotal - finance.discount}
                />
                {formData.tax_type !== "none" && (
                  <SummaryRow
                    label="ภาษีมูลค่าเพิ่ม / Value Added Tax"
                    value={finance.vat_amount}
                  />
                )}
                <GrandTotalRow label="ยอดสุทธิ / Net Total" value={finance.grand_total} />
                <GrandTotalTextRow value={finance.grand_total} />
              </View>
            </View>
          )}

          {dnVisible("signatureReceiver") && (
            <View
              style={[
                absoluteStyle(dnLayout.signatureReceiver),
                styles.letterAbsolute,
              ]}
            >
              {/* 🛡️ เดิมเส้นเซ็น (sigLine ใน SignatureBox) อยู่ติดขอบบนกล่องทันที (แค่ padding 10pt) แทบไม่มีที่ว่าง
                  ให้เซ็นจริงด้านบนเส้น — เติมกล่องว่าง flexGrow:1 ไว้ก่อนเสมอ ดันเนื้อหาที่เหลือ (เส้น/ป้ายกำกับ/
                  วันที่) ลงไปชิดขอบล่างแทน ใช้ flexGrow แทนความสูงคงที่เพื่อไม่พึ่งขนาดกล่องเจาะจง (ปรับความสูง
                  กล่องภายหลังได้โดยไม่ต้องแก้ตรงนี้อีก) */}
              <View style={styles.sigBoxFullNoBorder}>
                <View style={{ flexGrow: 1 }} />
                <SignatureBox label="ผู้รับของ / Receiver" />
              </View>
            </View>
          )}
          {dnVisible("signatureDelivered") && (
            <View
              style={[
                absoluteStyle(dnLayout.signatureDelivered),
                styles.letterAbsolute,
              ]}
            >
              <View style={styles.sigBoxFullNoBorder}>
                <View style={{ flexGrow: 1 }} />
                <SignatureBox label="ผู้ส่งของ / Delivered" />
              </View>
            </View>
          )}
          {dnVisible("signatureChecked") && (
            <View
              style={[
                absoluteStyle(dnLayout.signatureChecked),
                styles.letterAbsolute,
              ]}
            >
              <View style={styles.sigBoxFullNoBorder}>
                <View style={{ flexGrow: 1 }} />
                <SignatureBox label="ผู้ตรวจสอบ / Checked" />
              </View>
            </View>
          )}
          {dnVisible("companyStamp") && (
            <View
              style={[
                absoluteStyle(dnLayout.companyStamp),
                styles.letterAbsolute,
              ]}
            >
              <View style={styles.sigBoxFullNoBorder}>
                <View style={{ flexGrow: 1 }} />
                <CompanyStampBox />
              </View>
            </View>
          )}
        </Page>
      </Document>
    );
  }

  // 🖨️ กล่องอิสระ (drag x/y) ใช้ร่วมกันทั้ง A4/Letter — เดิมมีแค่ Letter ส่วน A4 เป็น flow เขียนตายตัว
  // แยกคนละดีไซน์เฉพาะ (เช่น แถบสีใบเสนอราคา/ตารางยืดเต็มพื้นที่) ตัดออกแล้วตามที่ผู้ใช้ยืนยัน
  // (ลากวางตำแหน่งอิสระสำคัญกว่าดีไซน์เฉพาะจุด) เหลือกล่องเดียวกันทุกประเภทเอกสาร ปรับตำแหน่งเองได้ทั้งหมด
  return (
    <Document>
      <Page size={pdfPageSize} style={styles.pageLetter}>
        {/* 🖼️ พื้นหลังจางเต็มหน้า (watermark) — เฉพาะ A4 (Letter สมมติพิมพ์ทับกระดาษหัวจดหมายอยู่แล้ว)
            🛡️ เดิมวางเต็มหน้ากระดาษ ตอนนี้จำกัดพื้นที่อยู่แค่ในกล่องตารางรายการสินค้าเท่านั้นตามที่ผู้ใช้ขอ —
            ความจาง/ขนาดปรับได้จากหน้าตั้งค่า (getA4WatermarkOpacity/getA4WatermarkSize) แทน 0.08/เต็มกล่องที่เคย
            hardcode ตายตัว — ขนาดคำนวณเป็น % ของกล่องตารางรายการสินค้า ยังคงอยู่กึ่งกลางกล่องเสมอ */}
        {!isLetter && documentWatermarkUrl && layout.itemsTable && (
          <View
            style={[
              absoluteStyle(layout.itemsTable),
              { justifyContent: "center", alignItems: "center", overflow: "hidden", zIndex: -1 },
            ]}
          >
            <Image
              src={documentWatermarkUrl}
              style={{
                width: layout.itemsTable.width * (getA4WatermarkSize(companySettings) / 100),
                height: layout.itemsTable.height * (getA4WatermarkSize(companySettings) / 100),
                objectFit: "contain",
                opacity: getA4WatermarkOpacity(companySettings) / 100,
              }}
            />
          </View>
        )}

        {/* --- เลขหน้า (แสดงเมื่อเอกสารล้นเกิน 1 หน้า) — เฉพาะ A4 (ของเดิม) --- */}
        {!isLetter && (
          <Text
            style={{ position: "absolute", top: 12, right: 30, fontSize: 9, color: "#64748b" }}
            render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
            fixed
          />
        )}

        {isVisible("companyInfo") && (
          <View style={[absoluteStyle(layout.companyInfo), styles.letterAbsolute, getA4BoxFillStyle(layout.companyInfo, a4FillOpts)]}>
            <View style={{ flexDirection: "row" }}>
              {displayLogo && <Image src={displayLogo} style={styles.companyLogo} />}
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{displayCompanyName}</Text>
                <Text>{displayCompanyAddress}</Text>
                <Text>
                  เลขประจำตัวผู้เสียภาษี: {companySettings?.tax_id || "-"} | โทร:{" "}
                  {companySettings?.phone || "-"}
                </Text>
              </View>
            </View>
          </View>
        )}

          {isVisible("title") &&
            (paperSize === "A4" ? (
              // 🖨️ A4: หัวเอกสารแบบเดิม — ไทยบน มีเส้นคั่นสีตามกลุ่ม (getA4AccentColor) อังกฤษเล็กกว่า 40% ด้านล่าง
              // 🛡️ alignItems:"flex-end" ให้ข้อความชิดขวา + เส้นคั่นหุ้มความกว้างข้อความพอดี (ไม่ใช่เต็มกล่อง) ตาม
              // docTitleBox ต้นแบบของ POPdfTemplate.tsx เดิม — ไม่งั้น Text จะ stretch เต็มกล่องตาม flexbox default
              // (alignItems:"stretch") ทำให้เส้นคั่นลากยาวเกินตัวหนังสือ ดูไม่เหมือนต้นแบบ
              <View style={[absoluteStyle(layout.title), styles.letterAbsolute, { alignItems: "flex-end" }, getA4BoxFillStyle(layout.title, a4FillOpts)]}>
                <Text
                  style={[
                    styles.documentTitleTh,
                    { borderBottom: `3px solid ${getA4AccentColor(companySettings, "shared")}` },
                  ]}
                >
                  {getDocumentTitleParts(formData.document_type).th}
                </Text>
                <Text style={styles.documentTitleEn}>
                  {getDocumentTitleParts(formData.document_type).en}
                </Text>
                <Text style={styles.documentCopy}>
                  {formData.document_type === "tax_invoice" ||
                  formData.document_type === "receipt"
                    ? "ต้นฉบับ (Original)"
                    : "เอกสารออกเป็นชุด"}
                </Text>
              </View>
            ) : (
              <View style={[absoluteStyle(layout.title), styles.letterAbsolute, getA4BoxFillStyle(layout.title, a4FillOpts)]}>
                <Text style={styles.letterTitle}>
                  {getDocumentName(formData.document_type)}
                </Text>
                <Text style={styles.documentCopy}>
                  {formData.document_type === "tax_invoice" ||
                  formData.document_type === "receipt"
                    ? "ต้นฉบับ (Original)"
                    : "เอกสารออกเป็นชุด"}
                </Text>
              </View>
            ))}

          {/* 🎨 แถบสี (tab) คั่นหัวเอกสาร — เฉพาะ A4 เท่านั้น ปรับสีได้แยกต่อกลุ่มเอกสารจากหน้า editor */}
          {paperSize === "A4" && isVisible("headerDivider") && layout.headerDivider && (
            <View
              style={[
                absoluteStyle(layout.headerDivider),
                { backgroundColor: getA4AccentColor(companySettings, "shared") },
              ]}
            />
          )}

          {isVisible("customerInfo") && (
            <View
              style={[
                absoluteStyle(layout.customerInfo),
                styles.letterAbsolute,
                getA4BoxFillStyle(layout.customerInfo, a4FillOpts),
              ]}
            >
              <View style={styles.customerBoxFull}>
                <CustomerContent />
              </View>
            </View>
          )}

          {isVisible("metaInfo") && (
            <View
              style={[absoluteStyle(layout.metaInfo), styles.letterAbsolute, getA4BoxFillStyle(layout.metaInfo, a4FillOpts)]}
            >
              <View style={styles.metaBoxFull}>
                <MetaContent />
              </View>
            </View>
          )}

          {isVisible("itemsTable") && (
            <View
              style={[
                absoluteStyle(layout.itemsTable),
                styles.letterAbsolute,
                // 📐 ยืดสูงเต็มพื้นที่ที่เหลือจริงเสมอ (แม้มีแค่ 1 รายการ) ดันหมายเหตุ/สรุปยอด/ลายเซ็นให้ดูติดกับตาราง
                { height: computeStretchedItemsTableHeight(layout, isLetter ? LETTER_PAGE_HEIGHT : isHalfLetter ? HALF_LETTER_PAGE_HEIGHT : A4_PAGE_HEIGHT) },
                getA4BoxFillStyle(layout.itemsTable, a4FillOpts),
              ]}
            >
              <View style={styles.tableGrow}>
                {hasInvoiceRefs ? (
                  <InvoiceRefsTableContent />
                ) : (
                  <ItemsTableContent />
                )}
              </View>
            </View>
          )}

          {isVisible("notes") && (
            <View
              style={[
                absoluteStyle(
                  usePkgWidth
                    ? getColumnsBoundingBox(layout, ["notes", "summary"])
                    : layout.notes,
                ),
                styles.letterAbsolute,
                getA4BoxFillStyle(layout.notes, a4FillOpts),
              ]}
            >
              <View style={styles.noteBoxFull}>
                <NotesContent />
              </View>
            </View>
          )}

          {isVisible("summary") && showPriceCols && (
            <View
              style={[absoluteStyle(layout.summary), styles.letterAbsolute, getA4BoxFillStyle(layout.summary, a4FillOpts)]}
            >
              <View style={styles.financeBoxFull}>
                <SummaryContent />
              </View>
            </View>
          )}

          {/* 🇹🇭 จำนวนเงินเป็นตัวอักษรไทย — ใช้ร่วมกับ quotation/billing_invoice/cash/credit_note/debit_note ทุกประเภท
              🛡️ เดิมเช็ค `&& layout.grandTotalText` เพิ่มจาก isVisible() ทำให้บริษัทที่เคย save layout ไว้ก่อนกล่องนี้
              ถูกเพิ่มเข้าระบบ (key ไม่มีอยู่ใน object ที่ save ไว้) จะไม่เห็นเลย ทั้งที่ isVisible() ควรพอแล้ว
              (เช็ค layout[key]?.visible !== false — undefined ก็ถือว่า visible อยู่แล้ว) ตัดเงื่อนไขซ้อนออก */}
          {isVisible("grandTotalText") && showPriceCols && (
            <View
              style={[
                absoluteStyle(layout.grandTotalText || DEFAULT_LETTER_LAYOUTS.shared.grandTotalText),
                styles.letterAbsolute,
                getA4BoxFillStyle(layout.grandTotalText, a4FillOpts),
                { justifyContent: "center", alignItems: "center" },
              ]}
            >
              <GrandTotalTextRow value={finance.grand_total} center />
            </View>
          )}

          {isVisible("signatureLeft") && (
            <View
              style={[
                absoluteStyle(layout.signatureLeft),
                styles.letterAbsolute,
                getA4BoxFillStyle(layout.signatureLeft, a4FillOpts),
              ]}
            >
              {/* 🛡️ กล่องลายเซ็นกลุ่มเดียวที่ปิดเส้นขอบ+มุมโค้ง hardcode เดิมได้ ผ่านสวิทช์ "แสดงสีพื้นหลังกล่องนี้"
                  เดิม (paperSize อื่นๆ/กล่องอื่นๆ ทั้งหมดยังคงมีเส้นขอบเสมอ ไม่เกี่ยวกับสวิทช์นี้) */}
              {/* 🛡️ เดิมเส้นเซ็นอยู่ติดขอบบนกล่องทันที (แค่ padding 10pt) แทบไม่มีที่ว่างให้เซ็นจริงด้านบนเส้น —
                  เติมกล่องว่าง flexGrow:1 ก่อนเสมอ ดันเนื้อหาที่เหลือลงไปชิดขอบล่างแทน (ใช้ flexGrow แทนความสูง
                  คงที่ กันไม่ให้ล้นกล่องไม่ว่ากลุ่มเอกสารไหนจะตั้งความสูงกล่องไว้เท่าไหร่ก็ตาม) */}
              <View style={[styles.sigBoxFull, (layout.signatureLeft as { showFill?: boolean } | undefined)?.showFill === false ? { borderWidth: 0, borderRadius: 0 } : {}]}>
                <View style={{ flexGrow: 1 }} />
                <View style={styles.sigLine}></View>
                <Text>{signatureLabels.left}</Text>
                <Text>วันที่: _____/_____/_____</Text>
              </View>
            </View>
          )}

          {isVisible("signatureRight") && (
            <View
              style={[
                absoluteStyle(layout.signatureRight),
                styles.letterAbsolute,
                getA4BoxFillStyle(layout.signatureRight, a4FillOpts),
              ]}
            >
              <View style={[styles.sigBoxFull, (layout.signatureRight as { showFill?: boolean } | undefined)?.showFill === false ? { borderWidth: 0, borderRadius: 0 } : {}]}>
                <View style={{ flexGrow: 1 }} />
                <View style={styles.sigLine}></View>
                <Text>{signatureLabels.right}</Text>
                {customSignerName && (
                  <Text style={{ fontSize: 10 }}>{customSignerName}</Text>
                )}
                <Text>วันที่: _____/_____/_____</Text>
              </View>
            </View>
          )}

          {/* --- ข้อความแจ้งลงชื่ออนุมัติสั่งซื้อ — เฉพาะ A4 (ของเดิม, Letter/Half Letter ไม่เคยมีข้อความนี้) ---
              🛡️ เดิม hardcode ตำแหน่งลอยอิสระ (คำนวณ y จาก grandTotalText/signature เอง) ลากปรับเองไม่ได้ ตอนนี้
              ย้ายมาเป็นกล่อง "quotationValidityNote" ปรับตำแหน่ง/ขนาดได้จากหน้าตั้งค่าเหมือนส่วนอื่นแล้ว
              (มีเฉพาะกลุ่ม quotation/custom_quotation ใน a4LayoutDefaults.ts เท่านั้น) */}
          {paperSize === "A4" &&
            ["quotation", "custom_quotation"].includes(formData?.document_type) &&
            layout.quotationValidityNote &&
            isVisible("quotationValidityNote") && (
              <View
                style={[
                  absoluteStyle(layout.quotationValidityNote),
                  getA4BoxFillStyle(layout.quotationValidityNote, a4FillOpts),
                  { justifyContent: "center" },
                ]}
              >
                <Text style={{ fontSize: 12, textAlign: "center" }}>
                  กรณีต้องการซื้อสินค้าหรือใช้บริการดังกล่าวข้างต้น
                  กรุณาลงชื่ออนุมัติสั่งซื้อ พร้อมตราประทับบริษัท
                </Text>
              </View>
            )}

          {/* 🧾 ใบแจ้งหนี้ — ข้อความท้ายบิลคงที่ 2 บรรทัด (เช็คขีดคร่อม + ดอกเบี้ยล่าช้า) — เฉพาะ A4 (ของเดิม) */}
          {paperSize === "A4" && formData?.document_type === "invoice" && (
            <View
              style={absoluteStyle({
                x: 30,
                y: A4_PAGE_HEIGHT - 55,
                width: A4_PAGE_WIDTH - 60,
                height: 40,
              })}
            >
              <Text style={{ fontSize: 9 }}>
                1. โปรดสั่งจ่ายเช็คขีดคร่อมในนาม &quot;{displayCompanyName}
                &quot; และขีดฆ่าผู้ถือ
              </Text>
              <Text style={{ fontSize: 9 }}>
                2. บริษัทฯ จะคิดดอกเบี้ยในอัตรา 2%
                ต่อเดือนนับจากวันที่ครบกำหนดชำระ
              </Text>
            </View>
          )}
        </Page>
      </Document>
    );
}
