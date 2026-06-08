"use client";

import { Select, type SelectOption } from "./Select";
import { CostBadge } from "./CostBadge";

interface ModelSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  costLabel?: string;
}

export function ModelSelector({ label, value, onChange, options, costLabel }: ModelSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {costLabel && <CostBadge label={costLabel} />}
      </div>
      <Select value={value} onChange={onChange} options={options} />
    </div>
  );
}
