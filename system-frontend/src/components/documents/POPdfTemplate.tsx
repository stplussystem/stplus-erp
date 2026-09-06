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

  // 🏢 ส่วนหัว — ปรับ spacing/ขนาดให้ใกล้ SalesPdfTemplate
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

  // 📝 ข้อมูลผู้จำหน่าย / เลขที่เอกสาร
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
  // 🛡️ เดิมมี justifyContent:"center" — กล่องนี้เป็น position:"absolute" ความสูงคงที่ ครอบคอลัมน์แถวข้อมูลที่ไม่ได้
  // กำหนดความสูงตายตัว การ centering แบบนี้ทำให้ react-pdf/Yoga คำนวณตำแหน่งแต่ละแถวผิดจนซ้อนทับกันที่ y เดียวกัน
  // (ยืนยันแล้วว่าไม่ใช่ปัญหาพื้นที่ไม่พอ — ตัดออกให้ตรงกับ metaBoxFull ของกลุ่ม shared ที่ไม่เคยมีปัญหานี้)
  poBox: {
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

  // 📦 ตารางสินค้า — ไม่มีเส้นแบ่งแนวตั้ง/เส้นคั่นระหว่างรายการ
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
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 10,
  },
  tableRow: { flexDirection: "row", fontSize: 12 },
  tableRowStretch: { flexDirection: "row", flexGrow: 1 },
  col1: {
    width: "8%",
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "center",
  },
  col2: { width: "31%", paddingHorizontal: 4, paddingVertical: 3 },
  col3: {
    width: "10%",
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "center",
  },
  col4: {
    width: "10%",
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "center",
  },
  col5: {
    width: "14%",
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "right",
  },
  colDiscount: {
    width: "12%",
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "right",
    color: "#ef4444",
  },
  col6: {
    width: "15%",
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "right",
  },

  // 💰 หมายเหตุ / สรุปยอด
  summaryRow: {
    flexDirection: "row",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8,
  },
  // 🛡️ ตัด width:"60%"/borderRight ออก — เดิมออกแบบไว้ให้เป็นคอลัมน์ซ้ายของ summaryRow (สไตล์นี้เลิกใช้แล้ว) แต่กล่อง
  // notes ตอนนี้ใช้แบบ absolute-position เดี่ยวๆ (ไม่มีกล่องพี่น้องทางขวา) ทำให้ 60% บีบเนื้อที่แคบเกินจริงและ
  // borderRight กลายเป็นเส้นแปลกปลอมผ่ากลางกล่อง — ให้เต็มความกว้างกล่องแม่แทน
  noteBox: {
    padding: 10,
  },
  // 🖼️ เพิ่มเส้นขอบให้เห็นขอบเขตกล่องเสมอ (มาตรฐานเดียวกับ customerBoxFull/metaBoxFull ของกลุ่ม shared) แม้เอกสาร
  // บางประเภทจะยังพิมพ์เปล่าไม่มีข้อมูลเติมในบางช่อง ก็ยังเห็นกรอบว่างแทนที่จะเป็นพื้นที่ว่างมองไม่เห็นเลย
  // 🛡️ ตัด width:"40%" ออกเช่นกัน — เดิมออกแบบไว้เป็นคอลัมน์ขวาของ summaryRow เดียวกัน กล่อง summary ตอนนี้ก็ absolute-
  // position เดี่ยวๆ เหมือนกัน 40% บีบให้แถวสรุปยอด (เช่น "รวมเป็นเงิน (Subtotal)") ตัดขึ้น 2 บรรทัดแล้วเลขยอดไปทับ
  // กับบรรทัดที่ 2 ของแถวถัดไป (ยืนยันจริงจากไฟล์ PDF ที่ preview ออกมา)
  sumBox: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8 },
  sumLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 4,
    color: "#334155",
  },
  sumLineTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 5,
    borderTop: "1px solid #e2e8f0",
    fontWeight: "bold",
    color: "#0f172a",
  },

  // ✍️ ส่วนท้าย / ลายเซ็น
  footerArea: { marginTop: 6 },
  conditionBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  conditionText: { fontSize: 10, color: "#334155", lineHeight: 1.5 },
  signArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 50,
  },
  signBox: { alignItems: "center" },
  signLine: {
    width: 160,
    borderBottom: "1px solid #94a3b8",
    marginBottom: 6,
  },
  signText: { fontSize: 11, color: "#475569", marginTop: 2 },
});

