"use client";

import React from "react";
import { Check } from "lucide-react";

export interface StepItem {
  key: string;
  label: string;
  done: boolean;
}

interface StageStepperProps {
  steps: StepItem[];
}

// 🪜 แถบสถานะเอกสารในโครงการ/งานเช่า — วงกลมแทนเอกสารแต่ละประเภท (ตรงกับการ์ดเอกสารด้านล่างทุกใบ)
// เปลี่ยนสีเขียว/เครื่องหมายถูกอัตโนมัติทันทีที่มีเอกสารประเภทนั้นถูกสร้างแล้ว (auto-detect จาก count จริง
// ไม่ใช่ค่า stage ที่ตั้งเองในหน้าแก้ไขอีกต่อไป — ฟิลด์ stage เดิมยังเก็บไว้ใช้งานอย่างอื่นได้ แค่ไม่ขับเคลื่อน UI นี้แล้ว)
export function StageStepper({ steps }: StageStepperProps) {
  return (
    <div className="flex items-center">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center gap-1 min-w-[64px]">
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                step.done
                  ? "bg-green-500 border-green-500 text-white"
                  : "bg-slate-100 border-slate-200 text-slate-400"
              }`}
            >
              {step.done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
            </div>
            <span
              className={`text-[10px] text-center whitespace-nowrap ${
                step.done ? "text-green-700 font-medium" : "text-slate-400"
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`w-6 md:w-8 h-0.5 mb-4 shrink-0 ${
                step.done ? "bg-green-300" : "bg-slate-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
