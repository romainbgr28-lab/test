"use client";

import * as React from "react";
import { Download, FileArchive, Loader2, Megaphone, Clock, ListVideo } from "lucide-react";
import type { MistralModel, VideoProject, PublishMetadata } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { estimateCost, formatEur } from "@/lib/cost-calculator";

interface StepExportProps {
  project: VideoProject | null;
  onExport: () => Promise<void>;
  exporting: boolean;
  publishMetadata?: PublishMetadata;
  onGenerateMetadata: () => Promise<void>;
  generatingMetadata: boolean;
}

export function StepExport({ project, onExport, exporting, publishMetadata, onGenerateMetadata, generatingMetadata }: StepExportProps) {
  if (!project) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Étape 6 — Export</CardTitle>
          <CardDescription>Termine d'abord les étapes précédentes pour générer ton export.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalDuration = project.segments.reduce((sum, s) => sum + s.duration, 0);
  const cost = estimateCost({
    mistralModel: project.mistralModel as MistralModel,
    imageModel: project.imageModel,
    segmentCount: project.segments.length,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 6 — Export</CardTitle>
        <CardDescription>Télécharge un ZIP complet prêt pour le montage.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-secondary/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Segments</p>
            <p className="mt-1 text-2xl font-semibold">{project.segments.length}</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Durée totale</p>
            <p className="mt-1 text-2xl font-semibold">{totalDuration.toFixed(1)}s</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coût estimé</p>
            <p className="mt-1 text-2xl font-semibold">{formatEur(cost.scriptEur)}</p>
          </div>
        </div>

        {/* Pack de publication : titre, description, légende, hashtags, créneau, série */}
        <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Megaphone className="h-4 w-4" />
              Pack de publication (monétisation)
            </p>
            <Button variant="outline" size="sm" onClick={onGenerateMetadata} disabled={generatingMetadata}>
              {generatingMetadata ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
              {publishMetadata ? "Régénérer le pack" : "Générer le pack"}
            </Button>
          </div>
          {!publishMetadata && (
            <p className="text-sm text-muted-foreground">
              Titre YouTube optimisé, description SEO, légende TikTok, hashtags étagés, meilleur créneau de publication
              et 3 idées de suite pour construire une série.
            </p>
          )}
          {publishMetadata && (
            <div className="flex flex-col gap-3 text-sm">
              {publishMetadata.title && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Titre YouTube ({publishMetadata.title.length}/100)</p>
                  <p className="mt-0.5 font-medium">{publishMetadata.title}</p>
                </div>
              )}
              {publishMetadata.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description YouTube</p>
                  <p className="mt-0.5 whitespace-pre-line text-foreground/90">{publishMetadata.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Légende TikTok / Reels</p>
                <p className="mt-0.5 text-foreground/90">{publishMetadata.caption}</p>
              </div>
              {publishMetadata.hashtags.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hashtags</p>
                  <p className="mt-0.5 break-words text-primary">{publishMetadata.hashtags.map((h) => `#${h}`).join(" ")}</p>
                </div>
              )}
              {publishMetadata.bestPostTime && (
                <p className="flex items-center gap-1.5 text-foreground/90">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Meilleur créneau : <span className="font-medium">{publishMetadata.bestPostTime}</span>
                </p>
              )}
              {publishMetadata.nextVideoIdeas && publishMetadata.nextVideoIdeas.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <ListVideo className="h-3.5 w-3.5" />
                    Prochaines vidéos de la série
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-foreground/90">
                    {publishMetadata.nextVideoIdeas.map((idea, i) => (
                      <li key={i}>{idea}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <FileArchive className="h-4 w-4" />
            Le ZIP contiendra :
          </p>
          <ul className="mt-2 flex flex-col gap-1 pl-6 list-disc">
            <li>script_complet.txt — script avec timing cumulé</li>
            <li>image_01.png ... image_{String(project.segments.length).padStart(2, "0")}.png</li>
            <li>voiceover.mp3 — voix off complète</li>
            <li>subtitles.srt + subtitles_capcut.txt — sous-titres (version éditée dans la timeline)</li>
            <li>sync_report.txt — rapport de synchronisation détaillé (timings, débit, écart audio)</li>
            {project.researchSources && project.researchSources.length > 0 && (
              <li>sources_recherche.txt — sources web utilisées pour le script</li>
            )}
            <li>guide_montage_capcut.txt — guide de montage généré par l&apos;IA</li>
            {project.publishMetadata && <li>pack_publication.txt — titre, description, légende, hashtags, créneau, série</li>}
            <li>metadata.json — paramètres complets du projet</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onExport} disabled={exporting} size="lg">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Télécharger le ZIP
        </Button>
      </CardFooter>
    </Card>
  );
}
