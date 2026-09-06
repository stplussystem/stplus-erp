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

  // 💧 ลายน้ำ
  watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: -1,
  },
  watermarkImage: { width: 400, opacity: 0.08 },

  // 🏢 ส่วนหัว — รักษาธีมเขียวของ GR แต่ใช้ spacing มาตรฐานใหม่
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
    color: "#059669",
    borderBottom: "3px solid #10b981",
    paddingBottom: 2,
  },
  docTitleEn: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 3,
  },
  greenLine: {
    width: "100%",
    height: 4,
    backgroundColor: "#10b981",
    marginVertical: 6,
  },

  // 📝 กล่องข้อมูลอ้างอิง
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  supBox: {
    width: "63%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  // 🛡️ ตัด justifyContent:"center" ออก — ทำให้ react-pdf/Yoga คำนวณตำแหน่งแถวข้อมูลผิดจนซ้อนทับกัน (ดูคอมเมนต์
  // เดียวกันใน POPdfTemplate.tsx ที่เจอบั๊กนี้ก่อน)
  grBox: {
    width: "35%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 10,
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

  // 📦 ตารางรับสินค้า — ไม่มีเส้นแบ่งแนวตั้ง/เส้นคั่นรายการ
  tableContainer: { flexGrow: 1, display: "flex", flexDirection: "column" },
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
    backgroundColor: "#f0fdf4",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 10,
  },
  tableRow: { flexDirection: "row", fontSize: 12 },
  tableRowStretch: { flexDirection: "row", flexGrow: 1 },
  col1: {
    width: "10%",
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "center",
  },
  col2: { width: "50%", paddingHorizontal: 4, paddingVertical: 3 },
  col3: {
    width: "20%",
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "center",
  },
  col4: {
    width: "20%",
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "center",
  },

  // 📌 หมายเหตุ / ลายเซ็น
  noteBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  signArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    marginTop: 10,
  },
  signBox: { alignItems: "center" },
  signLine: {
    width: 160,
    borderBottom: "1px solid #94a3b8",
    marginBottom: 6,
  },
  signText: { fontSize: 11, color: "#475569", marginTop: 2 },
});

