"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PackagePlus, Check, Link2 } from "lucide-react";

interface RelatedProduct {
  id: number;
  name: string;
  sku: string;
  can_rent?: boolean;
  is_install_job?: boolean;
}

interface RelatedProductGroup {
  sourceProductName: string;
  products: RelatedProduct[];
}

interface RelatedProductPromptDialogProps {
  isOpen: boolean;
  groups: RelatedProductGroup[];
  onAdd: (product: RelatedProduct) => void;
  onClose: () => void;
}

// 🎪 Popup บังคับให้เลือกตอนหยิบสินค้าที่มี "สินค้าคู่กัน" (เช่น เสา Beam ต้องคู่กับเสาแกน Beam)
// บังคับเลือก (ไม่มีปุ่มปิดมุมขวาบน กด backdrop ไม่ปิด) ต้องกด "เพิ่ม" หรือ "ปิด" เท่านั้นถึงจะดำเนินการต่อได้
// กด "เพิ่ม" จะสร้างแถวสินค้าใหม่แยกต่างหาก ไม่ merge จำนวน/ราคาเข้าแถวเดิม
// รองรับหลายกลุ่ม (groups) พร้อมกันในหน้าต่างเดียว — ใช้ตอนโหลดรายการจากใบเสนอราคาที่มีหลายรายการต้นทาง
// ที่ต่างก็มีสินค้าคู่กันของตัวเอง ถ้ามีกลุ่มเดียวจะแสดงแบบเดิมทุกประการ
export function RelatedProductPromptDialog({
  isOpen,
  groups,
  onAdd,
  onClose,
}: RelatedProductPromptDialogProps) {
  const [addedIds, setAddedIds] = useState<number[]>([]);

  const handleAdd = (product: RelatedProduct) => {
    onAdd(product);
    setAddedIds((prev) => [...prev, product.id]);
  };

  const handleClose = () => {
    setAddedIds([]);
    onClose();
  };

  const showGroupLabels = groups.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-3xl rounded-3xl p-6 bg-card border-0 shadow-2xl [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center border-[6px] border-amber-100/50">
            <Link2 className="w-8 h-8" />
          </div>
          <DialogTitle className="text-md font-bold text-foreground tracking-tight">
            สินค้านี้มักใช้คู่กับ
          </DialogTitle>
          {!showGroupLabels && groups[0] && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              <span className="font-bold text-foreground">
                {groups[0].sourceProductName}
              </span>{" "}
              มีสินค้าที่มักใช้งานร่วมกัน ต้องการเพิ่มเข้ารายการด้วยหรือไม่?
            </p>
          )}
          {showGroupLabels && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              มีรายการที่มีสินค้าที่มักใช้งานร่วมกัน
              ต้องการเพิ่มเข้ารายการด้วยหรือไม่?
            </p>
          )}
        </div>

        <div className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={gi} className="space-y-2">
              {showGroupLabels && (
                <div className="text-xs font-bold text-foreground">
                  รายการที่ต้องใช้คู่กับ{" "}
                  <span className="text-blue-600">
                    {group.sourceProductName}
                  </span>
                </div>
              )}
              {group.products.map((rp) => {
                const added = addedIds.includes(rp.id);
                return (
                  <div
                    key={rp.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PackagePlus className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">
                          {rp.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {rp.sku}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => handleAdd(rp)}
                      className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                        added
                          ? "bg-green-50 text-green-600 cursor-default"
                          : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                      }`}
                    >
                      {added ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> เพิ่มแล้ว
                        </>
                      ) : (
                        "เพิ่ม"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-4 mt-2 border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            className="h-10 px-5 py-2 w-full md:w-auto rounded-full font-medium text-foreground bg-background border border-border hover:bg-muted flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            ข้าม / ปิด
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
