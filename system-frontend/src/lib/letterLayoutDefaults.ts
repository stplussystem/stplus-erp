// ค่ากลางของ layout เอกสารขนาด Letter (แบบพิมพ์ทับกระดาษหัวจดหมาย) — ใช้ร่วมกันระหว่าง
// หน้าตั้งค่า (company/letter-layout) กับตัว renderer จริง (SalesPdfTemplate) เพื่อไม่ให้ค่า default เพี้ยนกัน
// หน่วยเป็น pt (point) ตรงกับหน่วยพิกัดที่ @react-pdf/renderer ใช้เวลาวาง position: 'absolute' อยู่แล้ว
// จึงไม่ต้องแปลงหน่วยระหว่างตอนแก้ไข (บนจอ, สเกลลง) กับตอนพิมพ์จริง (เต็มขนาด)
//
// 🖨️ ปรับใหญ่: เดิมไฟล์นี้มี config เดียวใช้ร่วมกันทุกประเภทเอกสาร ตอนนี้แยกเป็นหลายกลุ่มเหมือน printLayoutDefaults.ts
// กลุ่ม "shared" (quotation/billing_invoice/cash/credit_note/debit_note ฯลฯ) คงกล่องเดิมทั้งหมดไว้ไม่แตะ
// เพิ่มกลุ่มใหม่ "delivery_note" (ใบส่งสินค้าชั่วคราว — ย้ายมาจาก print-layouts เดิม) ที่มีกล่องละเอียดกว่ามาก
// รวมถึงกล่อง "ข้อมูลบริษัท" แยกอิสระ (ชื่อ/ที่อยู่/เลขผู้เสียภาษี) ซึ่งเป็นความสามารถใหม่ที่ไม่เคยมีในระบบ

// visible: undefined ถือว่า true เสมอ (backward-compat กับ config เก่าที่บันทึกไว้ก่อนมี field นี้)
export type LetterLayoutBox = { x: number; y: number; width: number; height: number; visible?: boolean };
export type LetterLayoutConfig = Record<string, LetterLayoutBox>;

// 🖨️ "Letter" ในระบบนี้ไม่ใช่ Letter มาตรฐาน 8.5x11 นิ้ว — เป็น "กระดาษต่อเนื่อง 9x11" (continuous/fanfold stationery)
// ที่ขายจริงในไทย ตัวเอกสารกว้าง 8 นิ้ว สูง 11 นิ้ว (576x792pt) ส่วนความกว้างรวม 9 นิ้วบนม้วนกระดาษคือรวมแถบรูเจาะ
// สายพานลำเลียง (sprocket hole strip) ที่ยื่นออกนอกขอบเอกสารข้างละ 0.5 นิ้วด้วย (ดู HOLE_STRIP_WIDTH ด้านล่าง)
// ยืนยันขนาดจากภาพเอกสารตัวอย่างจริงที่ผู้ใช้แนบมา (มีเส้น/ตัวเลขกำกับ 8"/9"/11" ชัดเจน)
export const LETTER_PAGE_WIDTH = 576;
export const LETTER_PAGE_HEIGHT = 792;

// A4 = 210 x 297 มม. ที่ 72 pt/นิ้ว (ค่ามาตรฐานของ react-pdf เมื่อ size="A4")
// 🖨️ ตั้งแต่ตรงนี้ไป ไฟล์นี้ไม่ได้ผูกกับ "Letter" อย่างเดียวแล้ว — เก็บ default 2 ชุดต่อกลุ่ม (A4 กับ Letter)
// ให้ทุกประเภทเอกสารจัดวางแบบลาก x/y ได้อิสระทั้ง 2 ขนาดกระดาษ (ไม่เปลี่ยนชื่อไฟล์/ตัวแปรเดิมเพื่อลดความเสี่ยง)
export const A4_PAGE_WIDTH = 595;
export const A4_PAGE_HEIGHT = 842;

// Half Letter = เอา Letter (8x11 นิ้ว ด้านบน) มาผ่าครึ่งความสูง (11/2=5.5) จึงกว้าง 8 นิ้วเท่า Letter แต่สูงแค่
// 5.5 นิ้ว (576x396pt) กลายเป็นแนวนอนโดยธรรมชาติ — มีแถบรูเจาะ 0.5 นิ้วต่อข้างเหมือน Letter ทุกประการ
// (ยืนยันขนาดจากภาพเอกสารตัวอย่างจริงเช่นกัน) @react-pdf/renderer ไม่มีชื่อมาตรฐานให้เรียกใช้ (ต่างจาก "A4"/"LETTER")
// ต้องส่งเป็น custom tuple [width, height] แทนตอนใช้จริงใน <Page size>
export const HALF_LETTER_PAGE_WIDTH = 576;
export const HALF_LETTER_PAGE_HEIGHT = 396;

// 🕳️ แถบรูเจาะสายพานลำเลียง (sprocket hole strip) ที่ยื่นออกนอกขอบเอกสารข้างละเท่านี้ (0.5 นิ้ว) ทั้ง Letter/Half
// Letter — ใช้ค่านี้ร่วมกันทั้งฝั่ง preview (letter-layout/print-layouts) ไม่ต้อง hardcode 36 กระจายหลายที่
// เป็นแค่ภาพประกอบฝั่ง editor เท่านั้น ไม่ได้พิมพ์ลง PDF จริง (ตัวเอกสารจริงมีแค่ LETTER_PAGE_WIDTH/HEIGHT ด้านบน)
export const HOLE_STRIP_WIDTH = 36;

// 🖨️ ขนาดกระดาษที่รองรับทั้งระบบ — ใช้ type เดียวนี้แทนการเขียน "A4" | "Letter" กระจายซ้ำหลายไฟล์
export type PaperSize = "A4" | "Letter" | "HalfLetter";

export type LetterLayoutGroup =
  | "shared"
  | "delivery_note"
  | "purchase_order"
  | "goods_receipt"
  | "contractor_work_order"
  | "receipt_voucher"
  | "stock_movement";

