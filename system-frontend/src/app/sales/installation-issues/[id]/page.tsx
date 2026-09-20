"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewInstallationIssuePage() {
  return (
    <SaleDocumentView
      listHref="/sales/installation-issues"
      editHref={(id) => `/sales/installation-issues/${id}/edit`}
      editPermission="edit_installation_issue"
      showCostPrice
    />
  );
}
