"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewInvoicePage() {
  return (
    <SaleDocumentView
      listHref="/sales/invoices"
      editHref={(id) => `/sales/invoices/${id}/edit`}
      editPermission="edit_invoice"
    />
  );
}
