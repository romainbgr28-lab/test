import type { NicheProfile } from "@/types";
import { uid } from "./utils";

const STORAGE_KEY = "studioai_profiles";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getProfiles(): NicheProfile[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (NicheProfile & { instructions?: string })[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => ({
      ...p,
      scriptInstructions: p.scriptInstructions ?? p.instructions ?? "",
      viralityInstructions: p.viralityInstructions ?? "",
    }));
  } catch {
    return [];
  }
}

export function saveProfile(profile: Omit<NicheProfile, "id" | "createdAt">): NicheProfile {
  const profiles = getProfiles();
  const newProfile: NicheProfile = {
    ...profile,
    id: uid(),
    createdAt: new Date().toISOString(),
  };
  const updated = [...profiles, newProfile];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newProfile;
}

export function deleteProfile(id: string): NicheProfile[] {
  const updated = getProfiles().filter((p) => p.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function updateProfile(id: string, patch: Partial<NicheProfile>): NicheProfile[] {
  const updated = getProfiles().map((p) => (p.id === id ? { ...p, ...patch } : p));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