export const LETTER_LAYOUT_GROUPS: { key: LetterLayoutGroup; label: string }[] = [
  { key: "shared", label: "เอกสารทั่วไป (ใบเสนอราคา/ใบวางบิล/เงินสด/ใบลดหนี้/ใบเพิ่มหนี้)" },
  { key: "delivery_note", label: "ใบส่งสินค้าชั่วคราว" },
  { key: "purchase_order", label: "ใบสั่งซื้อ" },
  { key: "goods_receipt", label: "ใบรับสินค้า" },
  { key: "contractor_work_order", label: "ใบสั่งซื้อ/ใบสั่งจ้าง (ผู้รับเหมา)" },
  { key: "receipt_voucher", label: "ใบสำคัญรับเงิน" },
  { key: "stock_movement", label: "เอกสารเคลื่อนไหวสต๊อก (ใบเบิก/คืนสินค้า)" },
];

// 🧩 คีย์ไหนเป็น "คอลัมน์ตาราง" ต้องใช้ y/height ร่วมกันเสมอ (เหมือน printLayoutDefaults.ts) — เฉพาะกลุ่ม delivery_note
// (กลุ่มอื่นไม่มีคอลัมน์แยกกล่องแบบนี้ ปล่อยว่างไว้)
export const COLUMN_GROUPS: Record<LetterLayoutGroup, string[][]> = {
  shared: [],
  delivery_note: [["colNo", "colCode", "colDesc", "colQty", "colUnitPrice", "colAmount"]],
  purchase_order: [],
  goods_receipt: [],
  contractor_work_order: [],
  receipt_voucher: [],
  stock_movement: [],
};

