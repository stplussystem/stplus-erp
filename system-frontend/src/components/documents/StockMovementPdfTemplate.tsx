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

// 🚚 ใบเบิกสินค้า/ใบคืนสินค้า/ใบคืนสินค้าเช่า — เอกสารเคลื่อนไหวสต๊อกล้วนๆ ไม่มีราคา/VAT เลย (ตรวจฟอร์มจริง
// ยืนยันแล้วว่า tax_type="none", grand_total=0 เสมอ) โครงสร้าง/สไตล์เดียวกับ GRPdfTemplate.tsx ที่มีอยู่แล้ว
// รองรับกล่องจัดวางอิสระ (x/y) ทั้ง A4/Letter/Half Letter ตั้งแต่แรก (กลุ่ม layout "stock_movement")

Font.register({
  family: "Sarabun",
  fonts: [
    { src: "/fonts/THSarabun.ttf" },
    { src: "/fonts/THSarabun Bold.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  // 🖨️ ใช้กับโหมดจัดวางกล่องอิสระ (config-driven) ทั้ง A4/Letter/Half Letter — ไม่มี padding เพราะตำแหน่งกล่อง
  // อิงพิกัดเต็มหน้าโดยตรง
  pageBoxMode: { fontFamily: "Sarabun", fontSize: 12, color: "#0f172a" },

  logo: { width: 70, height: 70, objectFit: "contain" },
  companyInfo: { marginLeft: 15, width: "60%" },
  compName: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  compText: { fontSize: 12, color: "#334155", marginTop: 2 },
  docTitleBox: { alignItems: "flex-end" },
  docTitleTh: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#7c3aed",
    borderBottom: "3px solid #a78bfa",
    paddingBottom: 2,
  },
  docTitleEn: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 3,
  },

  contactBox: {
    width: "63%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  metaBox: {
    width: "35%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 10,
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#475569",
  },
  textBold: { fontWeight: "bold", color: "#0f172a" },
  textNormal: { fontSize: 11, color: "#334155", marginTop: 2 },
  flexRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },

  // 📦 ตารางรายการ — ไม่มีคอลัมน์ราคาเลย (เอกสารเคลื่อนไหวสต๊อกล้วนๆ)
  table: {
    flexGrow: 1,
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f3ff",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 10,
  },
  tableRow: { flexDirection: "row", fontSize: 12 },
  tableRowStretch: { flexDirection: "row", flexGrow: 1 },
  col1: { width: "10%", paddingHorizontal: 4, paddingVertical: 3, textAlign: "center" },
  col2: { width: "55%", paddingHorizontal: 4, paddingVertical: 3 },
  col3: { width: "17%", paddingHorizontal: 4, paddingVertical: 3, textAlign: "center" },
  col4: { width: "18%", paddingHorizontal: 4, paddingVertical: 3, textAlign: "center" },

  noteBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  signBox: { alignItems: "center" },
  signLine: {
    width: 160,
    borderBottom: "1px solid #94a3b8",
    marginBottom: 6,
  },
  signText: { fontSize: 11, color: "#475569", marginTop: 2 },
});

// หัวข้อเอกสารตาม document_type จริง 3 ประเภท
const DOC_TITLES: Record<string, { th: string; en: string }> = {
  stock_issue: { th: "ใบเบิกสินค้า", en: "Stock Issue" },
  stock_return: { th: "ใบคืนสินค้า (จากใบลดหนี้)", en: "Stock Return" },
  rental_stock_return: { th: "ใบคืนสินค้าเช่า", en: "Rental Stock Return" },
};

