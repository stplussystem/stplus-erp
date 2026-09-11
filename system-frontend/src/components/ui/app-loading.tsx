import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AppLoadingProps = {
  text?: string;
  className?: string;
  minHeight?: string;
};

export function AppLoading({
  text = "กำลังโหลดข้อมูล...",
  className,
  minHeight = "min-h-[300px]",
}: AppLoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        minHeight,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

      <span className="text-sm font-medium">
        {text}
      </span>
    </div>
  );
}