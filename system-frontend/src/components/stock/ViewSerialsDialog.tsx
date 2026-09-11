"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Barcode, Box } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AppLoading } from "@/components/ui/app-loading";

type ViewSerialsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
  sku: string;
};

export function ViewSerialsDialog({
  isOpen,
  onClose,
  productId,
  productName,
  sku,
}: ViewSerialsDialogProps) {
  const [serials, setSerials] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // จะดึงข้อมูลก็ต่อเมื่อมีการเปิด Pop-up เท่านั้น
    if (isOpen && productId) {
      setLoading(true);
      apiFetch(`/products/${productId}/available-serials`)
        .then((res) => {
          if (res && res.data) {
            setSerials(res.data);
          }
        })
        .catch((err) => console.error("ดึงข้อมูล S/N ไม่สำเร็จ:", err))
        .finally(() => setLoading(false));
    } else {
      setSerials([]); // เคลียร์ค่าทิ้งเวลาปิด
    }
  }, [isOpen, productId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl bg-white dark:bg-slate-950 rounded-2xl p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-md font-black text-blue-600">
            <Barcode className="w-6 h-6" />
            รายการ S/N คงเหลือ
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            <span className="font-bold text-black dark:text-white">{sku}</span>{" "}
            - {productName}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[200px] max-h-[400px] overflow-y-auto mt-4 pr-2 custom-scrollbar">
          {loading ? (
            <AppLoading text="กำลังดึงข้อมูล S/N..." minHeight="h-[200px]" />
          ) : serials.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] gap-3 text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <Box className="w-10 h-10 text-slate-300" />
              <p className="font-bold">ไม่มี S/N คงเหลือในระบบ</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4 px-1">
                <span className="text-sm font-bold text-slate-500">
                  ทั้งหมด
                </span>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
                  {serials.length} รายการ
                </Badge>
              </div>
              
              {/* 💡 เปลี่ยนตรงนี้เป็น Grid 3 คอลัมน์ */}
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {serials.map((sn, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-blue-300 transition-colors"
                  >
                    <div className="shrink-0 w-7 h-7 rounded-full bg-white dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-sm">
                      {index + 1}
                    </div>
                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 tracking-wider truncate" title={sn}>
                      {sn}
                    </span>
                  </li>
                ))}
              </ul>

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}