export const LETTER_LAYOUT_SECTIONS: Record<LetterLayoutGroup, { key: string; label: string }[]> = {
  shared: [
    // 🖨️ companyInfo: ซ่อนไว้ default บน Letter (สมมติพิมพ์ทับกระดาษหัวจดหมายอยู่แล้ว) แต่โชว์ default บน A4
    // (ไม่มีกระดาษหัวจดหมายจริง ต้องพิมพ์ข้อมูลบริษัทเอง) ผู้ใช้เปิด/ปิดเองได้ทั้ง 2 ขนาดกระดาษจากหน้า editor
    { key: "companyInfo", label: "ข้อมูลบริษัท (โลโก้/ชื่อ/ที่อยู่)" },
    { key: "title", label: "ชื่อเอกสาร" },
    // 🎨 แถบสี (tab) คั่นระหว่างส่วนหัวบริษัท/ชื่อเอกสาร กับ ข้อมูลลูกค้า/เลขที่เอกสาร — เฉพาะกระดาษ A4 เท่านั้น
    // สีปรับได้แยกต่อกลุ่มเอกสาร (ดู DEFAULT_A4_ACCENT_COLORS/getA4AccentColor) กล่องนี้ลากตำแหน่ง/ปิดได้เหมือนกล่องอื่น
    { key: "headerDivider", label: "แถบสีคั่นหัวเอกสาร (เฉพาะ A4)" },
    { key: "customerInfo", label: "ข้อมูลลูกค้า" },
    { key: "metaInfo", label: "เลขที่ / วันที่เอกสาร" },
    { key: "itemsTable", label: "ตารางรายการสินค้า" },
    { key: "notes", label: "หมายเหตุ" },
    { key: "summary", label: "สรุปยอดเงิน" },
    { key: "grandTotalText", label: "จำนวนเงินเป็นตัวอักษร" },
    { key: "signatureLeft", label: "ลายเซ็นผู้รับสินค้า" },
    { key: "signatureRight", label: "ลายเซ็นผู้มีอำนาจลงนาม" },
  ],
  // 🧩 ย่อจาก 30 กล่องย่อยเหลือ 17 — รวมข้อมูลบริษัท/ลูกค้า/เอกสาร/สรุปยอด ที่เดิมแยกเป็นกล่องจิ๋วทีละบรรทัดให้เป็น
  // กล่องใหญ่กล่องเดียวต่อกลุ่ม (เนื้อหาเรียงเป็น column flow ธรรมดา ไม่ absolute-position รายบรรทัด) ตาม pattern
  // เดียวกับกลุ่ม "shared" — คอลัมน์ตารางสินค้า (colNo-colAmount) คงแยกเหมือนเดิมเพราะ COLUMN_GROUPS sync
  // y/height ให้กันอยู่แล้ว ทำให้ปรับความกว้างแต่ละคอลัมน์แยกได้ (ความสามารถที่ผู้ใช้ยังต้องการ) ส่วน
  // title/headerDivider/conditionsText/ลายเซ็น 3 แบบ/companyStamp คงแยกเป็นกล่องเดี่ยวเหมือนเดิม (ความหมายต่างกัน)
  delivery_note: [
    { key: "companyInfo", label: "ข้อมูลบริษัท (ชื่อ/ที่อยู่/เลขผู้เสียภาษี)" },
    { key: "title", label: "ชื่อเอกสาร" },
    { key: "headerDivider", label: "แถบสีคั่นหัวเอกสาร (เฉพาะ A4)" },
    { key: "customerInfo", label: "ข้อมูลลูกค้า (ชื่อ/ที่อยู่/เลขผู้เสียภาษี)" },
    { key: "metaInfo", label: "ข้อมูลเอกสาร (เลขที่/วันที่/เลขที่ PO/พนักงานขาย/เงื่อนไข)" },
    { key: "colNo", label: "ตารางสินค้า: ลำดับ" },
    { key: "colCode", label: "ตารางสินค้า: รหัสสินค้า" },
    { key: "colDesc", label: "ตารางสินค้า: รายละเอียด" },
    { key: "colQty", label: "ตารางสินค้า: จำนวน/หน่วย" },
    { key: "colUnitPrice", label: "ตารางสินค้า: ราคา/หน่วย" },
    { key: "colAmount", label: "ตารางสินค้า: จำนวนเงิน" },
    { key: "conditionsText", label: "เงื่อนไขท้ายเอกสาร (มีกรอบ)" },
    { key: "summary", label: "สรุปยอดเงิน (รวม/ส่วนลด/ภาษี/ยอดสุทธิ/ตัวอักษร)" },
    { key: "signatureReceiver", label: "ลายเซ็นผู้รับของ" },
    { key: "signatureDelivered", label: "ลายเซ็นผู้ส่งของ" },
    { key: "signatureChecked", label: "ลายเซ็นผู้ตรวจสอบ" },
    { key: "companyStamp", label: "ตรา/ลายเซ็นบริษัทผู้ขาย" },
  ],
  purchase_order: [
    { key: "companyInfo", label: "ข้อมูลบริษัท (โลโก้/ชื่อ/ที่อยู่)" },
    { key: "title", label: "ชื่อเอกสาร" },
    { key: "headerDivider", label: "แถบสีคั่นหัวเอกสาร (เฉพาะ A4)" },
    { key: "vendorInfo", label: "ข้อมูลผู้จำหน่าย" },
    { key: "metaInfo", label: "เลขที่/วันที่/อ้างอิง/เงื่อนไขชำระเงิน" },
    { key: "itemsTable", label: "ตารางรายการสินค้า" },
    { key: "notes", label: "หมายเหตุ" },
    { key: "grandTotalText", label: "จำนวนเงินเป็นตัวอักษร" },
    { key: "summary", label: "สรุปยอดเงิน" },
    { key: "footerCondition", label: "เงื่อนไขท้ายเอกสาร" },
    { key: "signatureLeft", label: "ลายเซ็นผู้จัดทำ/ผู้สั่งซื้อ" },
    { key: "signatureRight", label: "ลายเซ็นผู้อนุมัติ" },
  ],
  goods_receipt: [
    { key: "companyInfo", label: "ข้อมูลบริษัท (โลโก้/ชื่อ/ที่อยู่)" },
    { key: "title", label: "ชื่อเอกสาร" },
    { key: "headerDivider", label: "แถบสีคั่นหัวเอกสาร (เฉพาะ A4)" },
    { key: "supplierInfo", label: "ข้อมูลผู้จำหน่าย/เอกสารอ้างอิง" },
    { key: "metaInfo", label: "เลขที่ใบรับของ/วันที่รับเข้า/อ้างอิง PO" },
    { key: "itemsTable", label: "ตารางรายการรับสินค้า" },
    { key: "notes", label: "หมายเหตุการรับสินค้า" },
    { key: "signatureLeft", label: "ลายเซ็นผู้ตรวจรับสินค้า" },
    { key: "signatureRight", label: "ลายเซ็นผู้ส่งมอบสินค้า" },
  ],
  contractor_work_order: [
    { key: "companyInfo", label: "ข้อมูลบริษัท (โลโก้/ชื่อ/ที่อยู่)" },
    { key: "title", label: "ชื่อเอกสาร" },
    { key: "headerDivider", label: "แถบสีคั่นหัวเอกสาร (เฉพาะ A4)" },
    { key: "contractorInfo", label: "ข้อมูลผู้รับเหมา/ช่าง" },
    { key: "metaInfo", label: "เลขที่/วันที่" },
    { key: "itemsTable", label: "ตารางรายการงาน" },
    { key: "notes", label: "หมายเหตุ" },
    { key: "grandTotalText", label: "จำนวนเงินเป็นตัวอักษร" },
    { key: "summary", label: "สรุปยอดเงิน (รวม หัก ณ ที่จ่าย)" },
    { key: "conditionsText", label: "เงื่อนไขท้ายเอกสาร" },
    { key: "signatureLeft", label: "ลายเซ็นผู้สั่งซื้อ/ผู้สั่งจ้าง" },
    { key: "signatureRight", label: "ลายเซ็นผู้อนุมัติ" },
  ],
  receipt_voucher: [
    { key: "companyInfo", label: "ข้อมูลบริษัท (โลโก้/ชื่อ/ที่อยู่)" },
    { key: "title", label: "ชื่อเอกสาร" },
    { key: "headerDivider", label: "แถบสีคั่นหัวเอกสาร (เฉพาะ A4)" },
    { key: "metaInfo", label: "เลขที่/วันที่" },
    { key: "bodyText", label: "ข้อความบรรยาย" },
    { key: "itemsTable", label: "ตารางรายการเงิน" },
    { key: "grandTotalText", label: "จำนวนเงินเป็นตัวอักษร" },
    { key: "signatureLeft", label: "ลายเซ็นผู้รับเงิน" },
    { key: "signatureRight", label: "ลายเซ็นผู้จ่ายเงิน" },
  ],
  // 🚚 ใบเบิกสินค้า/ใบคืนสินค้า/ใบคืนสินค้าเช่า — เอกสารเคลื่อนไหวสต๊อกล้วนๆ ไม่มีราคา/VAT เลย
  // (ตรวจฟอร์มจริงยืนยันแล้วว่า tax_type="none", grand_total=0 เสมอ) โครงสร้างใกล้เคียง goods_receipt มากที่สุด
  stock_movement: [
    { key: "companyInfo", label: "ข้อมูลบริษัท (โลโก้/ชื่อ/ที่อยู่)" },
    { key: "title", label: "ชื่อเอกสาร" },
    { key: "headerDivider", label: "แถบสีคั่นหัวเอกสาร (เฉพาะ A4)" },
    { key: "contactInfo", label: "ข้อมูลลูกค้า/ผู้เกี่ยวข้อง" },
    { key: "metaInfo", label: "เลขที่เอกสาร/วันที่" },
    { key: "itemsTable", label: "ตารางรายการสินค้า (ไม่มีราคา)" },
    { key: "notes", label: "หมายเหตุ" },
    { key: "signatureLeft", label: "ลายเซ็นผู้เบิก/ผู้คืนสินค้า" },
    { key: "signatureRight", label: "ลายเซ็นผู้อนุมัติ" },
  ],
};

