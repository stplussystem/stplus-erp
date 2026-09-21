import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import dayjs from "dayjs";
import { bahtText } from "@/lib/thaiBahtText";
import { RECEIPT_VOUCHER_DEFAULT_TEXT, fillReceiptVoucherText } from "@/lib/receiptVoucherText";
import {
  DEFAULT_LETTER_LAYOUTS,
  DEFAULT_A4_LAYOUTS,
  DEFAULT_HALF_LETTER_LAYOUTS,
  LETTER_PAGE_WIDTH,
  LETTER_PAGE_HEIGHT,
  A4_PAGE_HEIGHT,
  HALF_LETTER_PAGE_WIDTH,
  HALF_LETTER_PAGE_HEIGHT,
  LetterLayoutConfig,
  absoluteStyle,
  computeStretchedItemsTableHeight,
  getA4AccentColor,
} from "@/lib/letterLayoutDefaults";
import {
  getA4BoxFillStyle,
  getA4BoxFillColor,
  type A4FillOptions,
} from "@/lib/a4LayoutDefaults";

Font.register({
  family: "Sarabun",
  fonts: [
    { src: "/fonts/THSarabun.ttf" },
    { src: "/fonts/THSarabun Bold.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    paddingVertical: 30,
    paddingHorizontal: 24,
    fontFamily: "Sarabun",
    fontSize: 12,
    color: "#0f172a",
  },
  // 🖨️ ใช้กับโหมดจัดวางกล่องอิสระ (config-driven) ทั้ง A4/Letter — ไม่มี padding เพราะตำแหน่งกล่องอิงพิกัดเต็มหน้าโดยตรง
  pageBoxMode: { fontFamily: "Sarabun", fontSize: 12, color: "#0f172a" },

  // 🏢 ส่วนหัว — spacing/ขนาดเดียวกับมาตรฐานเอกสาร A4 ใหม่
  headerBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 0,
  },
  logo: { width: 70, height: 70, objectFit: "contain" },
  companyInfo: { marginLeft: 15, width: "60%" },
  compName: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  compText: { fontSize: 12, color: "#334155", marginTop: 2 },
  docTitleBox: { alignItems: "flex-end" },
  docTitleTh: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e40af",
    borderBottom: "3px solid #2563eb",
    paddingBottom: 2,
  },
  docTitleEn: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 3,
  },
  blueLine: {
    width: "100%",
    height: 4,
    backgroundColor: "#2563eb",
    marginVertical: 6,
  },

  // 🧾 เลขที่เอกสาร
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  // 🛡️ ตัด justifyContent:"center" ออก — ทำให้ react-pdf/Yoga คำนวณตำแหน่งแถวข้อมูลผิดจนซ้อนทับกัน
  // 🛡️ เดิม width:"38%" — กล่องนี้อยู่ในโหมดจัดวางอิสระ (absolute) แล้ว กล่องนอก (layout.metaInfo) เป็นความกว้าง
  // จริงที่ตั้งค่าไว้อยู่แล้ว การบีบกล่องในเหลือ 38% ซ้ำอีกชั้นทำให้เนื้อหาแคบกว่าที่ผู้ใช้ลากไว้จริงมาก (บั๊กเดียวกับ
  // POPdfTemplate.tsx/GRPdfTemplate.tsx/ContractorWorkOrderPdfTemplate.tsx/StockMovementPdfTemplate.tsx)
  metaBox: {
    width: "100%",
    height: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  flexRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },
  textBold: { fontWeight: "bold", color: "#0f172a" },
  paragraph: {
    fontSize: 12,
    lineHeight: 1.6,
    color: "#1e293b",
    marginBottom: 10,
  },

  // 💰 ตาราง — ลดพื้นที่รายการและเอาเส้นแบ่งแนวตั้งออก
  table: {
    flexGrow: 1,
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
  },
  tableRowStretch: { flexDirection: "row", flexGrow: 1 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 10,
  },
  tableRow: { flexDirection: "row", minHeight: 60 },
  col1: {
    width: "12%",
    paddingHorizontal: 4,
    paddingVertical: 4,
    textAlign: "center",
  },
  col2: { width: "63%", paddingHorizontal: 4, paddingVertical: 4 },
  col3: {
    width: "25%",
    paddingHorizontal: 4,
    paddingVertical: 4,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderTop: "1px solid #e2e8f0",
  },
  totalLabel: {
    width: "75%",
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 5,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "bold",
  },
  totalValue: {
    width: "25%",
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 5,
    textAlign: "right",
    fontSize: 16,
    fontWeight: "bold",
  },
  bahtTextRow: { flexDirection: "row", marginTop: 4 },
  bahtTextCell: {
    width: "100%",
    fontSize: 11,
    fontWeight: "bold",
    color: "#334155",
    textAlign: "right",
  },

  // ✍️ ลายเซ็น
  signArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    marginTop: 40,
  },
  signBox: { alignItems: "center" },
  // 🛡️ เดิม width:170 (เอกสารอื่นในกลุ่มนี้ใช้ 160 ทั้งหมด) ปรับให้เท่ากันตามที่ผู้ใช้ขอ ("ขนาดเดียวกัน")
  signLine: {
    width: 160,
    borderBottom: "1px solid #94a3b8",
    marginBottom: 6,
  },
  signText: { fontSize: 11, color: "#475569", marginTop: 2 },
});

