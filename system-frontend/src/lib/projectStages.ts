// 🪜 ชุดขั้นตอนงาน (stage) ที่ใช้ร่วมกันทั้งโมดูล projects และ rental-jobs
// แยกจากฟิลด์ status เดิมโดยสิ้นเชิง — ใช้แสดง stepper ในหน้า "ดูข้อมูล" และเลือกได้ในหน้าแก้ไข
export type ProjectStage =
  | "quotation"
  | "purchasing"
  | "sales_order"
  | "delivery"
  | "installation";

export interface ProjectStageOption {
  value: ProjectStage;
  label: string;
}

export const PROJECT_STAGES: ProjectStageOption[] = [
  { value: "quotation", label: "เสนอราคา" },
  { value: "purchasing", label: "สั่งซื้อสินค้า" },
  { value: "sales_order", label: "ใบสั่งขาย" },
  { value: "delivery", label: "ส่งสินค้า" },
  { value: "installation", label: "ติดตั้ง" },
];

export function getStageLabel(stage?: string | null): string {
  return PROJECT_STAGES.find((s) => s.value === stage)?.label || "ยังไม่ระบุ";
}

export function getStageIndex(stage?: string | null): number {
  return PROJECT_STAGES.findIndex((s) => s.value === stage);
}