// 🖨️ ค่าพิกัดดิบด้านล่าง ("RAW") ถูกออกแบบไว้ตอน Letter กว้าง 612pt (8.5") เดิม — ปรับไปมาหลายรอบจนตำแหน่ง
// สัมพัทธ์ระหว่างกล่องในแต่ละกลุ่มลงตัวดีแล้ว แทนที่จะพิมพ์พิกัดใหม่ทั้งหมดเอง (เสี่ยงพิมพ์ผิด/เสียเวลา) เก็บ RAW
// ไว้ในพิกัด 612 เท่าเดิม แล้วแปลงเป็นค่าจริงผ่าน 2 ฟังก์ชันด้านล่างตอนประกาศ DEFAULT_LETTER_LAYOUTS:
//   1) rescaleLetterWidthRaw — ย่อ x/width ตามสัดส่วนความกว้างใหม่จริง (LETTER_PAGE_WIDTH=576) ให้พอดีหน้ากระดาษ
//   2) pushFooterToBottom — ดันกลุ่มกล่องท้ายเอกสาร (ต่ำกว่า itemsTable) ลงไปชิดขอบล่างจริงเป็นก้อนเดียว (ไม่ยืด/หด)
const RAW_LETTER_PAGE_WIDTH = 612;
const RAW_LETTER_LAYOUTS: Record<LetterLayoutGroup, LetterLayoutConfig> = {
  shared: {
    companyInfo: { x: 30, y: 30, width: 300, height: 70, visible: false },
    title: { x: 350, y: 30, width: 232, height: 46, visible: true },
    // 🎨 แถบสีคั่นหัวเอกสาร (เฉพาะ A4 — ดู headerDivider ใน SalesPdfTemplate.tsx) วางระหว่าง header cluster (จบ y~100)
    // กับ customerInfo/metaInfo (เริ่ม y=110)
    headerDivider: { x: 0, y: 104, width: RAW_LETTER_PAGE_WIDTH, height: 4, visible: true },
    customerInfo: { x: 30, y: 110, width: 330, height: 96, visible: true },
    metaInfo: { x: 380, y: 110, width: 202, height: 96, visible: true },
    itemsTable: { x: 30, y: 226, width: 552, height: 280, visible: true },
    notes: { x: 30, y: 530, width: 330, height: 92, visible: true },
    // 📐 summary สูงขึ้น 76→132 (แก้ปัญหาส่วนลด/ยอดหลังหักส่วนลด/VAT/ยอดรวมล้นซ้อนทับกล่องด้านล่างเมื่อมีครบทุกแถว — item 8a
    // บวกแถวใหม่ "ยอดหลังหักส่วนลด" ที่เพิ่มเข้ามาทีหลัง)
    summary: { x: 380, y: 530, width: 202, height: 132, visible: true },
    // grandTotalText ขยับลงตามความสูง summary ใหม่ (530+132+4 gap = 666)
    // 🛡️ height เดิม 12pt แคบเกินไปสำหรับฟอนต์ 12px ตัวหนา — react-pdf จะตัดข้อความทิ้งทั้งบรรทัดถ้าสูงกว่ากล่อง
    // (พิสูจน์แล้วด้วยการดีบัก: ใส่ข้อความ hardcode ธรรมดาลงกล่องสูง 12pt ก็ไม่ขึ้นเหมือนกัน ไม่ใช่ปัญหาที่ bahtText())
    // เพิ่มเป็น 16pt ให้พอดีบรรทัดเดียว
    grandTotalText: { x: 380, y: 666, width: 202, height: 16, visible: true },
    // 🛡️ signature เว้นที่ไว้ 720-678=42pt เหนือมัน (666+12=678 ถึง 720) ให้พอดีกับข้อความแจ้งอนุมัติซื้อ (เฉพาะ
    // ใบเสนอราคา A4 — ดู SalesPdfTemplate.tsx) ที่วางไว้ระหว่าง grandTotalText กับ signature เสมอ ไม่งั้นจะทับกัน
    // (เดิมเว้นแค่ 8pt ไม่พอสำหรับข้อความสูง 30pt เลย)
    signatureLeft: { x: 60, y: 720, width: 180, height: 60, visible: true },
    signatureRight: { x: 380, y: 720, width: 180, height: 60, visible: true },
  },
  // 🧩 พิกัดใหม่หลังย่อ 30→17 กล่อง — ออกแบบให้แต่ละกล่องรวมมีความสูงเผื่อไว้เกินพอ (ไม่ใช่แค่พอดีตัวเลขบวกกันตรงๆ)
  // ป้องกันบั๊กคลาสเดียวกับที่เจอใน PO/Contractor (กล่องเตี้ยเกินจริงจนแถวข้อมูลซ้อนทับกัน) — เว้น gap ≥4pt ระหว่าง
  // กล่องเสมอ ไม่พึ่ง pushFooterToBottom อย่างเดียว (แต่ก็ยังทำงานเสริมให้ชิดขอบล่างมากขึ้นถ้ามีที่ว่างเหลือ)
  delivery_note: {
    companyInfo: { x: 30, y: 20, width: 400, height: 76, visible: true },
    title: { x: 30, y: 100, width: 552, height: 26, visible: true },
    headerDivider: { x: 0, y: 130, width: RAW_LETTER_PAGE_WIDTH, height: 4, visible: true },
    customerInfo: { x: 30, y: 138, width: 330, height: 88, visible: true },
    metaInfo: { x: 370, y: 138, width: 212, height: 100, visible: true },
    colNo: { x: 30, y: 242, width: 33, height: 200, visible: true },
    colCode: { x: 63, y: 242, width: 77, height: 200, visible: true },
    colDesc: { x: 140, y: 242, width: 215, height: 200, visible: true },
    colQty: { x: 355, y: 242, width: 77, height: 200, visible: true },
    colUnitPrice: { x: 432, y: 242, width: 71, height: 200, visible: true },
    colAmount: { x: 503, y: 242, width: 79, height: 200, visible: true },
    conditionsText: { x: 30, y: 446, width: 552, height: 40, visible: true },
    summary: { x: 370, y: 490, width: 212, height: 130, visible: true },
    signatureReceiver: { x: 30, y: 624, width: 170, height: 50, visible: true },
    signatureDelivered: { x: 215, y: 624, width: 170, height: 50, visible: true },
    signatureChecked: { x: 400, y: 624, width: 170, height: 50, visible: true },
    companyStamp: { x: 400, y: 678, width: 182, height: 50, visible: true },
  },
  purchase_order: {
    companyInfo: { x: 30, y: 30, width: 360, height: 70, visible: true },
    title: { x: 410, y: 30, width: 172, height: 50, visible: true },
    headerDivider: { x: 0, y: 104, width: RAW_LETTER_PAGE_WIDTH, height: 4, visible: true },
    vendorInfo: { x: 30, y: 112, width: 330, height: 96, visible: true },
    metaInfo: { x: 380, y: 112, width: 202, height: 96, visible: true },
    itemsTable: { x: 30, y: 226, width: 552, height: 280, visible: true },
    notes: { x: 30, y: 510, width: 330, height: 70, visible: true },
    // 🛡️ height 90pt เดิมเตี้ยเกินจริง (เนื้อหาต้องการ 93-115pt) ทำให้แถวสรุปยอดซ้อนทับกัน — เพิ่มเป็น 140pt
    // (ตามหลักการเดียวกับกลุ่ม shared ที่เจอบั๊กเดียวกันมาก่อนแล้วแก้ 76→132) พร้อมขยับกล่องด้านล่างทั้งหมดตาม
    summary: { x: 380, y: 510, width: 202, height: 140, visible: true },
    // grandTotalText/footerCondition/signature ขยับลงตามความสูง summary ใหม่ (510+140+4 gap = 654)
    grandTotalText: { x: 30, y: 654, width: 330, height: 16, visible: true },
    footerCondition: { x: 30, y: 674, width: 552, height: 40, visible: true },
    signatureLeft: { x: 60, y: 720, width: 180, height: 60, visible: true },
    signatureRight: { x: 380, y: 720, width: 180, height: 60, visible: true },
  },
  goods_receipt: {
    companyInfo: { x: 30, y: 30, width: 360, height: 70, visible: true },
    title: { x: 410, y: 30, width: 172, height: 50, visible: true },
    headerDivider: { x: 0, y: 104, width: RAW_LETTER_PAGE_WIDTH, height: 4, visible: true },
    supplierInfo: { x: 30, y: 112, width: 330, height: 80, visible: true },
    metaInfo: { x: 380, y: 112, width: 202, height: 80, visible: true },
    itemsTable: { x: 30, y: 210, width: 552, height: 400, visible: true },
    notes: { x: 30, y: 622, width: 552, height: 60, visible: true },
    signatureLeft: { x: 80, y: 700, width: 180, height: 70, visible: true },
    signatureRight: { x: 350, y: 700, width: 180, height: 70, visible: true },
  },
  contractor_work_order: {
    companyInfo: { x: 30, y: 30, width: 360, height: 70, visible: true },
    title: { x: 410, y: 30, width: 172, height: 50, visible: true },
    headerDivider: { x: 0, y: 104, width: RAW_LETTER_PAGE_WIDTH, height: 4, visible: true },
    contractorInfo: { x: 30, y: 112, width: 330, height: 100, visible: true },
    metaInfo: { x: 380, y: 112, width: 202, height: 100, visible: true },
    itemsTable: { x: 30, y: 230, width: 552, height: 270, visible: true },
    notes: { x: 30, y: 510, width: 330, height: 70, visible: true },
    // 🛡️ height 104pt เดิมเตี้ยเกินจริง (มีแถวหัก ณ ที่จ่ายเสมอ ต้องการ ~115pt ทุกครั้ง) ทำให้แถวสรุปยอดซ้อนทับกัน
    // — เพิ่มเป็น 140pt พร้อมขยับกล่องด้านล่างทั้งหมดตาม (เหมือนที่ทำกับ purchase_order/shared)
    summary: { x: 380, y: 510, width: 202, height: 140, visible: true },
    // grandTotalText/conditionsText/signature ขยับลงตามความสูง summary ใหม่ (510+140+4 gap = 654)
    grandTotalText: { x: 30, y: 654, width: 330, height: 16, visible: true },
    conditionsText: { x: 30, y: 674, width: 552, height: 46, visible: true },
    signatureLeft: { x: 60, y: 726, width: 180, height: 60, visible: true },
    signatureRight: { x: 380, y: 726, width: 180, height: 60, visible: true },
  },
  receipt_voucher: {
    companyInfo: { x: 30, y: 30, width: 360, height: 70, visible: true },
    title: { x: 410, y: 30, width: 172, height: 50, visible: true },
    headerDivider: { x: 0, y: 104, width: RAW_LETTER_PAGE_WIDTH, height: 4, visible: true },
    metaInfo: { x: 380, y: 112, width: 202, height: 50, visible: true },
    bodyText: { x: 30, y: 172, width: 552, height: 50, visible: true },
    itemsTable: { x: 30, y: 232, width: 552, height: 110, visible: true },
    grandTotalText: { x: 30, y: 352, width: 552, height: 16, visible: true },
    signatureLeft: { x: 100, y: 450, width: 180, height: 60, visible: true },
    signatureRight: { x: 350, y: 450, width: 180, height: 60, visible: true },
  },
  stock_movement: {
    companyInfo: { x: 30, y: 30, width: 360, height: 70, visible: true },
    title: { x: 410, y: 30, width: 172, height: 50, visible: true },
    headerDivider: { x: 0, y: 104, width: RAW_LETTER_PAGE_WIDTH, height: 4, visible: true },
    contactInfo: { x: 30, y: 112, width: 330, height: 80, visible: true },
    metaInfo: { x: 380, y: 112, width: 202, height: 80, visible: true },
    itemsTable: { x: 30, y: 210, width: 552, height: 400, visible: true },
    notes: { x: 30, y: 622, width: 552, height: 60, visible: true },
    signatureLeft: { x: 80, y: 700, width: 180, height: 70, visible: true },
    signatureRight: { x: 350, y: 700, width: 180, height: 70, visible: true },
  },
};

