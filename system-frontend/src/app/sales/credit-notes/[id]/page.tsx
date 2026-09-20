"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewCreditNotePage() {
  return (
    <SaleDocumentView
      listHref="/sales/credit-notes"
      editHref={(id) => `/sales/credit-notes/${id}/edit`}
      editPermission="edit_credit_note"
    />
  );
}