const StockMovementPdfTemplate = ({ data }: { data: any }) => {
  const {
    companySettings,
    documentType,
    documentNumber,
    formData = {},
    contactName,
    items = [],
    paperSize,
    letterLayout,
  } = data;
  const logoUrl = companySettings?.logo_base64 || companySettings?.logo;
  const docTitle = DOC_TITLES[documentType] || DOC_TITLES.stock_issue;

  // 🖨️ กล่องจัดวางอิสระ (x/y) — รองรับทั้ง A4/Letter/Half Letter
  const isLetter = paperSize === "Letter";
  const isHalfLetter = paperSize === "HalfLetter";
  const layout: LetterLayoutConfig = {
    ...(isLetter
      ? DEFAULT_LETTER_LAYOUTS.stock_movement
      : isHalfLetter
        ? DEFAULT_HALF_LETTER_LAYOUTS.stock_movement
        : DEFAULT_A4_LAYOUTS.stock_movement),
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

  // 📦 Bundle: แถวลูกไม่เพิ่มเลขลำดับ
  const isChildItemRow = (item: any) => !!(item?.parent_item_id || item?._parentRowId);
  const getParentItemNumber = (index: number) =>
    items.slice(0, index + 1).filter((row: any) => !isChildItemRow(row)).length;
  const itemDisplayName = (item: any) =>
    item?.item_name || item?.product_name || item?.product?.name || "-";

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
      <Text style={styles.docTitleTh}>{docTitle.th}</Text>
      <Text style={styles.docTitleEn}>{docTitle.en}</Text>
    </View>
  );

  const ContactInfoContent = () => (
    <>
      <Text style={styles.sectionTitle}>ลูกค้า / ผู้เกี่ยวข้อง</Text>
      <Text style={[styles.textNormal, styles.textBold, { fontSize: 14 }]}>
        {contactName || "-"}
      </Text>
      {formData?.reference_label && (
        <Text style={styles.textNormal}>
          {formData.reference_label}: {formData.reference_value || "-"}
        </Text>
      )}
    </>
  );

  const MetaInfoContent = () => (
    <>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>เลขที่เอกสาร:</Text>
        <Text style={styles.textBold}>{documentNumber || "-"}</Text>
      </View>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>วันที่:</Text>
        <Text>
          {formData?.doc_date ? dayjs(formData.doc_date).format("DD/MM/YYYY") : "-"}
        </Text>
      </View>
    </>
  );

  const ItemsTableContent = () => (
    <>
      <View style={styles.tableHeader}>
        <Text style={styles.col1}>ลำดับ</Text>
        <Text style={styles.col2}>ชื่อสินค้า</Text>
        <Text style={styles.col3}>จำนวน</Text>
        <Text style={styles.col4}>หน่วย</Text>
      </View>

      {items.map((item: any, idx: number) => {
        const isChild = isChildItemRow(item);
        const name = itemDisplayName(item);

        return (
          <View style={styles.tableRow} key={idx}>
            <Text style={styles.col1}>{isChild ? "" : getParentItemNumber(idx)}</Text>
            <Text style={[styles.col2, isChild ? { paddingLeft: 12 } : {}]}>
              {isChild ? `- ${name}` : name}
            </Text>
            <Text style={styles.col3}>{item?.quantity ?? "-"}</Text>
            <Text style={styles.col4}>{item?.unit_name || "-"}</Text>
          </View>
        );
      })}

      <View style={styles.tableRowStretch}>
        <Text style={styles.col1}></Text>
        <Text style={styles.col2}></Text>
        <Text style={styles.col3}></Text>
        <Text style={styles.col4}></Text>
      </View>
    </>
  );

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
              { backgroundColor: getA4AccentColor(companySettings, "stock_movement") },
            ]}
          />
        )}

        {isVisible("contactInfo") && (
          <View style={absoluteStyle(layout.contactInfo)}>
            <View style={styles.contactBox}>
              <ContactInfoContent />
            </View>
          </View>
        )}

        {isVisible("metaInfo") && (
          <View style={absoluteStyle(layout.metaInfo)}>
            <View style={styles.metaBox}>
              <MetaInfoContent />
            </View>
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

        {isVisible("notes") && formData?.note && (
          <View style={absoluteStyle(layout.notes)}>
            <View style={styles.noteBox}>
              <Text style={styles.sectionTitle}>หมายเหตุ:</Text>
              <Text style={styles.textNormal}>{formData.note}</Text>
            </View>
          </View>
        )}

        {isVisible("signatureLeft") && (
          <View style={absoluteStyle(layout.signatureLeft)}>
            <SignatureContent
              signer={formData?.creator}
              label="ผู้เบิก/ผู้คืนสินค้า"
              dateField={formData?.created_at}
            />
          </View>
        )}

        {isVisible("signatureRight") && (
          <View style={absoluteStyle(layout.signatureRight)}>
            <SignatureContent
              signer={formData?.approver}
              label="ผู้อนุมัติ"
              dateField={formData?.updated_at}
            />
          </View>
        )}
      </Page>
    </Document>
  );
};

export default StockMovementPdfTemplate;