// 🖨️ ย่อ x/width ของทุกกล่องตามสัดส่วนความกว้างหน้ากระดาษจริง (RAW 612pt → LETTER_PAGE_WIDTH ปัจจุบัน) ไม่แตะ y/height
function rescaleLetterWidthRaw(config: LetterLayoutConfig): LetterLayoutConfig {
  const sx = LETTER_PAGE_WIDTH / RAW_LETTER_PAGE_WIDTH;
  return Object.fromEntries(
    Object.entries(config).map(([key, box]) => [key, { ...box, x: box.x * sx, width: box.width * sx }]),
  );
}

// 🧩 ดัน "กลุ่มกล่องท้ายเอกสาร" (ทุกกล่องที่ y มากกว่า itemsTable.y เช่น notes/summary/signature) ให้ชิดขอบล่างจริง
// มากขึ้น (บาง group เดิมมีช่องว่างเหลือ 70pt+ ก่อนถึงขอบล่างจริง) โดยขยับทั้งกลุ่มลงมาเป็นก้อนเดียว (ไม่ยืด/หด
// แค่เลื่อนตำแหน่ง) กันไม่ให้เกิดกล่องซ้อนทับกันใหม่จากการปรับนี้ — ใช้สร้าง DEFAULT_LETTER_LAYOUTS เท่านั้น
// (ไม่กระทบเอกสารที่บริษัทเคย customize ไว้แล้ว เพราะอ่านจาก document_settings ก่อนเสมอถ้ามีค่าบันทึกไว้)
function pushFooterToBottom(config: LetterLayoutConfig, pageHeight: number, marginBottom: number = 30): LetterLayoutConfig {
  const anchor = config.itemsTable;
  if (!anchor) return config;
  const footerKeys = Object.keys(config).filter((k) => k !== "itemsTable" && config[k].y > anchor.y);
  if (footerKeys.length === 0) return config;
  const currentMaxBottom = Math.max(...footerKeys.map((k) => config[k].y + config[k].height));
  const delta = pageHeight - marginBottom - currentMaxBottom;
  if (delta <= 0) return config;
  const result = { ...config };
  for (const k of footerKeys) result[k] = { ...result[k], y: result[k].y + delta };
  return result;
}

