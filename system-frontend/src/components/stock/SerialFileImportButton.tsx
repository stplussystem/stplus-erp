"use client";
import React, { useRef } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

// 📄 แปลงข้อความจากไฟล์ที่ยิงเก็บจากเครื่องสแกนบาร์โค้ด (1 S/N ต่อบรรทัด — รองรับคั่นด้วย , ; หรือ tab ด้วย)
// ตัดช่องว่าง/แถวว่าง และตัดตัวซ้ำโดยคงลำดับเดิมไว้
export function parseSerialText(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  text
    .replace(/^﻿/, "")
    .split(/[\r\n,;\t]+/)
    .map((s) => s.trim())
    .forEach((s) => {
      if (s && !seen.has(s)) {
        seen.add(s);
        result.push(s);
      }
    });
  return result;
}

interface SerialFileImportButtonProps {
  onParsed: (serials: string[]) => void;
  disabled?: boolean;
}

export function SerialFileImportButton({ onParsed, disabled }: SerialFileImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // เลือกไฟล์เดิมซ้ำได้อีกครั้ง
    if (!file) return;
    try {
      const serials = parseSerialText(await file.text());
      if (serials.length === 0) {
        toast.error("ไม่พบ S/N ในไฟล์");
        return;
      }
      onParsed(serials);
    } catch {
      toast.error("อ่านไฟล์ไม่สำเร็จ");
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.csv,text/plain,text/csv"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 h-9 px-4 rounded-full border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
      >
        <Upload className="w-3.5 h-3.5" /> อัปโหลดไฟล์ S/N (.txt)
      </button>
    </>
  );
}
