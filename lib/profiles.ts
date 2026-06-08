import type { NicheProfile } from "@/types";
import { uid } from "./utils";

const STORAGE_KEY = "studioai_profiles";

const DEFAULT_PROFILES: NicheProfile[] = [
  {
    id: "default-finance-fr",
    name: "Finance FR",
    instructions:
      "Conseils pratiques et accessibles sur l'épargne, l'investissement et la gestion du budget pour un public français de 20-35 ans. Ton direct, exemples concrets, chiffres percutants.",
    platform: "tiktok",
    language: "fr",
    createdAt: new Date(2024, 0, 1).toISOString(),
  },
  {
    id: "default-motivation-en",
    name: "Motivation EN",
    instructions:
      "High-energy motivational content about discipline, mindset and personal growth for a young English-speaking audience. Punchy phrases, powerful imagery, strong calls to action.",
    platform: "youtube_shorts",
    language: "en",
    createdAt: new Date(2024, 0, 1).toISOString(),
  },
  {
    id: "default-immobilier-fr",
    name: "Immobilier FR",
    instructions:
      "Astuces et analyses sur l'investissement immobilier locatif en France, fiscalité, négociation et rentabilité. Ton expert mais accessible, storytelling avec des cas concrets.",
    platform: "reels",
    language: "fr",
    createdAt: new Date(2024, 0, 1).toISOString(),
  },
];

function isBrowser() {
  return typeof window !== "undefined";
}

export function getProfiles(): NicheProfile[] {
  if (!isBrowser()) return DEFAULT_PROFILES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFILES));
      return DEFAULT_PROFILES;
    }
    const parsed = JSON.parse(raw) as NicheProfile[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PROFILES;
    return parsed;
  } catch {
    return DEFAULT_PROFILES;
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
