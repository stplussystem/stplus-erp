"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewDebitNotePage() {
  return (
    <SaleDocumentView
      listHref="/sales/debit-notes"
      editHref={(id) => `/sales/debit-notes/${id}/edit`}
      editPermission="edit_debit_note"
    />
  );
}