const GRPdfTemplate = ({ data }: { data: any }) => {
  const { companySettings, grData, items = [], creator, paperSize, letterLayout } = data;
  const logoUrl = companySettings?.logo_base64 || companySettings?.logo;

  // 🖨️ กล่องจัดวางอิสระ (x/y) — รองรับทั้ง A4/Letter/Half Letter
  const isLetter = paperSize === "Letter";
  const isHalfLetter = paperSize === "HalfLetter";
  const layout: LetterLayoutConfig = {
    ...(isLetter
      ? DEFAULT_LETTER_LAYOUTS.goods_receipt
      : isHalfLetter
        ? DEFAULT_HALF_LETTER_LAYOUTS.goods_receipt
        : DEFAULT_A4_LAYOUTS.goods_receipt),
    ...(letterLayout || {}),
  };
  const isVisible = (key: string) => layout[key]?.visible !== false;
  // 🖨️ react-pdf ขนาด "LETTER"/"A4" ที่เป็น string เป็นค่ามาตรฐานตายตัวของ library เอง (LETTER=612x792 เสมอ)
  // ไม่ผูกกับ LETTER_PAGE_WIDTH/HEIGHT ของระบบนี้ที่เป็นกระดาษต่อเนื่อง 8x11 นิ้ว (576x792) — ต้องส่งเป็น custom
  // tuple [width, height] เสมอสำหรับ Letter เช่นกัน ไม่ใช่แค่ Half Letter ไม่งั้นพิกัดกล่อง (ที่คำนวณจาก 576pt)
  // จะเพี้ยนกับพื้นที่หน้ากระดาษจริง (612pt) ที่ react-pdf จะ render ให้
  const pdfPageSize: "A4" | [number, number] = isLetter
    ? [LETTER_PAGE_WIDTH, LETTER_PAGE_HEIGHT]
    : isHalfLetter
      ? [HALF_LETTER_PAGE_WIDTH, HALF_LETTER_PAGE_HEIGHT]
      : "A4";

  // ถ้า GR ได้ข้อมูล Bundle มาจาก PO/Sales ให้เลขลำดับนับเฉพาะแถวแม่
  const isChildItemRow = (item: any) =>
    !!(item?.parent_item_id || item?._parentRowId);

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
      <Text style={styles.docTitleTh}>ใบรับสินค้า</Text>
      <Text style={styles.docTitleEn}>Goods Receipt</Text>
    </View>
  );

  const SupplierInfoContent = () => (
    <>
      <Text style={styles.sectionTitle}>รับสินค้าจาก (Supplier)</Text>
      <Text style={[styles.textNormal, styles.textBold, { fontSize: 14 }]}>
        {grData?.business_name || grData?.contact_name || "ไม่ระบุข้อมูลผู้จำหน่าย"}
      </Text>
      <Text style={styles.textNormal}>
        เอกสารอ้างอิงภายนอก (บิลหน้าร้าน): {grData?.reference_number || "-"}
      </Text>
    </>
  );

  const MetaInfoContent = () => (
    <>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>เลขที่ใบรับของ:</Text>
        <Text style={styles.textBold}>{grData?.gr_number || "-"}</Text>
      </View>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>วันที่รับเข้า:</Text>
        <Text>
          {grData?.received_date ? dayjs(grData.received_date).format("DD/MM/YYYY") : "-"}
        </Text>
      </View>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>อ้างอิง PO:</Text>
        <Text>{grData?.po_number || "รับตรงไม่มี PO"}</Text>
      </View>
    </>
  );

  const ItemsTableContent = () => (
    <>
      <View style={styles.tableHeader}>
        <Text style={styles.col1}>ลำดับ</Text>
        <Text style={styles.col2}>รายการสินค้าที่รับเข้าคลัง</Text>
        <Text style={styles.col3}>จำนวนรับ</Text>
        <Text style={styles.col4}>หมายเหตุ</Text>
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
            <Text style={styles.col4}>{item?.note || ""}</Text>
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

  // 🖨️ กล่องอิสระ (x/y) รองรับทั้ง A4/Letter — เดิมเป็น flow เขียนตายตัวเฉพาะ A4 เท่านั้น
  return (
    <Document>
      <Page size={pdfPageSize} style={styles.pageBoxMode}>
        {!isLetter && logoUrl && (
          <View style={styles.watermarkContainer}>
            <Image src={logoUrl} style={styles.watermarkImage} />
          </View>
        )}

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
              { backgroundColor: getA4AccentColor(companySettings, "goods_receipt") },
            ]}
          />
        )}

        {isVisible("supplierInfo") && (
          <View style={absoluteStyle(layout.supplierInfo)}>
            <View style={styles.supBox}>
              <SupplierInfoContent />
            </View>
          </View>
        )}

        {isVisible("metaInfo") && (
          <View style={absoluteStyle(layout.metaInfo)}>
            <View style={styles.grBox}>
              <MetaInfoContent />
            </View>
          </View>
        )}

        {isVisible("itemsTable") && (
          <View
            style={[
              absoluteStyle(layout.itemsTable),
              // 📐 ยืดสูงเต็มพื้นที่ที่เหลือจริงเสมอ (แม้มีแค่ 1 รายการ) ดันหมายเหตุ/ลายเซ็นให้ดูติดกับตาราง
              { height: computeStretchedItemsTableHeight(layout, isLetter ? LETTER_PAGE_HEIGHT : isHalfLetter ? HALF_LETTER_PAGE_HEIGHT : A4_PAGE_HEIGHT) },
            ]}
          >
            <View style={styles.table}>
              <ItemsTableContent />
            </View>
          </View>
        )}

        {isVisible("notes") && grData?.note && (
          <View style={absoluteStyle(layout.notes)}>
            <View style={styles.noteBox}>
              <Text style={styles.sectionTitle}>หมายเหตุการรับสินค้า:</Text>
              <Text style={styles.textNormal}>{grData.note}</Text>
            </View>
          </View>
        )}

        {isVisible("signatureLeft") && (
          <View style={absoluteStyle(layout.signatureLeft)}>
            <SignatureContent
              signer={creator}
              label="ผู้ตรวจรับสินค้า (Storekeeper)"
              dateField={grData?.created_at}
            />
          </View>
        )}

        {isVisible("signatureRight") && (
          <View style={absoluteStyle(layout.signatureRight)}>
            <SignatureContent label="ผู้ส่งมอบสินค้า / ผู้ขับรถ" />
          </View>
        )}
      </Page>
    </Document>
  );
};

export default GRPdfTemplate;
