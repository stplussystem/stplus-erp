// 🧾 ข้อความย่อหน้าใต้หัวเอกสารของ "ใบสำคัญรับเงิน" (สัญญาราชการ) — เก็บเป็น template ที่ผู้ใช้แก้ไขได้ไม่จำกัดความยาว
// ใส่ตัวแปรได้: {{company}} = ชื่อบริษัท, {{agency}} = ชื่อหน่วยงาน, {{contract_number}} = เลขที่สัญญา (แทนค่าตอนพิมพ์)
export const RECEIPT_VOUCHER_DEFAULT_TEXT =
  "{{company}} ได้รับเงินคืนหลักประกันสัญญาจาก {{agency}} ตามสัญญาเลขที่ {{contract_number}} เป็นจำนวนเงินดังรายการต่อไปนี้";

export function fillReceiptVoucherText(
  text: string,
  vars: { company?: string | null; agency?: string | null; contract_number?: string | null },
): string {
  return text
    .replace(/\{\{\s*company\s*\}\}/g, vars.company || "บริษัท")
    .replace(/\{\{\s*agency\s*\}\}/g, vars.agency || "-")
    .replace(/\{\{\s*contract_number\s*\}\}/g, vars.contract_number || "-");
}
