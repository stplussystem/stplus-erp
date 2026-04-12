"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ListOrdered } from "lucide-react";

export const SerialManager = ({ isOpen, onOpenChange, qty, serials, onSerialChange }: any) => (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl dark:bg-slate-900">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ListOrdered className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
          ระบุ Serial Number ({qty} รายการ)
        </DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3 py-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {serials.map((sn: string, idx: number) => (
          <div key={idx} className="space-y-1">
            <span className="text-[10px] text-slate-400 ml-1 font-medium">S/N ลำดับที่ {idx + 1}</span>
            <Input 
              placeholder={`ระบุ S/N...`} 
              value={sn}
              onChange={(e) => onSerialChange(idx, e.target.value)}
              className="h-10 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
            />
          </div>
        ))}
      </div>
      <DialogFooter>
        {/* 💡 ปรับปุ่มให้เป็น rounded-full ตรงนี้ครับ */}
        <Button onClick={() => onOpenChange(false)} className="w-full rounded-full bg-blue-600 hover:bg-blue-700 font-bold cursor-pointer transition-all">
          ตกลง
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);