function buildDefaultLetterLayout(group: LetterLayoutGroup): LetterLayoutConfig {
  return pushFooterToBottom(rescaleLetterWidthRaw(RAW_LETTER_LAYOUTS[group]), LETTER_PAGE_HEIGHT);
}

export const DEFAULT_LETTER_LAYOUTS: Record<LetterLayoutGroup, LetterLayoutConfig> = {
  shared: buildDefaultLetterLayout("shared"),
  delivery_note: buildDefaultLetterLayout("delivery_note"),
  purchase_order: buildDefaultLetterLayout("purchase_order"),
  goods_receipt: buildDefaultLetterLayout("goods_receipt"),
  contractor_work_order: buildDefaultLetterLayout("contractor_work_order"),
  receipt_voucher: buildDefaultLetterLayout("receipt_voucher"),
  stock_movement: buildDefaultLetterLayout("stock_movement"),
};

// 🎨 ตารางรายการสินค้า (itemsTable) ยืดความสูงเต็มพื้นที่ที่เหลือจริงเสมอ (ทุกเอกสาร แม้มีแค่ 1 รายการ) ดันหมายเหตุ/
// สรุปยอด/ลายเซ็นด้านล่างให้ดูติดกับตารางพอดี แทนที่จะใช้ box.height ที่ config ไว้ตรงๆ (เป็นแค่ "ความสูงขั้นต่ำ")
// หาค่า y น้อยที่สุดในบรรดากล่องอื่นที่มองเห็นอยู่และอยู่ต่ำกว่า itemsTable แล้วยืดไปจนเกือบถึงจุดนั้น (เว้น gap เล็กน้อย)
// ไม่มีวันหดเล็กกว่า box.height เดิม (กันกรณีผู้ใช้ลากตำแหน่งกล่องอื่นมาทับใกล้ itemsTable เกินไป) มีแต่ยืดเพิ่มเท่านั้น
export function computeStretchedItemsTableHeight(
  layout: LetterLayoutConfig,
  pageHeight: number,
  gap: number = 10,
  marginBottom: number = 20,
): number {
  const itemsTable = layout.itemsTable;
  if (!itemsTable) return 0;
  const belowBoxes = Object.entries(layout).filter(
    ([key, box]) => key !== "itemsTable" && box.visible !== false && box.y > itemsTable.y,
  );
  const minY = belowBoxes.length > 0 ? Math.min(...belowBoxes.map(([, box]) => box.y)) : pageHeight - marginBottom;
  const stretched = minY - itemsTable.y - gap;
  return Math.max(stretched, itemsTable.height);
}

// 🖨️ default ของกระดาษ A4 — ไม่ได้พิมพ์พิกัดเองใหม่ (เสี่ยงพิมพ์ผิด/ไม่ตรงสัดส่วนกับ Letter) แต่คำนวณ scale
// ตามสัดส่วนหน้ากระดาษจาก DEFAULT_LETTER_LAYOUTS ชุดเดียวกันแทน เป็นจุดเริ่มต้นที่มองแล้วใกล้เคียงของเดิมที่สุด
// (ผู้ใช้ลากปรับต่อเองได้ทีหลังผ่านหน้า editor ไม่จำเป็นต้องตรงเป๊ะ)
function scaleLayoutToA4(letterConfig: LetterLayoutConfig): LetterLayoutConfig {
  const sx = A4_PAGE_WIDTH / LETTER_PAGE_WIDTH;
  const sy = A4_PAGE_HEIGHT / LETTER_PAGE_HEIGHT;
  return Object.fromEntries(
    Object.entries(letterConfig).map(([key, box]) => [
      key,
      { x: box.x * sx, y: box.y * sy, width: box.width * sx, height: box.height * sy, visible: box.visible },
    ]),
  );
}

export const DEFAULT_A4_LAYOUTS: Record<LetterLayoutGroup, LetterLayoutConfig> = {
  shared: scaleLayoutToA4(DEFAULT_LETTER_LAYOUTS.shared),
  delivery_note: scaleLayoutToA4(DEFAULT_LETTER_LAYOUTS.delivery_note),
  purchase_order: scaleLayoutToA4(DEFAULT_LETTER_LAYOUTS.purchase_order),
  goods_receipt: scaleLayoutToA4(DEFAULT_LETTER_LAYOUTS.goods_receipt),
  contractor_work_order: scaleLayoutToA4(DEFAULT_LETTER_LAYOUTS.contractor_work_order),
  receipt_voucher: scaleLayoutToA4(DEFAULT_LETTER_LAYOUTS.receipt_voucher),
  stock_movement: scaleLayoutToA4(DEFAULT_LETTER_LAYOUTS.stock_movement),
};
// 🖨️ กลุ่ม "shared" บน A4 ไม่มีกระดาษหัวจดหมายจริงให้พิมพ์ทับ (ต่างจาก Letter) — โชว์ companyInfo default ไว้เลย
DEFAULT_A4_LAYOUTS.shared.companyInfo = { ...DEFAULT_A4_LAYOUTS.shared.companyInfo, visible: true };

// 🖨️ default ของกระดาษ Half Letter — ใช้วิธี scale ตามสัดส่วนจาก Letter เหมือนกับ A4 ทุกประการ (ไม่พิมพ์พิกัดเองใหม่)
function scaleLayoutToHalfLetter(letterConfig: LetterLayoutConfig): LetterLayoutConfig {
  const sx = HALF_LETTER_PAGE_WIDTH / LETTER_PAGE_WIDTH;
  const sy = HALF_LETTER_PAGE_HEIGHT / LETTER_PAGE_HEIGHT;
  return Object.fromEntries(
    Object.entries(letterConfig).map(([key, box]) => [
      key,
      { x: box.x * sx, y: box.y * sy, width: box.width * sx, height: box.height * sy, visible: box.visible },
    ]),
  );
}

