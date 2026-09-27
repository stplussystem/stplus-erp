"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

// 👁️ หน้าดูใบคืนสินค้าเช่าแบบอ่านอย่างเดียว — ปลายทางของลิงก์ "ดูเอกสาร" (เช่น จากหน้า rental-jobs/[id]) แทนหน้า
// /edit ที่ปฏิเสธเอกสารที่อนุมัติแล้วด้วยข้อความแจ้งเตือน (ดู SaleDocumentView.tsx)
export default function ViewRentalStockReturnPage() {
  return (
    <SaleDocumentView
      listHref="/sales/rental-stock-returns"
      editHref={(id) => `/sales/rental-stock-returns/${id}/edit`}
      editPermission="edit_rental_stock_return"
    />
  );
}
