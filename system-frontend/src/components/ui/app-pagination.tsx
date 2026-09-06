"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface AppPaginationProps {
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

// 🔢 มาตรฐาน pagination กลางของทั้งโปรเจกต์ — สไตล์ปุ่มจาก sales/quotations (ปุ่มรอง section 2 ของ
// .claude/docs/frontend-page-template.md) + ตำแหน่ง/ข้อความสรุปจำนวน + disabled logic จาก stock-movements
// ใช้ onPageChange callback เดียว รองรับทั้งหน้าที่เก็บเลขหน้าไว้ใน useState (ธรรมดา) และหน้าที่เก็บไว้ใน
// URL query (ผ่าน router.push ภายใน callback) โดยไม่ต้องรู้ความแตกต่างกันเลย
export function AppPagination({
  currentPage,
  lastPage,
  total,
  perPage,
  onPageChange,
}: AppPaginationProps) {
  if (!total || total <= 0) return null;

  const from = (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);
  const btnClass =
    "flex justify-center h-10 px-5 py-2 gap-2 text-sm font-medium items-center text-slate-700 bg-white " +
    "hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer " +
    "transition-all hover:scale-102 transition-transform disabled:opacity-50 disabled:cursor-not-allowed " +
    "disabled:pointer-events-none disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:scale-100";

  return (
    <div className="flex justify-between items-center mt-6">
      <div className="text-sm text-slate-500 font-medium">
        แสดง {from} ถึง {to} จาก {total} รายการ
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          className={btnClass}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={currentPage >= lastPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          ถัดไป <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
