"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewReceiptPage() {
  return (
    <SaleDocumentView
      listHref="/sales/receipts"
      editHref={(id) => `/sales/receipts/${id}/edit`}
      editPermission="edit_receipt"
    />
  );
}
