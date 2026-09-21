"use client";

import { useState } from "react";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export interface CompanyOption {
  id: number;
  name: string;
  logo: string | null;
}

interface CompanySelectDialogProps {
  open: boolean;
  companies: CompanyOption[];
  onSelect: (companyId: number) => Promise<void>;
}

// Popup บังคับเลือกบริษัทหลัง login เมื่อ user มีสิทธิ์เข้าได้มากกว่า 1 บริษัทและยังไม่เคยเลือกไว้
// ไม่มีปุ่มปิด/กด ESC ปิดไม่ได้ — ต้องเลือกก่อนถึงจะใช้งานต่อได้
export function CompanySelectDialog({ open, companies, onSelect }: CompanySelectDialogProps) {
  const [selectingId, setSelectingId] = useState<number | null>(null);

  const handleSelect = async (companyId: number) => {
    if (selectingId) return;
    setSelectingId(companyId);
    try {
      await onSelect(companyId);
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="mx-auto mb-2 p-3 bg-blue-50 text-blue-600 rounded-full w-fit">
            <Building2 className="w-6 h-6" />
          </div>
          <DialogTitle className="text-center">เลือกบริษัทที่จะเข้าใช้งาน</DialogTitle>
          <DialogDescription className="text-center">
            บัญชีนี้มีสิทธิ์เข้าใช้งานได้มากกว่า 1 บริษัท กรุณาเลือกบริษัทที่ต้องการเข้าทำงาน
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto -mx-1 px-1">
          {companies.map((company) => {
            const isSelecting = selectingId === company.id;
            return (
              <button
                key={company.id}
                type="button"
                disabled={selectingId !== null}
                onClick={() => handleSelect(company.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-blue-300 hover:bg-blue-50 text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 overflow-hidden">
                  {company.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={company.logo} alt={company.name} className="w-full h-full object-cover bg-background" />
                  ) : (
                    <span className="text-white font-black text-xs">
                      {company.name.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="flex-1 text-sm font-bold text-foreground truncate">{company.name}</span>
                {isSelecting ? (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
