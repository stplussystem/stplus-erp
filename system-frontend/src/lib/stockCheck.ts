import { getToken } from "@/lib/auth-storage";

export interface StockCheckRow {
  product_id: number;
  product_name: string | null;
  sku: string | null;
  requested_qty: number;
  qty: number;
  reserved_qty: number;
  // 🆕 [2026-09-15] แยกยอดจองตามที่มา — จองแล้ว (โครงการนี้เอง, แสดงสีเขียว) vs ติดจอง (โครงการอื่น, สีแดง)
  // ดู StockCheckController::check() — ไม่กระทบ available_qty/shortfall_qty ซึ่งยังคำนวณจาก reserved_qty รวมเดิม
  reserved_qty_same_project: number;
  reserved_qty_other_projects: number;
  available_qty: number;
  in_stock: boolean;
  shortfall_qty: number;
  // 🆕 [2026-09-15] ยอดขาดสุทธิหลังหักยอด PO ที่เปิดอยู่ (สั่งไปแล้วแต่ยังไม่ได้รับของ) — ใช้ตัดสินว่ายัง
  // ต้องสั่งซื้อเพิ่มไหม (StockCheckModal ปุ่ม "สร้างใบสั่งซื้อ") และเติมจำนวนอัตโนมัติตอนสร้าง PO ใหม่
  net_shortfall_after_po: number;
  warehouses: {
    warehouse_id: number;
    warehouse_name: string | null;
    qty: number;
    reserved_qty: number;
    reserved_qty_same_project: number;
    available_qty: number;
  }[];
  existing_purchase_orders: {
    po_id: number;
    po_number: string;
    status: string;
    quantity: number;
    received_quantity: number;
  }[];
}

// ดึงรายการสินค้าจากใบเสนอราคา (ตัด Bundle ออก เพราะแถวแม่ไม่มีสต๊อกของตัวเอง — เช็คแค่ส่วนประกอบที่เป็นแถว
// ปกติอยู่แล้ว) แล้วเช็คสต๊อกเทียบกับที่มีจริงผ่าน StockCheckController::check() — ใช้ร่วมกันระหว่าง
// StockCheckModal.tsx (โชว์ผลเช็ค) และ purchase-orders/create/page.tsx (ดึงรายการที่ขาดมาเติมให้อัตโนมัติ)
export async function checkStockForQuotation(
  quotationId: string | number,
): Promise<StockCheckRow[]> {
  const token = getToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const docRes = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/sale-documents/${quotationId}`,
    { headers },
  );
  if (!docRes.ok) throw new Error("โหลดใบเสนอราคาไม่สำเร็จ");
  const docData = await docRes.json();
  const doc = docData.data || docData;

  const items = (doc.items || [])
    .filter((item: any) => !item.product?.is_bundle)
    .map((item: any) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));

  if (items.length === 0) return [];

  const checkRes = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/stock-balances/check`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      // 🆕 ส่ง project_id ของใบเสนอราคานี้ไปด้วย ให้ backend แยกยอด "ติดจอง" ว่าเป็นของโครงการนี้เอง
      // (จองแล้ว) หรือโครงการอื่น (ติดจอง) — ดู StockCheckModal.tsx
      body: JSON.stringify({ items, project_id: doc.project_id }),
    },
  );
  if (!checkRes.ok) throw new Error("เช็คสต๊อกไม่สำเร็จ");
  const checkData = await checkRes.json();
  return checkData.data || [];
}
