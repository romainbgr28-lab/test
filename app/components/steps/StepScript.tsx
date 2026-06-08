"use client";

import * as React from "react";
import { CheckCircle2, Lightbulb, Loader2, TrendingUp } from "lucide-react";
import type { ViralityScore, VideoSegment } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { SegmentCard } from "../ui/SegmentCard";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "@/lib/utils";

interface StepScriptProps {
  loading: boolean;
  viralityScore: ViralityScore | null;
  segments: VideoSegment[];
  onSegmentChange: (id: string, patch: Partial<VideoSegment>) => void;
  onRegenerateSegment: (id: string) => void;
  regeneratingSegmentId: string | null;
  onValidate: () => void;
  validated: boolean;
}

function scoreColor(score: number): string {
  if (score < 50) return "text-red-400 border-red-700/40 bg-red-500/10";
  if (score <= 75) return "text-orange-400 border-orange-700/40 bg-orange-500/10";
  return "text-emerald-400 border-emerald-700/40 bg-emerald-500/10";
}

export function StepScript({
  loading,
  viralityScore,
  segments,
  onSegmentChange,
  onRegenerateSegment,
  regeneratingSegmentId,
  onValidate,
  validated,
}: StepScriptProps) {
  const totalDuration = segments.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Étape 2 — Script</CardTitle>
          <CardDescription>Génération du script en cours, l'IA analyse les patterns viraux...</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
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