export const DEFAULT_HALF_LETTER_LAYOUTS: Record<LetterLayoutGroup, LetterLayoutConfig> = {
  shared: scaleLayoutToHalfLetter(DEFAULT_LETTER_LAYOUTS.shared),
  delivery_note: scaleLayoutToHalfLetter(DEFAULT_LETTER_LAYOUTS.delivery_note),
  purchase_order: scaleLayoutToHalfLetter(DEFAULT_LETTER_LAYOUTS.purchase_order),
  goods_receipt: scaleLayoutToHalfLetter(DEFAULT_LETTER_LAYOUTS.goods_receipt),
  contractor_work_order: scaleLayoutToHalfLetter(DEFAULT_LETTER_LAYOUTS.contractor_work_order),
  receipt_voucher: scaleLayoutToHalfLetter(DEFAULT_LETTER_LAYOUTS.receipt_voucher),
  stock_movement: scaleLayoutToHalfLetter(DEFAULT_LETTER_LAYOUTS.stock_movement),
};
// 🖨️ เหมือน A4 — กลุ่ม "shared" บน Half Letter ก็ไม่มีกระดาษหัวจดหมายจริงให้พิมพ์ทับเช่นกัน โชว์ companyInfo default ไว้เลย
DEFAULT_HALF_LETTER_LAYOUTS.shared.companyInfo = { ...DEFAULT_HALF_LETTER_LAYOUTS.shared.companyInfo, visible: true };

// 🎨 สีแถบ headerDivider เริ่มต้นต่อกลุ่มเอกสาร (เฉพาะกระดาษ A4) — ปรับได้แยกอิสระต่อกลุ่มจากหน้า editor
// อิงสีที่แต่ละเทมเพลตใช้เป็นสีหลักอยู่แล้ว (เช่น goods_receipt ใช้เขียวเดียวกับ docTitleTh เดิมของ GRPdfTemplate)
export const DEFAULT_A4_ACCENT_COLORS: Record<LetterLayoutGroup, string> = {
  shared: "#2563eb",
  delivery_note: "#2563eb",
  purchase_order: "#2563eb",
  goods_receipt: "#10b981",
  contractor_work_order: "#f59e0b",
  receipt_voucher: "#7c3aed",
  stock_movement: "#0891b2",
};

// อ่านสีแถบ headerDivider ของกลุ่มเอกสารหนึ่งๆ จาก companySettings (บันทึกแยกต่อกลุ่มใน
// document_settings.a4_accent_colors.<group>) fallback เป็นสี default ของกลุ่มนั้นถ้ายังไม่เคยตั้งค่า
export function getA4AccentColor(companySettings: any, group: LetterLayoutGroup): string {
  const docSettings = parseDocSettings(companySettings);
  return docSettings?.a4_accent_colors?.[group] || DEFAULT_A4_ACCENT_COLORS[group];
}

// backward-compat: โค้ดเก่า (ถ้ามีจุดอื่น import ชื่อเดิม) ยังใช้ได้ ชี้ไปที่กลุ่ม shared
export const DEFAULT_LETTER_LAYOUT: LetterLayoutConfig = DEFAULT_LETTER_LAYOUTS.shared;
export const LETTER_LAYOUT_SECTIONS_SHARED = LETTER_LAYOUT_SECTIONS.shared;

// 🎨 helper วาง View แบบ absolute ตามกล่อง layout — เดิมมีนิยามซ้ำอยู่แค่ใน SalesPdfTemplate.tsx
// ย้ายมา export ตรงนี้ที่เดียว ให้ทุก PDF template (เก่า+ใหม่) import ใช้ร่วมกัน ไม่ต้อง copy-paste ซ้ำอีก
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

// 🧩 คืนรายชื่อคีย์วันที่ทั้งหมดที่มีอยู่จริง (metaDate หลัก + metaDate_2, metaDate_3, ... ที่ผู้ใช้กดเพิ่ม) — เหมือน printLayoutDefaults.ts
export function getRepeatableDateKeys(layout: LetterLayoutConfig, baseKey: string = "metaDate"): string[] {
  const pattern = new RegExp(`^${baseKey}(_\\d+)?$`);
  return Object.keys(layout)
    .filter((k) => pattern.test(k))
    .sort((a, b) => {
      const numA = a === baseKey ? 0 : parseInt(a.split("_")[1], 10);
      const numB = b === baseKey ? 0 : parseInt(b.split("_")[1], 10);
      return numA - numB;
    });
}

