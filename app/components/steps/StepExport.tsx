"use client";

import * as React from "react";
import { Download, FileArchive, Loader2 } from "lucide-react";
import type { VideoProject } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { estimateCost, formatEur } from "@/lib/cost-calculator";

interface StepExportProps {
  project: VideoProject | null;
  onExport: () => void;
  exporting: boolean;
}

export function StepExport({ project, onExport, exporting }: StepExportProps) {
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
    mistralModel: project.mistralModel as never,
    imageModel: project.imageModel as never,
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
            <p className="mt-1 text-2xl font-semibold">{totalDuration}s</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coût estimé</p>
            <p className="mt-1 text-2xl font-semibold">{formatEur(cost.scriptEur)}</p>
          </div>
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
            <li>guide_montage_capcut.txt — guide de montage généré par l&apos;IA</li>
            {project.publishMetadata && <li>legende_publication.txt — légende + hashtags</li>}
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
