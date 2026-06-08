"use client";

import * as React from "react";
import { ImagePlus, Mic, ArrowRight, Loader2, Upload, X } from "lucide-react";
import type { ImageModel, VideoSegment, VoiceId } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { ModelSelector } from "../ui/ModelSelector";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { AudioPlayer } from "../ui/AudioPlayer";
import { Skeleton } from "../ui/Skeleton";
import { IMAGE_COSTS } from "@/lib/cost-calculator";
import { IMAGE_EDIT_MODELS, VOICE_DESCRIPTIONS, modelSupportsReferenceImage } from "@/lib/pollinations";

const FALLBACK_IMAGE_MODELS = Object.keys(IMAGE_COSTS) as ImageModel[];

function buildImageModelOptions(models: ImageModel[]) {
  return models.map((key) => ({
    value: key,
    label: key,
    description: IMAGE_COSTS[key]?.label ?? "Modèle Pollinations",
  }));
}

const VOICE_OPTIONS = (Object.keys(VOICE_DESCRIPTIONS) as VoiceId[]).map((key) => ({
  value: key,
  label: VOICE_DESCRIPTIONS[key],
}));

interface StepAssetsProps {
  segments: VideoSegment[];
  imageModel: ImageModel;
  onImageModelChange: (model: ImageModel) => void;
  onGenerateAllImages: () => void;
  onRegenerateImage: (id: string) => void;
  onGenerateImageVariation: (id: string) => void;
  generatingImages: boolean;
  imageLoadingIds: Set<string>;
  onSegmentPromptChange: (id: string, imagePrompt: string) => void;
  referenceImage?: string;
  onReferenceImageChange: (file: File | null) => void;
  promptStyleSuffix: string;
  onPromptStyleSuffixChange: (value: string) => void;
  voiceId: VoiceId;
  onVoiceChange: (voice: VoiceId) => void;
  onGenerateVoice: () => void;
  voiceoverUrl?: string;
  generatingVoice: boolean;
  onProceed: () => void;
}

export function StepAssets({
  segments,
  imageModel,
  onImageModelChange,
  onGenerateAllImages,
  onRegenerateImage,
  onGenerateImageVariation,
  generatingImages,
  imageLoadingIds,
  onSegmentPromptChange,
  referenceImage,
  onReferenceImageChange,
  promptStyleSuffix,
  onPromptStyleSuffixChange,
  voiceId,
  onVoiceChange,
  onGenerateVoice,
  voiceoverUrl,
  generatingVoice,
  onProceed,
}: StepAssetsProps) {
  const [imageModelOptions, setImageModelOptions] = React.useState(() =>
    buildImageModelOptions(FALLBACK_IMAGE_MODELS)
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const supportsReference = modelSupportsReferenceImage(imageModel);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/image-models")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Échec du chargement des modèles"))))
      .then((data: { models?: ImageModel[] }) => {
        if (!cancelled && Array.isArray(data.models) && data.models.length > 0) {
          setImageModelOptions(buildImageModelOptions(data.models));
        }
      })
      .catch(() => {
        // garde la liste de secours en cas d'échec
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generatedCount = segments.filter((s) => !!s.imageUrl).length;
  const canProceed = generatedCount === segments.length && segments.length > 0 && !!voiceoverUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 3 — Assets</CardTitle>
        <CardDescription>Génère les visuels et la voix off de ta vidéo.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="bg-secondary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImagePlus className="h-4 w-4" />
                Images
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ModelSelector
                label="Modèle d'image (Pollinations)"
                value={imageModel}
                onChange={(v) => onImageModelChange(v as ImageModel)}
                options={imageModelOptions}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Image de référence (optionnel)</label>
                <p className="text-xs text-muted-foreground">
                  Sert de base visuelle pour guider le style et la composition. Compatible avec les modèles d'édition :{" "}
                  {IMAGE_EDIT_MODELS.join(", ")}.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onReferenceImageChange(e.target.files?.[0] ?? null)}
                />
                {referenceImage ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={referenceImage}
                      alt="Image de référence"
                      className="h-16 w-16 rounded-md border border-border object-cover"
                    />
                    <Button variant="outline" size="sm" onClick={() => onReferenceImageChange(null)}>
                      <X className="h-4 w-4" />
                      Retirer
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-fit" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Importer une image
                  </Button>
                )}
                {referenceImage && !supportsReference && (
                  <p className="text-xs text-amber-500">
                    Le modèle « {imageModel} » ignore l'image de référence : choisis un modèle d'édition ci-dessus
                    pour l'utiliser.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Style ajouté à tous les prompts (optionnel)</label>
                <Input
                  value={promptStyleSuffix}
                  onChange={(e) => onPromptStyleSuffixChange(e.target.value)}
                  placeholder="ex. cinematic lighting, ultra detailed, 8k"
                />
                <p className="text-xs text-muted-foreground">
                  Ajouté à la fin de chaque prompt pour garder une cohérence visuelle et limiter les générations ratées.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Button onClick={onGenerateAllImages} disabled={generatingImages}>
                  {generatingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Générer toutes les images
                </Button>
                <span className="text-sm text-muted-foreground">
                  {generatedCount}/{segments.length} images générées
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {segments.map((segment) => {
                  const loading = imageLoadingIds.has(segment.id);
                  return (
                    <div key={segment.id} className="flex flex-col gap-1.5">
                      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-border bg-secondary">
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
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            Segment {segment.order}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-muted-foreground">{segment.duration}s</span>
                        {segment.isSceneVariation && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Variation de la scène précédente
                          </span>
                        )}
                      </div>
                      <Textarea
                        value={segment.imagePrompt ?? ""}
                        onChange={(e) => onSegmentPromptChange(segment.id, e.target.value)}
                        placeholder={segment.visualDescription}
                        className="min-h-[60px] text-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => onRegenerateImage(segment.id)}
                        disabled={loading}
                      >
                        Regénérer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => onGenerateImageVariation(segment.id)}
                        disabled={loading}
                      >
                        Générer une variation
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-4 w-4" />
                Voix off
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Voix (Pollinations TTS)</label>
                <Select value={voiceId} onChange={(v) => onVoiceChange(v as VoiceId)} options={VOICE_OPTIONS} />
              </div>
              <Button onClick={onGenerateVoice} disabled={generatingVoice} className="w-fit">
                {generatingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                Générer la voix off
              </Button>
              <AudioPlayer src={voiceoverUrl} loading={generatingVoice} onRegenerate={onGenerateVoice} />
            </CardContent>
          </Card>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onProceed} disabled={!canProceed} size="lg">
          <ArrowRight className="h-4 w-4" />
          Passer à l'export
        </Button>
      </CardFooter>
    </Card>
  );
}
