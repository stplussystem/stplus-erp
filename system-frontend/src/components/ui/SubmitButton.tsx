import { ReactNode } from "react";
import { Button } from "@/components/ui/button"; // หรือพาธที่พี่เก็บปุ่มหลักไว้
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ประกาศตัวแปร (Props) ที่เราจะยอมให้เปลี่ยนได้
interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  text: string;
  loadingText?: string;
  icon?: ReactNode;
  colorClass?: string;
}

export default function SubmitButton({
  isLoading,
  text,
  loadingText = "กำลังบันทึก...", // ค่าเริ่มต้น ถ้าไม่ส่งมาจะใช้คำนี้
  icon,
  colorClass = "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20", // ค่าเริ่มต้น
  className,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      {...props} // ส่งผ่าน props อื่นๆ เช่น type="submit", onClick
      disabled={isLoading || props.disabled}
      className={cn(
        // ส่วนที่ 1: คลาสพื้นฐานที่บังคับให้เหมือนกันทุกหน้า
        "min-w-[180px] px-8 h-12 rounded-full shadow-lg cursor-pointer transition-all text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50",
        // ส่วนที่ 2: สีที่เราส่งเข้ามา
        colorClass,
        // ส่วนที่ 3: เผื่อมีการเติมคลาสพิเศษจากหน้าอื่นๆ
        className
      )}
    >
      {/* จัดการไอคอน */}
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      
      {/* จัดการข้อความ */}
      {isLoading ? loadingText : text}
    </Button>
  );
}