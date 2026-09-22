"use client";

import { Barcode, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ItemSerialsDialogProps = {
  open: boolean;
  onClose: () => void;
  productName: string;
  sku?: string;
  serials: string[];
};

// 👁️ Popup แสดงรายการ S/N ที่ผูกกับแถวสินค้าของเอกสาร (อ่านอย่างเดียว) — ต่างจาก ViewSerialsDialog ที่ดึง S/N คงเหลือของสินค้าจาก
// ฐานข้อมูล อันนี้แสดงเฉพาะ S/N ที่เลือกไว้ในเอกสารนั้นจริงๆ
export function ItemSerialsDialog({ open, onClose, productName, sku, serials }: ItemSerialsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-md font-black text-blue-600">
            <Barcode className="w-5 h-5" />
            รายการ S/N ในเอกสาร
          </DialogTitle>
          <DialogDescription>
            {sku && <span className="font-bold text-foreground">{sku} </span>}
            {sku ? "- " : ""}
            {productName}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto pr-1">
          {serials.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[160px] gap-3 text-muted-foreground rounded-xl border border-dashed border-border">
              <Box className="w-8 h-8" />
              <p className="font-bold">ไม่มี S/N ในรายการนี้</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-3 px-1">
                <span className="text-sm font-bold text-muted-foreground">ทั้งหมด</span>
                <Badge className="bg-blue-100 text-blue-700 border-none">{serials.length} รายการ</Badge>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {serials.map((sn, index) => (
                  <li
                    key={`${sn}-${index}`}
                    className="flex items-center gap-3 bg-muted/50 p-2.5 rounded-lg border border-border"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-full bg-background text-muted-foreground flex items-center justify-center text-[11px] font-bold border border-border">
                      {index + 1}
                    </span>
                    <span className="text-[12px] font-bold text-foreground tracking-wider truncate" title={sn}>
                      {sn}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