// 🧾 ใบสำคัญรับเงิน — พิมพ์เมื่อคืนหลักประกันสัญญาราชการแล้วเท่านั้น
export default function ReceiptVoucherPdfTemplate({ data }: { data: any }) {
  const { companySettings, contract, paperSize, letterLayout } = data;
  const logoUrl = companySettings?.logo_base64 || companySettings?.logo;

  const amount = Number(contract?.guarantee_amount) || 0;
  const voucherDate = contract?.guarantee_returned_date
    ? dayjs(contract.guarantee_returned_date)
    : dayjs();

  // 🖨️ กล่องจัดวางอิสระ (x/y) — รองรับทั้ง A4/Letter/Half Letter
  const isLetter = paperSize === "Letter";
  const isHalfLetter = paperSize === "HalfLetter";
  const layout: LetterLayoutConfig = {
    ...(isLetter
      ? DEFAULT_LETTER_LAYOUTS.receipt_voucher
      : isHalfLetter
        ? DEFAULT_HALF_LETTER_LAYOUTS.receipt_voucher
        : DEFAULT_A4_LAYOUTS.receipt_voucher),
    ...(letterLayout || {}),
  };
  const isVisible = (key: string) => layout[key]?.visible !== false;
  // 🎨 สีพื้นหลังกล่อง — ตั้งค่าเดียวใช้ร่วมกันทั้งเอกสาร A4 ทุกประเภท (ไม่มีผลกับ Letter/Half Letter)
  const a4FillOpts: A4FillOptions = {
    enabled: paperSize === "A4",
    color: getA4BoxFillColor(companySettings),
  };
  // 🖨️ react-pdf ขนาด "LETTER" แบบ string เป็นค่ามาตรฐานตายตัวของ library (612x792 เสมอ) ไม่ผูกกับ
  // LETTER_PAGE_WIDTH/HEIGHT ของระบบนี้ที่เป็นกระดาษต่อเนื่อง 8x11" (576x792) — ต้องส่ง tuple เองเสมอ
  const pdfPageSize: "A4" | [number, number] = isLetter
    ? [LETTER_PAGE_WIDTH, LETTER_PAGE_HEIGHT]
    : isHalfLetter
      ? [HALF_LETTER_PAGE_WIDTH, HALF_LETTER_PAGE_HEIGHT]
      : "A4";

  // 🧩 เนื้อหาแต่ละส่วน แยกเป็นชิ้นย่อยเพื่อนำไปวางในกล่องตำแหน่งอิสระ (absoluteStyle) ด้านล่าง
  const CompanyInfoContent = () => (
    <View style={{ flexDirection: "row" }}>
      {logoUrl && <Image src={logoUrl} style={styles.logo} />}
      <View style={styles.companyInfo}>
        <Text style={styles.compName}>{companySettings?.name || "ชื่อบริษัท"}</Text>
        <Text style={styles.compText}>{companySettings?.address}</Text>
        <Text style={styles.compText}>
          โทร: {companySettings?.phone || "-"} เลขประจำตัวผู้เสียภาษี:{" "}
          {companySettings?.tax_id || "-"}
        </Text>
      </View>
    </View>
  );

  const TitleContent = () => (
    <View style={styles.docTitleBox}>
      <Text style={styles.docTitleTh}>ใบสำคัญรับเงิน</Text>
      <Text style={styles.docTitleEn}>Receipt Voucher</Text>
    </View>
  );

  const MetaInfoContent = () => (
    <>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>เลขที่:</Text>
        <Text style={styles.textBold}>{contract?.receipt_voucher_number || "-"}</Text>
      </View>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>วันที่:</Text>
        <Text>{voucherDate.format("DD/MM/YYYY")}</Text>
      </View>
    </>
  );

  // 🆕 [2026-09-20] ข้อความที่ผู้ใช้พิมพ์เองจากหน้าใบคุมสัญญา (receipt_voucher_text) แทนข้อความมาตรฐาน — ว่าง = ใช้ข้อความเดิม
  // ข้อความเป็น template — แทนตัวแปร {{company}}/{{agency}}/{{contract_number}} ตอนพิมพ์ (ดู lib/receiptVoucherText.ts)
  const bodyText = fillReceiptVoucherText(
    String(contract?.receipt_voucher_text || "").trim() || RECEIPT_VOUCHER_DEFAULT_TEXT,
    {
      company: companySettings?.name,
      agency: contract?.agency_name,
      contract_number: contract?.contract_number,
    },
  );
  // 📏 ข้อความพิมพ์ได้ไม่จำกัด — กล่องเนื้อหามีความสูงตายตัวตามเลย์เอาต์ ถ้าข้อความยาวกว่ากล่องจะถูกตารางรายการทับ/ตัดทิ้ง
  // จึงประมาณจำนวนบรรทัด (Thai ~0.467 ของขนาดฟอนต์/ตัว) แล้ว "ขยายกล่อง + ดันตารางรายการลง" เท่าส่วนที่เกิน (กล่องล่างสุด เช่น
  // ยอดรวม/ลายเซ็น ไม่ขยับ) — ถ้ายาวจนตารางเหลือที่ไม่พอ (ต่ำกว่า MIN_TABLE_HEIGHT) จะลดขนาดตัวอักษรลงทีละขั้น (12→8) ก่อน
  // กันตารางล้นหน้าจนเกิดหน้าว่างเพิ่ม
  const pageHeightForCalc = isLetter ? LETTER_PAGE_HEIGHT : isHalfLetter ? HALF_LETTER_PAGE_HEIGHT : A4_PAGE_HEIGHT;
  const baseTableHeight = layout.itemsTable ? computeStretchedItemsTableHeight(layout, pageHeightForCalc) : 0;
  const MIN_TABLE_HEIGHT = 100;
  const tableSlack = Math.max(0, baseTableHeight - MIN_TABLE_HEIGHT);
  const bodyBox = layout.bodyText;
  let bodyFontSize = 12;
  let bodyNeededHeight = 0;
  if (bodyBox) {
    const maxBodyHeight = bodyBox.height + tableSlack;
    for (const size of [12, 11, 10, 9, 8]) {
      bodyFontSize = size;
      const charsPerLine = Math.max(10, Math.floor(bodyBox.width / (size * 0.467)));
      const lines = bodyText
        .split(/\r?\n/)
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
      bodyNeededHeight = lines * size * 1.6 + 10;
      if (bodyNeededHeight <= maxBodyHeight) break;
    }
  }
  const bodyExtra = bodyBox ? Math.min(Math.max(0, Math.ceil(bodyNeededHeight - bodyBox.height)), tableSlack) : 0;
  const BodyTextContent = () => (
    <Text style={bodyFontSize === 12 ? styles.paragraph : [styles.paragraph, { fontSize: bodyFontSize }]}>{bodyText}</Text>
  );

  const ItemsTableContent = () => (
    <>
      <View style={styles.tableHeader}>
        <Text style={styles.col1}>ลำดับ</Text>
        <Text style={styles.col2}>รายการ</Text>
        <Text style={styles.col3}>จำนวนเงิน</Text>
      </View>

      <View style={styles.tableRow}>
        <Text style={styles.col1}>1</Text>
        <Text style={styles.col2}>
          รับคืนหลักประกันสัญญาเลขที่ {contract?.contract_number || "-"}
        </Text>
        <Text style={styles.col3}>
          {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      </View>

      {/* 📐 แถวว่างยืดเต็ม (flexGrow) — ดันแถวรวมยอดให้อยู่ชิดขอบล่างกรอบตารางเสมอเมื่อกล่องถูกยืดสูงขึ้น */}
      <View style={styles.tableRowStretch} />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>รวมเป็นเงินทั้งสิ้น</Text>
        <Text style={styles.totalValue}>
          {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      </View>
    </>
  );

  const GrandTotalTextContent = () => (
    <View style={styles.bahtTextRow}>
      <Text style={styles.bahtTextCell}>({bahtText(amount)})</Text>
    </View>
  );

  // 🛡️ เดิมกล่องนี้เตี้ย/เรียบง่ายกว่ากลุ่มอื่น (ไม่มีช่องรูปลายเซ็น/ชื่อผู้ลงนาม) ทำให้แถวลายเซ็นดูไม่ตรงกัน
  // ระหว่างเอกสาร — ปรับให้โครงสร้าง/ขนาดเหมือน SignatureContent ของ POPdfTemplate/GRPdfTemplate/
  // StockMovementPdfTemplate/ContractorWorkOrderPdfTemplate ทุกประการ (ช่องรูปลายเซ็นสูง 40pt + เส้นใต้ลายเซ็น
  // กว้าง 160pt เท่ากัน) — เอกสารนี้ไม่มีข้อมูลผู้ลงนามผูกกับ user จริง (ไม่ใช่เอกสารตระกูล sale-document) จึงยังไม่
  // ส่ง signer/dateField เข้ามา แสดงเป็นช่องว่างรอเซ็นเหมือนเดิม แค่ให้ "ขนาด/รูปแบบ" ตรงกับเอกสารอื่นเท่านั้น
  const SignatureContent = ({
    signer,
    label,
    dateField,
  }: {
    signer?: { signature_base64?: string; name?: string };
    label: string;
    dateField?: string;
  }) => (
    <View style={styles.signBox}>
      <View
        style={{
          height: 40,
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: 5,
          width: 160,
        }}
      >
        {signer?.signature_base64 && (
          <Image src={signer.signature_base64} style={{ height: 35, objectFit: "contain" }} />
        )}
      </View>
      <View style={styles.signLine} />
      <Text style={[styles.signText, { fontWeight: "bold" }]}>
        ( {signer?.name || "........................................"} )
      </Text>
      <Text style={styles.signText}>{label}</Text>
      <Text style={[styles.signText, { color: "#64748b" }]}>
        วันที่ {dateField ? dayjs(dateField).format("DD/MM/YYYY") : "......./......./......."}
      </Text>
    </View>
  );

  // 🖨️ กล่องอิสระ (x/y) รองรับทั้ง A4/Letter — เดิมเป็น flow เขียนตายตัวเฉพาะ A4 เท่านั้น
  return (
    <Document>
      <Page size={pdfPageSize} style={styles.pageBoxMode}>
        {isVisible("companyInfo") && (
          <View style={[absoluteStyle(layout.companyInfo), getA4BoxFillStyle(layout.companyInfo, a4FillOpts)]}>
            <CompanyInfoContent />
          </View>
        )}

        {isVisible("title") && (
          <View style={[absoluteStyle(layout.title), getA4BoxFillStyle(layout.title, a4FillOpts)]}>
            <TitleContent />
          </View>
        )}

        {/* 🎨 แถบสี (tab) คั่นหัวเอกสาร — เฉพาะ A4 เท่านั้น ปรับสีได้แยกต่อกลุ่มเอกสารจากหน้า editor */}
        {!isLetter && !isHalfLetter && isVisible("headerDivider") && layout.headerDivider && (
          <View
            style={[
              absoluteStyle(layout.headerDivider),
              { backgroundColor: getA4AccentColor(companySettings, "receipt_voucher") },
            ]}
          />
        )}

        {isVisible("metaInfo") && (
          <View style={[absoluteStyle(layout.metaInfo), getA4BoxFillStyle(layout.metaInfo, a4FillOpts)]}>
            <View style={styles.metaBox}>
              <MetaInfoContent />
            </View>
          </View>
        )}

        {isVisible("bodyText") && (
          <View
            style={[
              absoluteStyle(layout.bodyText),
              bodyExtra > 0 ? { height: layout.bodyText.height + bodyExtra } : {},
              getA4BoxFillStyle(layout.bodyText, a4FillOpts),
            ]}
          >
            <BodyTextContent />
          </View>
        )}

        {isVisible("itemsTable") && (
          <View
            style={[
              absoluteStyle(layout.itemsTable),
              {
                top: layout.itemsTable.y + bodyExtra,
                height: Math.max(MIN_TABLE_HEIGHT, baseTableHeight - bodyExtra),
              },
              getA4BoxFillStyle(layout.itemsTable, a4FillOpts),
            ]}
          >
            <View style={styles.table}>
              <ItemsTableContent />
            </View>
          </View>
        )}

        {isVisible("grandTotalText") && (
          <View style={[absoluteStyle(layout.grandTotalText), getA4BoxFillStyle(layout.grandTotalText, a4FillOpts)]}>
            <GrandTotalTextContent />
          </View>
        )}

        {isVisible("signatureLeft") && (
          <View style={[absoluteStyle(layout.signatureLeft), getA4BoxFillStyle(layout.signatureLeft, a4FillOpts)]}>
            <SignatureContent label="ผู้รับเงิน" />
          </View>
        )}

        {isVisible("signatureRight") && (
          <View style={[absoluteStyle(layout.signatureRight), getA4BoxFillStyle(layout.signatureRight, a4FillOpts)]}>
            <SignatureContent label="ผู้จ่ายเงิน" />
          </View>
        )}
      </Page>
    </Document>
  );
}
