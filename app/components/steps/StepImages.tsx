"use client";

import * as React from "react";
import { ImagePlus, ArrowRight, Loader2, Sparkles, RefreshCw } from "lucide-react";
import type { ImageModel, VideoSegment, VisualStyle } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { ModelSelector } from "../ui/ModelSelector";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { Skeleton } from "../ui/Skeleton";
import { VisualStyleManager } from "../ui/VisualStyleManager";

function buildImageModelOptions(leonardoModels: { id: string; name: string; description?: string }[]) {
  return leonardoModels.map((m) => ({
    value: m.id,
    label: m.name,
    description: m.description ?? "Coût en crédits Leonardo selon résolution et options",
  }));
}

interface StepImagesProps {
  segments: VideoSegment[];
  imageModel: ImageModel;
  onImageModelChange: (model: ImageModel) => void;
  onGenerateAllImages: () => void;
  onRegenerateImage: (id: string) => void;
  onGenerateImageVariation: (id: string) => void;
  generatingImages: boolean;
  imageLoadingIds: Set<string>;
  onSegmentPromptChange: (id: string, imagePrompt: string) => void;
  leonardoApiKey?: string;
  selectedVisualStyleId: string | null;
  onSelectVisualStyle: (style: VisualStyle | null) => void;
  selectedVisualStyle: VisualStyle | null;
  onProceed: () => void;
}

export function StepImages({
  segments,
  imageModel,
  onImageModelChange,
  onGenerateAllImages,
  onRegenerateImage,
  onGenerateImageVariation,
  generatingImages,
  imageLoadingIds,
  onSegmentPromptChange,
  leonardoApiKey,
  selectedVisualStyleId,
  onSelectVisualStyle,
  selectedVisualStyle,
  onProceed,
}: StepImagesProps) {
  const [leonardoModels, setLeonardoModels] = React.useState<{ id: string; name: string; description?: string }[]>([]);
  const imageModelOptions = React.useMemo(() => buildImageModelOptions(leonardoModels), [leonardoModels]);

  React.useEffect(() => {
    if (!leonardoApiKey) {
      setLeonardoModels([]);
      return;
    }
    let cancelled = false;
    fetch("/api/leonardo-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: leonardoApiKey }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Échec du chargement des modèles Leonardo"))))
      .then((data: { models?: { id: string; name: string; description?: string }[] }) => {
        if (!cancelled && Array.isArray(data.models)) {
          setLeonardoModels(data.models);
          if (!imageModel && data.models.length > 0) {
            onImageModelChange(data.models[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLeonardoModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [leonardoApiKey]);

  const generatedCount = segments.filter((s) => !!s.imageUrl).length;
  const canProceed = generatedCount === segments.length && segments.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 3 — Images</CardTitle>
        <CardDescription>
          Configure le style visuel puis génère, ajuste et régénère les images de chaque segment.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Card className="bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Style global
            </CardTitle>
            <CardDescription>
              Ces réglages s&apos;appliquent à toutes les images pour garder une cohérence visuelle et limiter les
              générations ratées (et donc les crédits gaspillés).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ModelSelector
              label="Modèle d'image (Leonardo)"
              value={imageModel}
              onChange={(v) => onImageModelChange(v as ImageModel)}
              options={imageModelOptions}
            />

            <div className="flex flex-col gap-1.5 lg:col-span-2">
              <VisualStyleManager selectedId={selectedVisualStyleId} onSelect={onSelectVisualStyle} />
              {selectedVisualStyle && (
                <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Prompt de style appliqué à tous les segments : « {selectedVisualStyle.stylePrompt} »
                  </p>
                  {selectedVisualStyle.referenceImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedVisualStyle.referenceImages.map((src, index) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={index}
                          src={src}
                          alt={`Référence de style ${index + 1}`}
                          className="h-14 w-14 rounded-md border border-border object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">Génération des visuels</span>
            <span className="text-xs text-muted-foreground">
              {generatedCount}/{segments.length} images générées
            </span>
          </div>
          <Button onClick={onGenerateAllImages} disabled={generatingImages}>
            {generatingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Générer toutes les images
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {segments.map((segment) => {
            const loading = imageLoadingIds.has(segment.id);
            return (
              <Card key={segment.id} className="overflow-hidden">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-56">
                    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg border border-border bg-secondary">
                      {loading ? (
                        <Skeleton className="h-full w-full" />
                      ) : segment.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={segment.imageUrl}
                          alt={`Visuel segment ${segment.order}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                          Segment {segment.order}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        Segment {segment.order} · {segment.duration}s
                      </span>
                      {segment.isSceneVariation && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Variation
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Prompt de contenu (ce qui doit apparaître dans l&apos;image)
                      </label>
                      <Textarea
                        value={segment.imagePrompt ?? ""}
                        onChange={(e) => onSegmentPromptChange(segment.id, e.target.value)}
                        placeholder={segment.visualDescription}
                        className="min-h-[140px] text-sm leading-relaxed"
                      />
                      <p className="text-xs text-muted-foreground">
                        Décrit le sujet et la composition de cette image précise. Laisse vide pour utiliser la
                        description visuelle générée à partir du script. Le style visuel sélectionné ci-dessus
                        (rendu, ambiance, images de référence) est automatiquement combiné à ce prompt.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => onRegenerateImage(segment.id)} disabled={loading}>
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        Régénérer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGenerateImageVariation(segment.id)}
                        disabled={loading}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Générer une variation
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onProceed} disabled={!canProceed} size="lg">
          <ArrowRight className="h-4 w-4" />
          Passer à la voix off
        </Button>
      </CardFooter>
    </Card>
  );
}
