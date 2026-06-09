"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Lightbulb, Loader2, Search, TrendingUp, Zap } from "lucide-react";
import type { HookVariant, ViralityScore, VideoSegment } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { SegmentCard } from "../ui/SegmentCard";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "@/lib/utils";

interface StepScriptProps {
  loading: boolean;
  progress?: { message: string; score?: number }[];
  viralityScore: ViralityScore | null;
  segments: VideoSegment[];
  onSegmentChange: (id: string, patch: Partial<VideoSegment>) => void;
  onRegenerateSegment: (id: string) => void;
  regeneratingSegmentId: string | null;
  onValidate: () => void;
  validated: boolean;
  sources?: string[];
  targetDuration: number;
  hookVariants: HookVariant[];
  generatingHooks: boolean;
  onGenerateHooks: () => void;
  onApplyHook: (narration: string) => void;
}

function scoreColor(score: number): string {
  if (score < 50) return "text-red-400 border-red-700/40 bg-red-500/10";
  if (score <= 75) return "text-orange-400 border-orange-700/40 bg-orange-500/10";
  return "text-emerald-400 border-emerald-700/40 bg-emerald-500/10";
}

function ElapsedTimer({ active }: { active: boolean }) {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [active]);

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const formatted = minutes > 0 ? `${minutes} min ${rest.toString().padStart(2, "0")} s` : `${seconds} s`;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      En cours depuis {formatted}
    </span>
  );
}

const THINKING_PHRASES = [
  "L'IA réfléchit",
  "Analyse des tendances",
  "Recherche d'angles viraux",
  "Vérification des informations",
  "Optimisation du script",
];

function ThinkingIndicator({ active }: { active: boolean }) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setIndex((i) => (i + 1) % THINKING_PHRASES.length), 2200);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
      {THINKING_PHRASES[index]}
      <span className="inline-flex w-5 justify-start">
        <span className="animate-pulse">...</span>
      </span>
    </span>
  );
}

function LiveProgressLog({ entries, loading }: { entries: { message: string; score?: number }[]; loading: boolean }) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          L'IA travaille en direct
        </div>
        <ElapsedTimer active={loading} />
      </div>
      <ThinkingIndicator active={loading} />
      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
        {entries.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Connexion à l'IA...
          </p>
        )}
        {entries.map((entry, i) => {
          const isLast = i === entries.length - 1;
          const isSearch = /recherch/i.test(entry.message);
          return (
            <p
              key={i}
              className={cn(
                "flex items-start gap-2 text-sm transition-opacity",
                isLast ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {isLast ? (
                <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              ) : isSearch ? (
                <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/80" />
              )}
              <span>
                {entry.message}
                {typeof entry.score === "number" && (
                  <span
                    className={cn(
                      "ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                      scoreColor(entry.score)
                    )}
                  >
                    {entry.score}/100
                  </span>
                )}
              </span>
            </p>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}

export function StepScript({
  loading,
  progress = [],
  viralityScore,
  segments,
  onSegmentChange,
  onRegenerateSegment,
  regeneratingSegmentId,
  onValidate,
  validated,
  sources = [],
  targetDuration,
  hookVariants,
  generatingHooks,
  onGenerateHooks,
  onApplyHook,
}: StepScriptProps) {
  const totalDuration = segments.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Étape 2 — Script</CardTitle>
          <CardDescription>
            L'IA recherche des informations sur internet et retravaille le script jusqu'à viser un score de viralité de 100/100...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LiveProgressLog entries={progress} loading={loading} />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!viralityScore && segments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Étape 2 — Script</CardTitle>
          <CardDescription>Génère d'abord un script depuis l'étape 1.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 2 — Script</CardTitle>
        <CardDescription>
          Relis et ajuste chaque segment, puis valide le script pour passer à la génération des assets.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {viralityScore && (
          <Card className="border-border/80 bg-secondary/30">
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold",
                    scoreColor(viralityScore.score)
                  )}
                >
                  <TrendingUp className="h-4 w-4" />
                  Score de viralité : {viralityScore.score}/100
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hook</p>
                  <p className="mt-1 text-sm">{viralityScore.hookStrength}</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Risque de décrochage
                  </p>
                  <p className="mt-1 text-sm">{viralityScore.retentionRisk}</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clarté du CTA</p>
                  <p className="mt-1 text-sm">{viralityScore.ctaClarity}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Suggestions d'amélioration
                </p>
                <ul className="flex flex-col gap-1.5">
                  {viralityScore.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {sources.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary/20 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              Sources web utilisées pour le script ({sources.length})
            </p>
            <ul className="flex flex-col gap-1">
              {sources.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 truncate text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{url}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Garde-fou durée : YouTube Shorts coupe à 60s, TikTok pénalise les vidéos non finies */}
        {targetDuration > 0 && Math.abs(totalDuration - targetDuration) > targetDuration * 0.1 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-700/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Le script fait {totalDuration}s pour une cible de {targetDuration}s.
              {totalDuration > targetDuration
                ? " Au-delà de 60s, YouTube Shorts coupe la vidéo et la rétention chute : raccourcis ou régénère des segments."
                : " Trop court : ajoute du contenu pour exploiter toute la durée monétisable."}
            </span>
          </div>
        )}

        {/* A/B testing du hook : les 3 premières secondes décident de la rétention */}
        <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              Hook (3 premières secondes) — teste des variantes
            </p>
            <Button variant="outline" size="sm" onClick={onGenerateHooks} disabled={generatingHooks || segments.length === 0}>
              {generatingHooks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Générer 3 hooks alternatifs
            </Button>
          </div>
          {hookVariants.length > 0 && (
            <div className="flex flex-col gap-2">
              {hookVariants.map((variant, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onApplyHook(variant.narration)}
                  className="flex flex-col gap-0.5 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/60"
                >
                  <span className="text-sm">« {variant.narration} »</span>
                  {variant.style && <span className="text-xs text-muted-foreground">Mécanique : {variant.style}</span>}
                </button>
              ))}
              <p className="text-xs text-muted-foreground">Clique sur une variante pour remplacer le hook du segment 1.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Segments du script</h3>
          <span className="text-sm text-muted-foreground">Durée totale : {totalDuration}s</span>
        </div>

        <div className="flex flex-col gap-4">
          {segments.map((segment) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              onChange={(patch) => onSegmentChange(segment.id, patch)}
              onRegenerate={() => onRegenerateSegment(segment.id)}
              regenerating={regeneratingSegmentId === segment.id}
            />
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onValidate} size="lg" disabled={segments.length === 0}>
          {validated ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="hidden h-4 w-4 animate-spin" />}
          Valider le script
        </Button>
      </CardFooter>
    </Card>
  );
}
