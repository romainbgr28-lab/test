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
  return (
    <ol className="flex w-full items-center gap-2 overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const isActive = step.index === current;
        const isDone = step.index < current;
        const isClickable = step.index <= unlocked && !!onSelect;
        return (
          <li key={step.index} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onSelect?.(step.index)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                isActive
                  ? "border-primary bg-primary/10"
                  : isDone
                  ? "border-emerald-700/40 bg-emerald-500/5"
                  : "border-border bg-card",
                isClickable && !isActive && "hover:bg-accent cursor-pointer",
                !isClickable && "opacity-50 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-emerald-500 text-black"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : step.index + 1}
              </span>
              <span className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                {step.title}
              </span>
            </button>
            {idx < steps.length - 1 && <div className="hidden h-px w-4 shrink-0 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