// 🧩 บังคับ y/height ของทุกคอลัมน์ในกลุ่มเดียวกันให้ตรงกันเสมอ (เหมือน printLayoutDefaults.ts)
export function normalizeColumnGroups(layout: LetterLayoutConfig, group: LetterLayoutGroup): LetterLayoutConfig {
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

// อ่าน layout ของกลุ่มหนึ่งๆ จาก companySettings.document_settings ตามกระดาษที่เลือก (A4 / Letter / Half Letter) —
// Letter อ่านจาก key เดิม `letter_layout`(กลุ่ม shared)/`letter_layout_groups.<group>` (กลุ่มอื่น) เหมือนเดิมทุกประการ
// (ไม่ migrate ไม่กระทบบริษัทที่เคยตั้งค่า Letter ไว้แล้วก่อนมี A4/Half Letter)
// A4 เป็น namespace แยก `a4_layout`(shared)/`a4_layout_groups.<group>`(กลุ่มอื่น), Half Letter เป็น namespace ใหม่
// `half_letter_layout`/`half_letter_layout_groups.<group>` — ไม่ปนกันเลยทั้ง 3 ขนาดกระดาษ
export function getDocumentLayoutConfig(
  companySettings: any,
  group: LetterLayoutGroup = "shared",
  paperSize: PaperSize = "Letter",
): { layout: LetterLayoutConfig; backgroundPath: string | null } {
  const docSettings = parseDocSettings(companySettings);
  const namespaceByPaperSize: Record<PaperSize, { layoutKey: string; groupsKey: string; bgKey: string }> = {
    A4: { layoutKey: "a4_layout", groupsKey: "a4_layout_groups", bgKey: "a4_layout_background_paths" },
    Letter: { layoutKey: "letter_layout", groupsKey: "letter_layout_groups", bgKey: "letter_layout_background_paths" },
    HalfLetter: {
      layoutKey: "half_letter_layout",
      groupsKey: "half_letter_layout_groups",
      bgKey: "half_letter_layout_background_paths",
    },
  };
  const { layoutKey, groupsKey, bgKey } = namespaceByPaperSize[paperSize];
  const defaultsByPaperSize: Record<PaperSize, Record<LetterLayoutGroup, LetterLayoutConfig>> = {
    A4: DEFAULT_A4_LAYOUTS,
    Letter: DEFAULT_LETTER_LAYOUTS,
    HalfLetter: DEFAULT_HALF_LETTER_LAYOUTS,
  };
  let storedSections: LetterLayoutConfig | undefined;
  let backgroundPath: string | null = null;
  if (group === "shared") {
    storedSections = docSettings?.[layoutKey];
    // 🛡️ backward-compat: path รูปพื้นหลังของกลุ่ม shared (Letter) เดิมเคยอยู่ที่ key เก่าก่อนมี bgKey แบบแยกตามกระดาษ
    backgroundPath =
      docSettings?.[bgKey]?.shared || (paperSize === "Letter" ? docSettings?.letter_layout_background_path : null) || null;
  } else {
    storedSections = docSettings?.[groupsKey]?.[group];
    backgroundPath = docSettings?.[bgKey]?.[group] || null;
  }
  const defaults = defaultsByPaperSize[paperSize][group];
  const merged = { ...defaults, ...(storedSections || {}) };
  return {
    layout: normalizeColumnGroups(merged, group),
    backgroundPath,
  };
}

// backward-compat: จุดเรียกเดิมที่ยังเรียก getLetterLayoutConfig ตรงๆ (ไม่รู้จัก paperSize) ยังใช้ได้เหมือนเดิม
// เท่ากับ getDocumentLayoutConfig(companySettings, group, "Letter")
export function getLetterLayoutConfig(
  companySettings: any,
  group: LetterLayoutGroup = "shared",
): { layout: LetterLayoutConfig; backgroundPath: string | null } {
  return getDocumentLayoutConfig(companySettings, group, "Letter");
}

// 🗺️ ประเภทเอกสาร (docType ใน document_settings.docs) แต่ละตัวอยู่กลุ่ม layout ไหน — เอกสารหลายประเภทแชร์กลุ่ม
// เดียวกันได้ (เช่น 9 ประเภทใช้กลุ่ม "shared" ร่วมกัน) กลุ่มที่ชื่อไม่ตรงกับ docType (purchase_order ฯลฯ) ก็ยัง
// ใส่ไว้ตรงนี้เผื่ออนาคตเปลี่ยนชื่อกลุ่มไม่ตรงกับ docType อีก ให้แก้จุดเดียวที่นี่พอ
const DOC_TYPE_TO_LAYOUT_GROUP: Record<string, LetterLayoutGroup> = {
  quotation: "shared",
  custom_quotation: "shared",
  billing_invoice: "shared",
  tax_invoice: "shared",
  cash: "shared",
  custom_cash: "shared",
  receipt: "shared",
  credit_note: "shared",
  debit_note: "shared",
  invoice: "shared",
  // 🚚 ย้ายออกจาก "shared" มาเป็นกลุ่มของตัวเอง — ไม่มีราคา/VAT จึงไม่ควรใช้กล่อง summary/grandTotalText ของ shared
  stock_issue: "stock_movement",
  stock_return: "stock_movement",
  rental_stock_return: "stock_movement",
  delivery_note: "delivery_note",
  purchase_order: "purchase_order",
  goods_receipt: "goods_receipt",
  contractor_work_order: "contractor_work_order",
  receipt_voucher: "receipt_voucher",
};

// อ่านค่ารูปแบบกระดาษ (A4/Letter/Half Letter) + layout ที่ถูกต้องตามกระดาษนั้นๆ ของประเภทเอกสารหนึ่งๆ จาก companySettings
// ที่โหลดมาจาก GET /company — ใช้ร่วมกันทุกจุดที่เรียก pdf(<SalesPdfTemplate .../>) เพื่อไม่ต้อง parse
// document_settings ซ้ำเองทุกไฟล์ ค่า default เป็น 'A4' เสมอถ้าไม่เคยตั้งไว้
// 🖨️ ปรับใหญ่: เดิม letterLayout ที่คืนกลับ hardcode กลุ่ม "shared" แบบ Letter เสมอไม่ว่า paperSize จะเป็นอะไร
// ตอนนี้คืน layout ของกลุ่มที่ docType นั้นสังกัดจริง (ผ่าน DOC_TYPE_TO_LAYOUT_GROUP) ตรงกับกระดาษที่เลือกจริง
// เอกสารที่ไม่อยู่ใน map นี้ (เช่น delivery_note เดิมที่เคยต้องเรียก getLetterLayoutConfig แยกเอง) ยังเรียกแยกได้ตามปกติ
export function getPaperSizeConfig(
  companySettings: any,
  docType: string,
): { paperSize: PaperSize; letterLayout: LetterLayoutConfig | undefined } {
  const docSettings = parseDocSettings(companySettings);
  const storedPaperSize = docSettings?.docs?.[docType]?.paperSize;
  const paperSize: PaperSize =
    storedPaperSize === "Letter" || storedPaperSize === "HalfLetter" ? storedPaperSize : "A4";
  const group = DOC_TYPE_TO_LAYOUT_GROUP[docType] || "shared";
  const { layout } = getDocumentLayoutConfig(companySettings, group, paperSize);
  return { paperSize, letterLayout: layout };
}

// อ่านรูปกราฟิกพื้นหลังหัวกระดาษใบเสนอราคา (แสดงฝั่งขวา ใต้ข้อความ "ใบเสนอราคา" — พิมพ์ลง PDF จริง ต่างจากรูปพื้นหลังอ้างอิงของหน้าจัดวาง Letter)
// ตั้งค่าได้ที่หน้า company settings แท็บ "แก้ไขใบเสนอราคา" — ใช้ค่า base64 ที่ backend แนบมาให้เสมอ (Company::quotation_header_background_base64)
// 🛡️ ไม่สร้าง URL ไป fetch เองฝั่ง browser เพราะ <Image> ของ react-pdf จะโดน CORS บล็อก (คนละ origin กับ backend)
export function getQuotationHeaderBackgroundUrl(companySettings: any): string | null {
  return companySettings?.quotation_header_background_base64 || null;
}
