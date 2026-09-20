"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewMaterialIssuePage() {
  return (
    <SaleDocumentView
      listHref="/sales/material-issues"
      editHref={(id) => `/sales/material-issues/${id}/edit`}
      editPermission="edit_material_issue"
    />
  );
}
