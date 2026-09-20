"use client";

import { SaleDocumentView } from "@/components/sales/SaleDocumentView";

export default function ViewPackingListPage() {
  return (
    <SaleDocumentView
      listHref="/sales/packing-lists"
      editHref={(id) => `/sales/packing-lists/${id}/edit`}
      editPermission="edit_packing_list"
    />
  );
}
