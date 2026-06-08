import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

interface CostBadgeProps {
  label: string;
  className?: string;
}

export function CostBadge({ label, className }: CostBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-violet-700/40 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-300",
        className
      )}
    >
      <Coins className="h-3 w-3" />
      {label}
    </span>
  );
}
