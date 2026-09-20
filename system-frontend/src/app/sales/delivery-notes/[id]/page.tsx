"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewDeliveryNotePage() {
  return (
    <SaleDocumentView
      listHref="/sales/delivery-notes"
      editHref={(id) => `/sales/delivery-notes/${id}/edit`}
      editPermission="edit_delivery_note"
    />
  );
}
