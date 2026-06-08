import type { VisualStyle } from "@/types";
import { uid } from "./utils";

const STORAGE_KEY = "studioai_visual_styles";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getVisualStyles(): VisualStyle[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VisualStyle[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveVisualStyle(style: Omit<VisualStyle, "id" | "createdAt">): VisualStyle {
  const styles = getVisualStyles();
  const newStyle: VisualStyle = {
    ...style,
    id: uid(),
    createdAt: new Date().toISOString(),
  };
  const updated = [...styles, newStyle];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newStyle;
}

export function deleteVisualStyle(id: string): VisualStyle[] {
  const updated = getVisualStyles().filter((s) => s.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function updateVisualStyle(id: string, patch: Partial<VisualStyle>): VisualStyle[] {
  const updated = getVisualStyles().map((s) => (s.id === id ? { ...s, ...patch } : s));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
