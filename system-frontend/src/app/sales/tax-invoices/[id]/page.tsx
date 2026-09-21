"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewTaxInvoicePage() {
  return (
    <SaleDocumentView
      listHref="/sales/tax-invoices"
      editHref={(id) => `/sales/tax-invoices/${id}/edit`}
      editPermission="edit_tax_invoice"
      editWhenApproved
    />
  );
}