const POPdfTemplate = ({ data }: { data: any }) => {
  const {
    companySettings,
    formData,
    selectedContact,
    items = [],
    finance,
    poNumber,
    footerCondition,
    paperSize,
    letterLayout,
  } = data;

  // 🖨️ กล่องจัดวางอิสระ (x/y) — รองรับทั้ง A4/Letter/Half Letter เหมือนกลุ่ม shared ใน SalesPdfTemplate.tsx
  const isLetter = paperSize === "Letter";
  const isHalfLetter = paperSize === "HalfLetter";
  const layout: LetterLayoutConfig = {
    ...(isLetter
      ? DEFAULT_LETTER_LAYOUTS.purchase_order
      : isHalfLetter
        ? DEFAULT_HALF_LETTER_LAYOUTS.purchase_order
        : DEFAULT_A4_LAYOUTS.purchase_order),
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

  const logoUrl = companySettings?.logo_base64 || companySettings?.logo;
  // 🖼️ พื้นหลังจางเต็มหน้า (watermark) — ใช้รูปแยกที่อัปโหลดที่หน้า /company แท็บ "แก้ไขใบเสนอราคา"
  // การ์ด "พื้นหลังจางเต็มหน้า (เอกสารขาย A4 ทุกประเภท)" (เดิมใช้โลโก้บริษัทเป็น watermark อัตโนมัติ
  // เปลี่ยนมาใช้รูปนี้แทนตามที่ผู้ใช้ยืนยัน — โลโก้หัวกระดาษปกติด้านล่างยังใช้ logoUrl เหมือนเดิม)
  const watermarkUrl = companySettings?.a4_watermark_background_base64 || null;

  // 📦 Bundle: แถวลูกไม่เพิ่มเลขลำดับ และใช้สีเดียวกับแถวแม่
  const isChildItemRow = (item: any) =>
    !!(item?.parent_item_id || item?._parentRowId);

  const getParentItemNumber = (index: number) =>
    items.slice(0, index + 1).filter((row: any) => !isChildItemRow(row)).length;

  const itemDisplayName = (item: any) =>
    item?.item_name || item?.product_name || item?.product?.name || "-";

  // 🧩 เนื้อหาแต่ละส่วน แยกเป็นชิ้นย่อยเพื่อนำไปวางในกล่องตำแหน่งอิสระ (absoluteStyle) ด้านล่าง
  // เนื้อหาเดิมทุกตัวอักษรเหมือนเดิม แค่ย้ายจาก flow ธรรมดามาอยู่ในกล่องลากตำแหน่งได้
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
      <Text style={styles.docTitleTh}>ใบสั่งซื้อ</Text>
      <Text style={styles.docTitleEn}>Purchase Order</Text>
    </View>
  );

  const VendorInfoContent = () => (
    <>
      <Text style={styles.sectionTitle}>ผู้จำหน่าย</Text>
      <Text style={[styles.textNormal, styles.textBold, { fontSize: 14 }]}>
        {selectedContact?.business_name || selectedContact?.contact_name || "-"}{" "}
        {!selectedContact?.branch_code
          ? " (สำนักงานใหญ่)"
          : ` (สาขา ${selectedContact.branch_code})`}
      </Text>
      <Text style={styles.textNormal}>
        {selectedContact?.address || "-"}{" "}
        {selectedContact?.phone ? ` โทร: ${selectedContact.phone}` : ""}
      </Text>
      <Text style={styles.textNormal}>
        เลขประจำตัวผู้เสียภาษี: {selectedContact?.tax_id || "-"}
      </Text>
    </>
  );

  const MetaInfoContent = () => (
    <>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>ใบสั่งซื้อเลขที่:</Text>
        <Text style={styles.textBold}>{poNumber || "-"}</Text>
      </View>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>วันที่:</Text>
        <Text>
          {formData?.expected_date
            ? dayjs(formData.expected_date).format("DD/MM/YYYY")
            : "-"}
        </Text>
      </View>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>อ้างอิง:</Text>
        <Text>{formData?.reference_number || "-"}</Text>
      </View>
      <View style={styles.flexRow}>
        <Text style={styles.textBold}>ชำระเงิน:</Text>
        <Text>
          {Number(formData?.credit_days) > 0
            ? `${formData.credit_days} วัน`
            : "เงินสด"}
        </Text>
      </View>
    </>
  );

  const ItemsTableContent = () => (
    <>
      <View style={styles.tableHeader}>
        <Text style={styles.col1}>ลำดับ</Text>
        <Text style={styles.col2}>รายละเอียด</Text>
        <Text style={styles.col3}>จำนวน</Text>
        <Text style={styles.col4}>หน่วย</Text>
        <Text style={styles.col5}>ราคา/หน่วย</Text>
        <Text style={styles.colDiscount}>ส่วนลด</Text>
        <Text style={styles.col6}>จำนวนเงิน</Text>
      </View>

      {items.map((item: any, idx: number) => {
        const isChild = isChildItemRow(item);
        const name = itemDisplayName(item);
        const unitName = item?.unit_name || item?.unit || "ชิ้น";

        if (isChild) {
          return (
            <View style={styles.tableRow} key={idx}>
              <Text style={styles.col1}></Text>
              <Text wrap={false} style={[styles.col2, { paddingLeft: 12 }]}>
                - {name} — {item?.quantity} {unitName}
              </Text>
              <Text style={styles.col3}>-</Text>
              <Text style={styles.col4}>-</Text>
              <Text style={styles.col5}>-</Text>
              <Text style={styles.colDiscount}>-</Text>
              <Text style={styles.col6}>-</Text>
            </View>
          );
        }

        return (
          <View style={styles.tableRow} key={idx}>
            <Text style={styles.col1}>{getParentItemNumber(idx)}</Text>
            <Text style={styles.col2}>{name}</Text>
            <Text style={styles.col3}>{item?.quantity}</Text>
            <Text style={styles.col4}>{unitName}</Text>
            <Text style={styles.col5}>
              {Number(item?.unit_price || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
            <Text style={styles.colDiscount}>
              {Number(item?.discount_amount || 0) > 0
                ? Number(item.discount_amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })
                : "-"}
            </Text>
            <Text style={styles.col6}>
              {Number(item?.total_price || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        );
      })}

      <View style={styles.tableRowStretch}>
        <Text style={styles.col1}></Text>
        <Text style={styles.col2}></Text>
        <Text style={styles.col3}></Text>
        <Text style={styles.col4}></Text>
        <Text style={styles.col5}></Text>
        <Text style={styles.colDiscount}></Text>
        <Text style={styles.col6}></Text>
      </View>
    </>
  );

  const NotesContent = () => (
    <Text style={styles.textNormal}>{formData?.note || "-"}</Text>
  );

  const GrandTotalTextContent = () => (
    <Text style={{ fontSize: 11, fontWeight: "bold", color: "#334155", textAlign: "right" }}>
      ({bahtText(Number(finance?.grand_total || 0))})
    </Text>
  );

  const SummaryContent = () => (
    <>
      <View style={styles.sumLine}>
        <Text>รวมเป็นเงิน (Subtotal)</Text>
        <Text>
          {Number(finance?.subtotal || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      </View>
      <View style={styles.sumLine}>
        <Text>หักส่วนลดท้ายบิล</Text>
        <Text>
          {Number(finance?.discount || 0) > 0
            ? `- ${Number(finance.discount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}`
            : "-"}
        </Text>
      </View>
      <View style={styles.sumLine}>
        <Text>ยอดหลังหักส่วนลด</Text>
        <Text>
          {Number(finance?.after_discount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      </View>
      {formData?.tax_type !== "none" && (
        <View style={styles.sumLine}>
          <Text>
            ภาษีมูลค่าเพิ่ม{" "}
            {formData?.tax_type === "include" ? "(รวมในยอด)" : "(7%)"}
          </Text>
          <Text>
            {Number(finance?.vat_amount || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>
      )}
      <View style={styles.sumLineTotal}>
        <Text style={{ fontSize: 12, fontWeight: "bold" }}>ยอดเงินสุทธิ (Total)</Text>
        <Text style={{ fontSize: 16, fontWeight: "bold" }}>
          {Number(finance?.grand_total || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      </View>
    </>
  );

  const FooterConditionContent = () => (
    <Text style={styles.conditionText}>{footerCondition || "-"}</Text>
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
        {signer?.signature_base64 ? (
          <Image src={signer.signature_base64} style={{ height: 35, objectFit: "contain" }} />
        ) : null}
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
        {!isLetter && watermarkUrl && (
          <View style={styles.watermarkContainer}>
            <Image src={watermarkUrl} style={styles.watermarkImage} />
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
              { backgroundColor: getA4AccentColor(companySettings, "purchase_order") },
            ]}
          />
        )}

        {isVisible("vendorInfo") && (
          <View style={absoluteStyle(layout.vendorInfo)}>
            <View style={styles.supBox}>
              <VendorInfoContent />
            </View>
          </View>
        )}

        {isVisible("metaInfo") && (
          <View style={absoluteStyle(layout.metaInfo)}>
            <View style={styles.poBox}>
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

        {isVisible("notes") && (
          <View style={absoluteStyle(layout.notes)}>
            <View style={styles.noteBox}>
              <Text style={styles.sectionTitle}>หมายเหตุ:</Text>
              <NotesContent />
            </View>
          </View>
        )}

        {isVisible("grandTotalText") && (
          <View style={absoluteStyle(layout.grandTotalText)}>
            <GrandTotalTextContent />
          </View>
        )}

        {isVisible("summary") && (
          <View style={absoluteStyle(layout.summary)}>
            <View style={styles.sumBox}>
              <SummaryContent />
            </View>
          </View>
        )}

        {isVisible("footerCondition") && (
          <View style={absoluteStyle(layout.footerCondition)}>
            <View style={styles.conditionBox}>
              <FooterConditionContent />
            </View>
          </View>
        )}

        {isVisible("signatureLeft") && (
          <View style={absoluteStyle(layout.signatureLeft)}>
            <SignatureContent
              signer={formData?.creator}
              label="ผู้จัดทำ / ผู้สั่งซื้อ"
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

export default POPdfTemplate;
