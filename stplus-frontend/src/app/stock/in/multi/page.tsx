"use client";
import React, { useState } from "react";
import { PackagePlus, Plus, Trash2, Save, Search, ScanLine, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export default function MultiStockInPage() {
  const [items, setItems] = useState([{ id: 1, productId: "", qty: 1, serials: [""] }]);

  const addRow = () => setItems([...items, { id: Date.now(), productId: "", qty: 1, serials: [""] }]);
  
  const removeRow = (id: number) => {
    if (items.length > 1) setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        if (field === 'qty') {
          const newSerials = Array.from({ length: value }, (_, i) => item.serials[i] || "");
          return { ...item, qty: value, serials: newSerials };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  return (
    <div className="w-full max-w-full px-4 md:px-4 py-6 overflow-x-hidden">
      {/* Header - สะอาดตา */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30">
            <PackagePlus className="w-6 h-6 text-green-600" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">รับเข้าสินค้าหลายรายการ</h1>
            <p className="text-xs text-slate-400 mt-0.5 italic">* บันทึกแบบชุด จัดการ Serial แยกรายการ</p>
          </div>
        </div>
        <Button className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold px-8 rounded-xl shadow-lg shadow-blue-600/20">
          <Save className="w-4 h-4" /> บันทึกเข้าคลัง
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30">
            <TableRow className="border-slate-200 dark:border-slate-800">
              <TableHead className="font-bold text-sm">ชื่อสินค้า / SKU</TableHead>
              <TableHead className="w-[120px] text-center font-bold text-sm">จำนวน</TableHead>
              <TableHead className="w-[180px] text-center font-bold text-sm">Serial Numbers</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="border-border hover:bg-slate-50/30 transition-colors">
                <TableCell className="py-5">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" strokeWidth={1.5} />
                    <Input placeholder="ค้นหาชื่อสินค้า..." className="pl-9 h-10 border-slate-200 dark:border-slate-800 cursor-pointer" />
                  </div>
                </TableCell>
                <TableCell className="py-5">
                  <Input 
                    type="number" 
                    min={1} 
                    value={item.qty} 
                    onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                    className="text-center font-bold h-10 border-slate-200 dark:border-slate-800" 
                  />
                </TableCell>
                <TableCell className="py-5 text-center">
                  {/* 💡 ย้าย Logic มาไว้ใน Dialog แทน เพื่อความลื่น */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="cursor-pointer gap-2 border-slate-200 dark:border-slate-800 text-xs font-bold">
                        <ScanLine className="w-3.5 h-3.5" strokeWidth={1.5} />
                        ระบุ ({item.serials.filter(s => s !== "").length}/{item.qty})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl dark:bg-slate-900">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <ListOrdered className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
                          จัดการ Serial Number (จำนวน {item.qty} ชิ้น)
                        </DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-3 py-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {item.serials.map((sn, idx) => (
                          <div key={idx} className="space-y-1">
                            <span className="text-[10px] text-slate-400 ml-1">ลำดับที่ {idx + 1}</span>
                            <Input 
                              placeholder={`S/N ${idx + 1}`} 
                              value={sn}
                              onChange={(e) => {
                                const newSerials = [...item.serials];
                                newSerials[idx] = e.target.value;
                                updateItem(item.id, 'serials', newSerials);
                              }}
                              className="h-9 text-xs border-slate-200 dark:border-slate-800"
                            />
                          </div>
                        ))}
                      </div>
                      <DialogFooter>
                        <Button className="w-full bg-blue-600 font-bold cursor-pointer">ตกลง</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <Button variant="ghost" size="icon" onClick={() => removeRow(item.id)} className="text-slate-300 hover:text-red-500 cursor-pointer transition-colors">
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="p-6 bg-slate-50/30 dark:bg-slate-900/10 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={addRow} className="w-full py-8 border-dashed border-2 text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all cursor-pointer rounded-xl font-bold gap-2">
            <Plus className="w-4 h-4" /> เพิ่มรายการสินค้าใหม่
          </Button>
        </div>
      </div>
    </div>
  );
}