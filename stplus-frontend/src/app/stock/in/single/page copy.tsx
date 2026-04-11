import StockMovementForm from "@/components/stock/StockMovementForm";
import { PackagePlus } from "lucide-react";

export default function SingleStockInPage() {
  return (
    // 💡 ปรับเป็นโครงสร้างมาตรฐานที่คุณแม็คกำหนด
    <div className="w-full max-w-full px-4 md:px-4 py-6 overflow-x-hidden">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
          <PackagePlus className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            รับเข้าสินค้าทีละรายการ (Single)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            บันทึกการรับเข้าสินค้าแบบรวดเร็วทีละหนึ่งรายการ
          </p>
        </div>
      </div>
      
      <div className="max-w-4xl bg-card border border-border rounded-xl p-6 shadow-sm">
        <StockMovementForm mode="in" />
      </div>
    </div>
  );
}