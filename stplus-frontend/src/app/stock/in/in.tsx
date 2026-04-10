import StockMovementForm from "@/components/stock/StockMovementForm";
import { PackagePlus } from "lucide-react";

export default function StockInPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-3">
        {/* 💡 ปรับสีพื้นหลังไอคอนให้ซอฟต์ลงในโหมดมืด */}
        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
          <PackagePlus className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            รับสินค้าเข้าคลัง (Stock In)
          </h1>
          <p className="text-muted-foreground mt-1">
            บันทึกการรับเข้าสินค้าใหม่เข้าสู่คลัง และจัดเก็บ Serial Number (S/N)
          </p>
        </div>
      </div>
      <div className="max-w-4xl">
        <StockMovementForm mode="in" />
      </div>
    </div>
  );
}
