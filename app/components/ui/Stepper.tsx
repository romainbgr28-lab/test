import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepDefinition {
  index: number;
  title: string;
}

interface StepperProps {
  steps: StepDefinition[];
  current: number;
  unlocked: number;
  onSelect?: (index: number) => void;
}

export function Stepper({ steps, current, unlocked, onSelect }: StepperProps) {
  const progressPct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;
  return (
    <div className="relative flex items-center justify-between">
      {/* Progress track */}
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-border mx-[1.75rem]" />
      <div
        className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-primary/60 mx-[1.75rem] transition-all duration-500"
        style={{ width: `calc(${progressPct}% - 3.5rem + ${progressPct / 100} * 3.5rem)` }}
      />

      {steps.map((step) => {
        const isActive = step.index === current;
        const isDone = step.index < current;
        const isClickable = step.index <= unlocked && !!onSelect;

        return (
          <button
            key={step.index}
            type="button"
            disabled={!isClickable}
            onClick={() => isClickable && onSelect?.(step.index)}
            className={cn(
              "relative z-10 flex flex-col items-center gap-1.5",
              isClickable && !isActive ? "cursor-pointer" : !isClickable ? "cursor-not-allowed" : ""
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-200",
                isActive
                  ? "border-primary bg-primary text-white glow-primary-sm scale-110"
                  : isDone
                  ? "border-emerald-500 bg-emerald-500 text-black"
                  : isClickable
                  ? "border-border bg-card text-muted-foreground hover:border-primary/50"
                  : "border-border bg-card text-muted-foreground opacity-40"
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step.index + 1}
            </span>
            <span
              className={cn(
                "hidden text-[11px] font-medium sm:block transition-colors",
                isActive ? "text-primary" : isDone ? "text-emerald-400" : isClickable ? "text-muted-foreground" : "text-muted-foreground/40"
              )}
            >
              {step.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
