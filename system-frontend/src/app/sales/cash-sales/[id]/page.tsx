"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewCashSalePage() {
  return (
    <SaleDocumentView
      listHref="/sales/cash-sales"
      editHref={(id) => `/sales/cash-sales/${id}/edit`}
      editPermission="edit_cash"
    />
  );
}
