"use client";

import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { Language, MistralModel, NicheProfile, Platform } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { ProfileManager } from "../ui/ProfileManager";
import { ModelSelector } from "../ui/ModelSelector";
import { Button } from "../ui/Button";
import { MISTRAL_COSTS } from "@/lib/cost-calculator";

const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "youtube", label: "YouTube" },
  { value: "reels", label: "Instagram Reels" },
];

const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
];

const DURATION_OPTIONS = [
  { value: "30", label: "30 secondes" },
  { value: "60", label: "60 secondes" },
  { value: "90", label: "90 secondes" },
  { value: "180", label: "3 minutes" },
  { value: "300", label: "5 minutes" },
  { value: "600", label: "10 minutes" },
];

const MISTRAL_OPTIONS = (Object.keys(MISTRAL_COSTS) as MistralModel[]).map((key) => ({
  value: key,
  label: key,
  description: MISTRAL_COSTS[key].label,
}));

export interface StepConfigState {
  subject: string;
  profile: NicheProfile | null;
  platform: Platform;
  duration: number;
  language: Language;
  mistralModel: MistralModel;
}

interface StepConfigProps {
  state: StepConfigState;
  onChange: (patch: Partial<StepConfigState>) => void;
  onGenerate: () => void;
  generating: boolean;
}

export function StepConfig({ state, onChange, onGenerate, generating }: StepConfigProps) {
  function handleProfileSelect(profile: NicheProfile) {
    onChange({ profile, platform: profile.platform, language: profile.language });
  }

  const canGenerate = state.subject.trim().length > 3 && !!state.profile && !generating;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 1 — Configuration</CardTitle>
        <CardDescription>Définis le sujet de ta vidéo et choisis le profil de niche à appliquer.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Sujet ou idée de vidéo</label>
          <Textarea
            value={state.subject}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="Ex: Les 3 erreurs qui ruinent ton épargne"
            className="min-h-[90px]"
          />
        </div>

        <ProfileManager selectedId={state.profile?.id ?? null} onSelect={handleProfileSelect} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Plateforme</label>
            <Select
              value={state.platform}
              onChange={(v) => onChange({ platform: v as Platform })}
              options={PLATFORM_OPTIONS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Durée cible</label>
            <Select
              value={String(state.duration)}
              onChange={(v) => onChange({ duration: Number(v) })}
              options={DURATION_OPTIONS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Langue</label>
            <Select
              value={state.language}
              onChange={(v) => onChange({ language: v as Language })}
              options={LANGUAGE_OPTIONS}
            />
          </div>
        </div>

        <ModelSelector
          label="Modèle de génération de script (Mistral)"
          value={state.mistralModel}
          onChange={(v) => onChange({ mistralModel: v as MistralModel })}
          options={MISTRAL_OPTIONS}
        />
      </CardContent>
      <CardFooter>
        <Button onClick={onGenerate} disabled={!canGenerate} size="lg" className="w-full sm:w-auto">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Générer le script
        </Button>
      </CardFooter>
    </Card>
  );
}
