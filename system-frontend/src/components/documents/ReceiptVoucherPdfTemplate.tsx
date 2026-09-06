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
  metaBox: {
    width: "38%",
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
  signLine: {
    width: 170,
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

  const BodyTextContent = () => (
    <Text style={styles.paragraph}>
      {`${companySettings?.name || "บริษัท"} ได้รับเงินคืนหลักประกันสัญญาจาก ${
        contract?.agency_name || "-"
      } ตามสัญญาเลขที่ ${
        contract?.contract_number || "-"
      } เป็นจำนวนเงินดังรายการต่อไปนี้`}
    </Text>
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

  const SignatureContent = ({ label }: { label: string }) => (
    <View style={styles.signBox}>
      <View style={styles.signLine} />
      <Text style={styles.signText}>{label}</Text>
      <Text style={[styles.signText, { color: "#64748b" }]}>วันที่ ......./......./.......</Text>
    </View>
  );

  // 🖨️ กล่องอิสระ (x/y) รองรับทั้ง A4/Letter — เดิมเป็น flow เขียนตายตัวเฉพาะ A4 เท่านั้น
  return (
    <Document>
      <Page size={pdfPageSize} style={styles.pageBoxMode}>
        {isVisible("companyInfo") && (
          <View style={absoluteStyle(layout.companyInfo)}>
            <CompanyInfoContent />
          </View>
        )}

        {isVisible("title") && (
          <View style={absoluteStyle(layout.title)}>
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
          <View style={absoluteStyle(layout.metaInfo)}>
            <View style={styles.metaBox}>
              <MetaInfoContent />
            </View>
          </View>
        )}

        {isVisible("bodyText") && (
          <View style={absoluteStyle(layout.bodyText)}>
            <BodyTextContent />
          </View>
        )}

        {isVisible("itemsTable") && (
          <View
            style={[
              absoluteStyle(layout.itemsTable),
              { height: computeStretchedItemsTableHeight(layout, isLetter ? LETTER_PAGE_HEIGHT : isHalfLetter ? HALF_LETTER_PAGE_HEIGHT : A4_PAGE_HEIGHT) },
            ]}
          >
            <View style={styles.table}>
              <ItemsTableContent />
            </View>
          </View>
        )}

        {isVisible("grandTotalText") && (
          <View style={absoluteStyle(layout.grandTotalText)}>
            <GrandTotalTextContent />
          </View>
        )}

        {isVisible("signatureLeft") && (
          <View style={absoluteStyle(layout.signatureLeft)}>
            <SignatureContent label="ผู้รับเงิน" />
          </View>
        )}

        {isVisible("signatureRight") && (
          <View style={absoluteStyle(layout.signatureRight)}>
            <SignatureContent label="ผู้จ่ายเงิน" />
          </View>
        )}
      </Page>
    </Document>
  );
}
