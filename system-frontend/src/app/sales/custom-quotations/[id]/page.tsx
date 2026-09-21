"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewCustomQuotationPage() {
  return (
    <SaleDocumentView
      listHref="/sales/custom-quotations"
      editHref={(id) => `/sales/custom-quotations/${id}/edit`}
      editPermission="edit_custom_quotation"
    />
  );
}
