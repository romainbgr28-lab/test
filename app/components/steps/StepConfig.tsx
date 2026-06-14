"use client";

import * as React from "react";
import { Sparkles, Loader2, Lightbulb, TrendingUp } from "lucide-react";
import type { Language, MistralModel, NicheProfile, Platform, VideoIdea } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
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
  sourceContent: string;
  profile: NicheProfile | null;
  platform: Platform;
  duration: number;
  language: Language;
  mistralModel: MistralModel;
  mistralApiKey: string;
  pollinationsApiKey: string;
  leonardoApiKey: string;
  googleTtsKey: string;
}

type ApiKeyField = "mistralApiKey" | "leonardoApiKey";

const API_KEYS_STORAGE_KEY = "studioai:apiKeys";

interface StepConfigProps {
  state: StepConfigState;
  onChange: (patch: Partial<StepConfigState>) => void;
  onGenerate: () => void;
  generating: boolean;
}

export function StepConfig({ state, onChange, onGenerate, generating }: StepConfigProps) {
  const [ideas, setIdeas] = React.useState<VideoIdea[]>([]);
  const [findingIdeas, setFindingIdeas] = React.useState(false);
  const [ideasError, setIdeasError] = React.useState<string | null>(null);

  async function handleFindIdeas() {
    if (!state.profile) return;
    setFindingIdeas(true);
    setIdeasError(null);
    try {
      const response = await fetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: state.profile.scriptInstructions,
          platform: state.platform,
          language: state.language,
          model: state.mistralModel,
          apiKey: state.mistralApiKey || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Erreur lors de la recherche d'idées.");
      setIdeas(data.ideas as VideoIdea[]);
    } catch (error) {
      setIdeasError(error instanceof Error ? error.message : "Erreur inconnue");
    } finally {
      setFindingIdeas(false);
    }
  }

  function handlePickIdea(idea: VideoIdea) {
    onChange({ subject: `${idea.title}\nAngle : ${idea.angle}` });
    setIdeas([]);
  }
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Pick<StepConfigState, ApiKeyField>>;
      onChange(saved);
    } catch {
      // clé localStorage absente ou invalide, on ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateApiKey(patch: Partial<Pick<StepConfigState, ApiKeyField>>) {
    onChange(patch);
    try {
      const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify({ ...saved, ...patch }));
    } catch {
      // stockage indisponible, on ignore
    }
  }

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-foreground">Sujet ou idée de vidéo</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFindIdeas}
              disabled={!state.profile || findingIdeas}
              title={!state.profile ? "Sélectionne d'abord un profil de niche" : undefined}
            >
              {findingIdeas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
              {findingIdeas ? "Recherche des tendances..." : "Trouver des idées virales (recherche web)"}
            </Button>
          </div>
          <Textarea
            value={state.subject}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="Ex: Les 3 erreurs qui ruinent ton épargne"
            className="min-h-[90px]"
          />
          {ideasError && <p className="text-xs text-red-400">{ideasError}</p>}
          {ideas.length > 0 && (
            <div className="mt-1 flex flex-col gap-2 rounded-md border border-border bg-secondary/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Idées tendances dans ta niche — clique pour choisir
              </p>
              {ideas.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePickIdea(idea)}
                  className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/60"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{idea.title}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-700/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                      <TrendingUp className="h-3 w-3" />
                      {idea.trendScore}
                    </span>
                  </span>
                  {idea.hook && <span className="text-xs text-foreground/80">Hook : « {idea.hook} »</span>}
                  {idea.monetizationPotential && (
                    <span className="text-xs text-muted-foreground">💰 {idea.monetizationPotential}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Contenu source / recherche (optionnel)
          </label>
          <Textarea
            value={state.sourceContent}
            onChange={(e) => onChange({ sourceContent: e.target.value })}
            placeholder="Colle ici tes propres informations, chiffres, faits, article ou notes. L'IA s'en servira comme source prioritaire et n'inventera rien. Si tu laisses vide, l'IA fait elle-même une recherche web sur le sujet."
            className="min-h-[110px]"
          />
          <p className="text-xs text-muted-foreground">
            Fournis ton propre contenu pour que le script soit calé précisément dessus. Sinon, l&apos;IA effectue une
            vraie recherche web sur le sujet avant de rédiger.
          </p>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Clé API Mistral</label>
            <Input
              type="password"
              value={state.mistralApiKey}
              onChange={(e) => updateApiKey({ mistralApiKey: e.target.value })}
              placeholder="Laisse vide pour utiliser la clé du serveur"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Clé API Leonardo</label>
            <Input
              type="password"
              value={state.leonardoApiKey}
              onChange={(e) => updateApiKey({ leonardoApiKey: e.target.value })}
              placeholder="Laisse vide pour utiliser la clé du serveur"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Nécessaire pour générer des images avec les modèles Leonardo (Phoenix, FLUX, Nano Banana, etc.). Crée une
              clé sur{" "}
              <a href="https://app.leonardo.ai" target="_blank" rel="noreferrer" className="underline">
                app.leonardo.ai
              </a>
              .
            </p>
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Ces clés ne sont jamais enregistrées : elles sont utilisées uniquement pour tes appels et restent dans ton navigateur.
        </p>
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
