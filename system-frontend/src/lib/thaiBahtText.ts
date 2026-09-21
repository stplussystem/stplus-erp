// 🔤 แปลงจำนวนเงิน (บาท) เป็นคำอ่านภาษาไทย เช่น 1250.50 -> "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์"
// ใช้ในเอกสาร "ใบสำคัญรับเงิน" (ReceiptVoucherPdfTemplate) — อัลกอริทึมมาตรฐาน ไม่มีของเดิมในระบบให้ใช้ซ้ำ

const DIGIT_NAMES = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACE_NAMES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

// อ่านตัวเลขจำนวนเต็มไม่เกิน 6 หลัก (ก่อนถึง "ล้าน") เป็นคำไทย — เรียกซ้ำแบบ recursive สำหรับหลักล้านขึ้นไป
function readInteger(numStr: string): string {
  if (numStr === "0" || numStr === "") return "";

  // ตัดหลักล้านออกไปอ่านแยก แล้ววนอ่านส่วนที่เหลือซ้ำ (รองรับหลักสิบล้าน ร้อยล้าน ฯลฯ)
  if (numStr.length > 7) {
    const millionsPart = numStr.slice(0, numStr.length - 6);
    const restPart = numStr.slice(numStr.length - 6);
    const restNum = parseInt(restPart, 10);
    return readInteger(millionsPart) + "ล้าน" + (restNum > 0 ? readInteger(String(restNum)) : "");
  }

  let result = "";
  const digits = numStr.split("").map(Number);
  const len = digits.length;

  for (let i = 0; i < len; i++) {
    const digit = digits[i];
    const placeIndex = len - i - 1; // 0=หน่วย, 1=สิบ, 2=ร้อย, ...
    if (digit === 0) continue;

    if (placeIndex === 0) {
      // หลักหน่วย: "หนึ่ง" ตัวสุดท้ายอ่านว่า "เอ็ด" ถ้าไม่ใช่เลขตัวเดียว
      if (digit === 1 && len > 1) {
        result += "เอ็ด";
      } else {
        result += DIGIT_NAMES[digit];
      }
    } else if (placeIndex === 1) {
      // หลักสิบ: "สองสิบ" อ่านว่า "ยี่สิบ", "หนึ่งสิบ" อ่านว่า "สิบ"
      if (digit === 1) {
        result += "สิบ";
      } else if (digit === 2) {
        result += "ยี่สิบ";
      } else {
        result += DIGIT_NAMES[digit] + "สิบ";
      }
    } else if (placeIndex <= 6) {
      result += DIGIT_NAMES[digit] + PLACE_NAMES[placeIndex];
    }
  }

  return result;
}

export function bahtText(amount: number): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  const isNegative = rounded < 0;
  const abs = Math.abs(rounded);

  const bahtPart = Math.floor(abs);
  const satangPart = Math.round((abs - bahtPart) * 100);

  const bahtText = bahtPart === 0 ? "ศูนย์" : readInteger(String(bahtPart));
  let result = bahtText + "บาท";

  if (satangPart === 0) {
    result += "ถ้วน";
  } else {
    result += readInteger(String(satangPart)) + "สตางค์";
  }

  return (isNegative ? "ลบ" : "") + result;
}
