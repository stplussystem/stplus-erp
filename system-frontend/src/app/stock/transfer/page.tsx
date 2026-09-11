"use client";

import React from "react";
import StockTransferForm from "@/components/stock/StockTransferForm";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export default function StockTransferPage() {
  return (
    <RoleRouteGuard permission="menu_stock_transfer">
      <div className="w-full max-w-full px-4 py-4 text-foreground">
        <StockTransferForm />
      </div>
    </RoleRouteGuard>
  );
}
