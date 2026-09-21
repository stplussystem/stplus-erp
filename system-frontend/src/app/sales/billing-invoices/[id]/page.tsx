"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewBillingInvoicePage() {
  return (
    <SaleDocumentView
      listHref="/sales/billing-invoices"
      editHref={(id) => `/sales/billing-invoices/${id}/edit`}
      editPermission="edit_billing_invoice"
    />
  );
}
